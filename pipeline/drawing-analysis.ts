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
