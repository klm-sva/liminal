/**
 * pipeline/drawing-analysis.ts
 *
 * Orchestrates the Python-based drawing analysis pipeline.
 * Downloads drawing PDFs from Supabase Storage, runs analyze_drawings.py
 * (PyMuPDF + Claude vision), uploads results back to Storage, and updates
 * the projects table.
 *
 * Triggered by the drawing upload webhook — never called directly by customers.
 */

import * as path     from "path";
import * as fs       from "fs";
import * as os       from "os";
import * as crypto   from "crypto";
import { execFile }  from "child_process";
import { promisify } from "util";
import { createServiceClient } from "./lib/supabase";
import { logAuditEvent }       from "./lib/supabase-ops";

const execFileAsync = promisify(execFile);

const PYTHON_SCRIPT = path.resolve(__dirname, "lib/analyze_drawings.py");
const PYTHON_BIN    = process.env.PYTHON_BIN ?? "python3";
const TIMEOUT_MS    = 180_000;

export interface DrawingAnalysisResult {
  projectId:      string;
  sheetsAnalyzed: number;
  flaggedFields:  string[];
  profilePath:    string;
  annotatedPdfs:  string[];   // Supabase Storage paths
  tokenUsage:     { input_tokens: number; output_tokens: number };
  elapsedSeconds: number;
}

/**
 * Run drawing analysis for a project.
 *
 * @param projectId    - Supabase projects.id
 * @param customerId   - Supabase customers.id (used for storage paths)
 * @param drawingPaths - Paths inside the customer-uploads bucket
 */
export async function analyzeDrawings(
  projectId:    string,
  customerId:   string,
  drawingPaths: string[],
): Promise<DrawingAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const supabase = createServiceClient();
  console.log(`[drawing-analysis] project=${projectId} drawings=${drawingPaths.length}`);

  // 1. Download PDFs to a temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "certify-drawings-"));
  const localPaths: string[] = [];

  try {
    for (const drawingPath of drawingPaths) {
      const { data, error } = await supabase.storage
        .from("customer-uploads")
        .download(drawingPath);
      if (error || !data) throw new Error(`Download failed: ${drawingPath} — ${error?.message}`);

      const filename  = drawingPath.split("/").pop() ?? `drawing_${localPaths.length}.pdf`;
      const localPath = path.join(tmpDir, filename);
      fs.writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
      localPaths.push(localPath);
      console.log(`  ✓ downloaded ${filename}`);
    }

    // 2. Run Python analysis script
    const args = [
      PYTHON_SCRIPT,
      "--project-id",  projectId,
      "--customer-id", customerId,
      "--output-dir",  tmpDir,
      ...localPaths,
    ];

    console.log(`  Running analyze_drawings.py (timeout ${TIMEOUT_MS / 1000}s)...`);
    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(PYTHON_BIN, args, {
        timeout: TIMEOUT_MS,
        env: { ...process.env },
        maxBuffer: 50 * 1024 * 1024,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: any) {
      stderr = (err as any).stderr ?? "";
      stdout = (err as any).stdout ?? "";
      if (stderr) console.error(`  [python stderr]\n${stderr}`);
      throw new Error(`analyze_drawings.py failed: ${(err as Error).message}`);
    }

    if (stderr.trim()) console.warn(`  [python stderr]\n${stderr.trim()}`);

    // Parse the __RESULT__ JSON block from stdout
    const resultMarker = "__RESULT__";
    const markerIdx    = stdout.lastIndexOf(resultMarker);
    if (markerIdx === -1) throw new Error("analyze_drawings.py produced no __RESULT__ block");

    const logOutput = stdout.slice(0, markerIdx).trim();
    if (logOutput) console.log(logOutput);

    const summary = JSON.parse(stdout.slice(markerIdx + resultMarker.length).trim()) as {
      success:         boolean;
      sheets_analyzed: number;
      annotated_pdfs:  string[];
      profile_path:    string;
      flagged_fields:  string[];
      token_usage:     { input_tokens: number; output_tokens: number };
      elapsed_seconds: number;
    };

    if (!summary.success) throw new Error("analyze_drawings.py reported failure");

    // 3. Upload project-profile.json to Supabase Storage
    const profileJson   = fs.readFileSync(summary.profile_path, "utf-8");
    const profileRemote = `${customerId}/${projectId}/project-profile.json`;
    const { error: profileUploadErr } = await supabase.storage
      .from("customer-uploads")
      .upload(profileRemote, new Blob([profileJson], { type: "application/json" }), { upsert: true });
    if (profileUploadErr) throw new Error(`profile upload failed: ${profileUploadErr.message}`);
    console.log(`  ✓ uploaded project-profile.json`);

    // 4. Upload annotated PDFs
    const annotatedRemotePaths: string[] = [];
    for (const localAnnotated of summary.annotated_pdfs) {
      const filename   = path.basename(localAnnotated);
      const remotePath = `${customerId}/${projectId}/outputs/${filename}`;
      const pdfBytes   = fs.readFileSync(localAnnotated);
      const { error: pdfUploadErr } = await supabase.storage
        .from("customer-uploads")
        .upload(remotePath, new Blob([pdfBytes], { type: "application/pdf" }), { upsert: true });
      if (pdfUploadErr) {
        console.warn(`  [WARN] annotated PDF upload failed: ${pdfUploadErr.message}`);
      } else {
        annotatedRemotePaths.push(remotePath);
        console.log(`  ✓ uploaded ${filename}`);
      }
    }

    // 5. Update projects table
    const profile    = JSON.parse(profileJson) as Record<string, unknown>;
    const fixtures   = profile.plumbing_fixtures as Record<string, unknown> ?? {};
    const parking    = profile.parking           as Record<string, unknown> ?? {};
    const site       = profile.site              as Record<string, unknown> ?? {};
    const tokenUsage = profile._token_usage      as { input_tokens: number; output_tokens: number };

    const updatePayload: Record<string, unknown> = {
      auto_extracted:        true,
      flagged_fields:        summary.flagged_fields,
      drawings_analyzed_at:  new Date().toISOString(),
      drawing_data:          profile,
      ...(profile.project_name     ? { name:              profile.project_name     } : {}),
      ...(profile.project_address  ? { address:           profile.project_address  } : {}),
      ...(profile.building_type    ? { building_type:     profile.building_type    } : {}),
      ...(profile.primary_occupancy? { primary_occupancy: profile.primary_occupancy} : {}),
      ...(fixtures                 ? { plumbing_fixtures:  fixtures                 } : {}),
      ...(parking.total_spaces       != null ? { total_parking:           parking.total_spaces       } : {}),
      ...(parking.accessible_spaces  != null ? { accessible_parking:      parking.accessible_spaces  } : {}),
      ...(parking.bicycle_spaces     != null ? { bicycle_parking:         parking.bicycle_spaces     } : {}),
      ...(site.site_area_sqft          != null ? { site_area_sqft:          site.site_area_sqft          } : {}),
      ...(site.landscaping_area_sqft   != null ? { landscaping_sqft:        site.landscaping_area_sqft   } : {}),
      ...(site.impervious_surface_sqft != null ? { impervious_sqft:         site.impervious_surface_sqft } : {}),
      ...(site.building_footprint_sqft != null ? { building_footprint_sqft: site.building_footprint_sqft } : {}),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await supabase
      .from("projects")
      .update(updatePayload as any)
      .eq("id", projectId);
    if (updateErr) throw new Error(`projects update failed: ${updateErr.message}`);
    console.log(`  ✓ updated projects table`);

    // Delete source drawings — extraction is complete, no further use
    const { error: deleteErr } = await supabase.storage.from("customer-uploads").remove(drawingPaths);
    if (deleteErr) console.warn(`  [WARN] Failed to delete drawing files: ${deleteErr.message}`);
    else console.log(`  ✓ deleted ${drawingPaths.length} drawing file(s) from storage`);

    // 6. Audit log
    await logAuditEvent({
      eventType:  "drawing_analysis_complete",
      entityType: "project",
      entityId:   projectId,
      customerId,
      metadata:   {
        sheetsAnalyzed:  summary.sheets_analyzed,
        flaggedFields:   summary.flagged_fields,
        annotatedPdfs:   annotatedRemotePaths.length,
        elapsedSeconds:  summary.elapsed_seconds,
        inputTokens:     tokenUsage?.input_tokens  ?? 0,
        outputTokens:    tokenUsage?.output_tokens ?? 0,
      },
    });

    return {
      projectId,
      sheetsAnalyzed: summary.sheets_analyzed,
      flaggedFields:  summary.flagged_fields,
      profilePath:    profileRemote,
      annotatedPdfs:  annotatedRemotePaths,
      tokenUsage:     tokenUsage ?? { input_tokens: 0, output_tokens: 0 },
      elapsedSeconds: summary.elapsed_seconds,
    };

  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Per-order, project-wide drawing cache
//
// The function above assumes a single project-level "drawing set" uploaded
// once via the project-creation flow — that flow is essentially never used
// (0 of 6 projects have ever had auto_extracted=true). In practice customers
// upload drawings per order, per credit, mixed in with other required
// documents. The functions below let any order's uploads participate:
//
//   - getOrAnalyzeDrawing(): hash a file's bytes; if this exact file was
//     already analyzed anywhere in this project (any order, any credit),
//     reuse the cached profile instead of re-running Python. Otherwise
//     analyze it once and cache the result under its hash.
//   - rebuildProjectProfile(): merge every drawing profile ever cached for
//     this project into one cumulative project-profile.json + projects
//     table update, regardless of which order originally supplied each
//     drawing.
//
// Cost is paid once per unique drawing, project-wide — not once per order,
// and not silently zero like the dead project-creation flow.
// ════════════════════════════════════════════════════════════════════════════

export interface DrawingFileProfile {
  hash:             string;
  filename:         string;
  sheetsAnalyzed:   number;
  flaggedFields:    string[];
  annotatedPdfPath: string | null;
  profile:          Record<string, unknown>;
  tokenUsage:       { input_tokens: number; output_tokens: number };
  analyzedAt:       string;
}

export function hashDrawingBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function drawingProfilePath(customerId: string, projectId: string, hash: string): string {
  return `${customerId}/${projectId}/drawing-profiles/${hash}.json`;
}

function drawingAnnotatedPath(customerId: string, projectId: string, hash: string): string {
  return `${customerId}/${projectId}/drawing-annotated/${hash}.pdf`;
}

async function getCachedDrawingProfile(
  customerId: string,
  projectId:  string,
  hash:       string,
): Promise<DrawingFileProfile | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from("customer-uploads")
    .download(drawingProfilePath(customerId, projectId, hash));
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as DrawingFileProfile;
  } catch {
    return null;
  }
}

async function runPythonAnalysis(
  projectId:     string,
  customerId:    string,
  localPdfPath:  string,
  tmpDir:        string,
): Promise<{
  profile:            Record<string, unknown>;
  sheetsAnalyzed:     number;
  flaggedFields:      string[];
  annotatedLocalPath: string | null;
  tokenUsage:         { input_tokens: number; output_tokens: number };
}> {
  const args = [
    PYTHON_SCRIPT,
    "--project-id",  projectId,
    "--customer-id", customerId,
    "--output-dir",  tmpDir,
    localPdfPath,
  ];

  let stdout = "";
  let stderr = "";
  try {
    const result = await execFileAsync(PYTHON_BIN, args, {
      timeout: TIMEOUT_MS,
      env: { ...process.env },
      maxBuffer: 50 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err: any) {
    stderr = (err as any).stderr ?? "";
    stdout = (err as any).stdout ?? "";
    if (stderr) console.error(`  [python stderr]\n${stderr}`);
    throw new Error(`analyze_drawings.py failed: ${(err as Error).message}`);
  }

  if (stderr.trim()) console.warn(`  [python stderr]\n${stderr.trim()}`);

  const resultMarker = "__RESULT__";
  const markerIdx    = stdout.lastIndexOf(resultMarker);
  if (markerIdx === -1) throw new Error("analyze_drawings.py produced no __RESULT__ block");

  const logOutput = stdout.slice(0, markerIdx).trim();
  if (logOutput) console.log(logOutput);

  const summary = JSON.parse(stdout.slice(markerIdx + resultMarker.length).trim()) as {
    success:         boolean;
    sheets_analyzed: number;
    annotated_pdfs:  string[];
    profile_path:    string;
    flagged_fields:  string[];
    token_usage:     { input_tokens: number; output_tokens: number };
    elapsed_seconds: number;
  };

  if (!summary.success) throw new Error("analyze_drawings.py reported failure");

  const profile = JSON.parse(fs.readFileSync(summary.profile_path, "utf-8")) as Record<string, unknown>;

  return {
    profile,
    sheetsAnalyzed:     summary.sheets_analyzed,
    flaggedFields:      summary.flagged_fields,
    annotatedLocalPath: summary.annotated_pdfs[0] ?? null,
    tokenUsage:         summary.token_usage,
  };
}

/**
 * Analyze one uploaded file, or reuse a cached profile if this exact file
 * (by content hash) was already analyzed anywhere in this project before —
 * in this order, a prior order, or any credit. Never deletes the source
 * file: unlike the project-creation flow, the source here is the customer's
 * submitted order document and is still needed elsewhere in the pipeline.
 */
export async function getOrAnalyzeDrawing(
  customerId: string,
  projectId:  string,
  file:       { filename: string; buffer: Buffer },
): Promise<{ profile: DrawingFileProfile; cached: boolean }> {
  const hash = hashDrawingBuffer(file.buffer);

  const cached = await getCachedDrawingProfile(customerId, projectId, hash);
  if (cached) {
    console.log(`  [drawing-cache] ${file.filename} — already analyzed for this project (hash ${hash.slice(0, 8)}), reusing cached profile`);
    return { profile: cached, cached: true };
  }

  console.log(`  [drawing-cache] ${file.filename} — new drawing for this project, analyzing (hash ${hash.slice(0, 8)})...`);

  const supabase = createServiceClient();
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), "certify-drawing-"));

  try {
    const localPath = path.join(tmpDir, file.filename);
    fs.writeFileSync(localPath, file.buffer);

    const result = await runPythonAnalysis(projectId, customerId, localPath, tmpDir);

    let annotatedPdfPath: string | null = null;
    if (result.annotatedLocalPath && fs.existsSync(result.annotatedLocalPath)) {
      const remotePath = drawingAnnotatedPath(customerId, projectId, hash);
      const pdfBytes   = fs.readFileSync(result.annotatedLocalPath);
      const { error: uploadErr } = await supabase.storage
        .from("customer-uploads")
        .upload(remotePath, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (uploadErr) {
        console.warn(`  [drawing-cache] annotated PDF upload failed: ${uploadErr.message}`);
      } else {
        annotatedPdfPath = remotePath;
      }
    }

    const profileRecord: DrawingFileProfile = {
      hash,
      filename:       file.filename,
      sheetsAnalyzed: result.sheetsAnalyzed,
      flaggedFields:  result.flaggedFields,
      annotatedPdfPath,
      profile:        result.profile,
      tokenUsage:     result.tokenUsage,
      analyzedAt:     new Date().toISOString(),
    };

    const { error: cacheUploadErr } = await supabase.storage
      .from("customer-uploads")
      .upload(drawingProfilePath(customerId, projectId, hash), JSON.stringify(profileRecord, null, 2), {
        contentType: "application/json",
        upsert:      true,
      });
    if (cacheUploadErr) {
      console.warn(`  [drawing-cache] failed to cache profile: ${cacheUploadErr.message}`);
    }

    await logAuditEvent({
      eventType:  "drawing_analyzed",
      entityType: "project",
      entityId:   projectId,
      customerId,
      metadata: {
        filename:          file.filename,
        hash,
        sheetsAnalyzed:    result.sheetsAnalyzed,
        flaggedFieldCount: result.flaggedFields.length,
        inputTokens:       result.tokenUsage?.input_tokens  ?? 0,
        outputTokens:      result.tokenUsage?.output_tokens ?? 0,
      },
    });

    return { profile: profileRecord, cached: false };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// b's non-null values win; arrays are concatenated and deduplicated by deep
// equality; nested plain objects are merged recursively.
function mergeProfiles(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [key, bVal] of Object.entries(b)) {
    if (bVal === null || bVal === undefined) continue;
    const aVal = out[key];
    if (Array.isArray(aVal) && Array.isArray(bVal)) {
      const combined = [...aVal, ...bVal];
      out[key] = combined.filter(
        (v, i) => combined.findIndex((v2) => JSON.stringify(v2) === JSON.stringify(v)) === i,
      );
    } else if (
      aVal && bVal && typeof aVal === "object" && typeof bVal === "object" &&
      !Array.isArray(aVal) && !Array.isArray(bVal)
    ) {
      out[key] = mergeProfiles(aVal as Record<string, unknown>, bVal as Record<string, unknown>);
    } else {
      out[key] = bVal;
    }
  }
  return out;
}

/**
 * Rebuild this project's cumulative profile from every drawing ever cached
 * for it — across every order and credit, not just the current one — and
 * persist it as project-profile.json plus the projects table columns
 * downstream credit generation reads. Cheap: no Claude calls, just merging
 * already-computed JSON.
 */
export async function rebuildProjectProfile(
  customerId: string,
  projectId:  string,
): Promise<{ profile: Record<string, unknown>; flaggedFields: string[]; fileCount: number }> {
  const supabase = createServiceClient();
  const prefix   = `${customerId}/${projectId}/drawing-profiles`;

  const { data: files, error } = await supabase.storage.from("customer-uploads").list(prefix);
  if (error || !files?.length) {
    return { profile: {}, flaggedFields: [], fileCount: 0 };
  }

  let merged: Record<string, unknown> = {};
  const flaggedFields = new Set<string>();

  for (const f of files.filter((f) => f.name.endsWith(".json"))) {
    const { data, error: dlErr } = await supabase.storage.from("customer-uploads").download(`${prefix}/${f.name}`);
    if (dlErr || !data) continue;
    try {
      const record = JSON.parse(await data.text()) as DrawingFileProfile;
      merged = mergeProfiles(merged, record.profile ?? {});
      (record.flaggedFields ?? []).forEach((ff) => flaggedFields.add(ff));
    } catch {
      continue;
    }
  }

  await supabase.storage
    .from("customer-uploads")
    .upload(`${customerId}/${projectId}/project-profile.json`, JSON.stringify(merged, null, 2), {
      contentType: "application/json",
      upsert:      true,
    });

  // Deliberately does NOT overwrite projects.name/address from the merged
  // profile — unlike the one-shot project-creation flow, a single credit's
  // drawing subset shouldn't be able to silently rename/re-address a
  // project based on a partially-read title block.
  const fixtures = (merged.plumbing_fixtures as Record<string, unknown>) ?? {};
  const parking  = (merged.parking           as Record<string, unknown>) ?? {};
  const site     = (merged.site              as Record<string, unknown>) ?? {};

  const updatePayload: Record<string, unknown> = {
    auto_extracted:       true,
    flagged_fields:       Array.from(flaggedFields),
    drawings_analyzed_at: new Date().toISOString(),
    drawing_data:         merged,
    ...(merged.building_type     ? { building_type:     merged.building_type }     : {}),
    ...(merged.primary_occupancy ? { primary_occupancy: merged.primary_occupancy } : {}),
    ...(Object.keys(fixtures).length ? { plumbing_fixtures: fixtures } : {}),
    ...(parking.total_spaces       != null ? { total_parking:           parking.total_spaces       } : {}),
    ...(parking.accessible_spaces  != null ? { accessible_parking:      parking.accessible_spaces  } : {}),
    ...(parking.bicycle_spaces     != null ? { bicycle_parking:         parking.bicycle_spaces     } : {}),
    ...(site.site_area_sqft          != null ? { site_area_sqft:          site.site_area_sqft          } : {}),
    ...(site.landscaping_area_sqft   != null ? { landscaping_sqft:        site.landscaping_area_sqft   } : {}),
    ...(site.impervious_surface_sqft != null ? { impervious_sqft:         site.impervious_surface_sqft } : {}),
    ...(site.building_footprint_sqft != null ? { building_footprint_sqft: site.building_footprint_sqft } : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await supabase.from("projects").update(updatePayload as any).eq("id", projectId);
  if (updateErr) console.warn(`  [drawing-cache] projects table update failed: ${updateErr.message}`);

  return { profile: merged, flaggedFields: Array.from(flaggedFields), fileCount: files.length };
}
