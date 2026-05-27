"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pipeline/lib/supabase.ts
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return (0, import_supabase_js.createClient)(url, key);
}
var import_supabase_js;
var init_supabase = __esm({
  "pipeline/lib/supabase.ts"() {
    "use strict";
    import_supabase_js = require("@supabase/supabase-js");
  }
});

// pipeline/lib/extract-xlsx-row.ts
function creditCodeNeedles(code) {
  const lower = code.toLowerCase();
  const m = code.match(/^([A-Za-z]+)(c|p)(\d+)?$/i);
  if (m) {
    const prefix = m[1].toLowerCase();
    const type = m[2].toLowerCase() === "c" ? "credit" : "prereq";
    const num = m[3] ?? "";
    const xlsxFmt = num ? `${prefix} ${type} ${num}` : `${prefix} ${type}`;
    return [xlsxFmt, lower];
  }
  return [lower];
}
function parseList(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
}
function parseRows(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows2 = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = rows2[1].map((h) => String(h ?? "").replace(/\n/g, " ").trim());
  return { rows: rows2, headers };
}
function loadWorkbook() {
  if (!fs.existsSync(AUTOMATION_XLSX)) {
    throw new Error(`Automation analysis XLSX not found: ${AUTOMATION_XLSX}`);
  }
  console.log(`  [loadWorkbook] reading file from disk: ${AUTOMATION_XLSX}`);
  const buf = fs.readFileSync(AUTOMATION_XLSX);
  console.log(`  [loadWorkbook] file read complete \u2014 ${buf.length} bytes \u2014 parsing XLSX...`);
  const result = parseRows(buf);
  console.log(`  [loadWorkbook] XLSX parse complete \u2014 ${result.rows.length} rows`);
  return result;
}
function extractCreditData(creditCode) {
  const { rows: rows2 } = loadWorkbook();
  const needles = creditCodeNeedles(creditCode);
  const dataRow = rows2.slice(2).find((row) => {
    const name = String(row[COL.creditName] ?? "").toLowerCase();
    const num = String(row[COL.creditNumber] ?? "").toLowerCase();
    return needles.some((n) => name.includes(n) || num.includes(n));
  });
  if (!dataRow) {
    throw new Error(`Credit "${creditCode}" not found in automation analysis spreadsheet (tried: ${needles.join(", ")})`);
  }
  const get = (col) => String(dataRow[col] ?? "").trim();
  return {
    creditNumber: get(COL.creditNumber),
    creditName: get(COL.creditName),
    ptsAvailable: get(COL.ptsAvailable),
    automatable: get(COL.automatable),
    docTier: get(COL.docTier),
    customerUploads: parseList(get(COL.customerUploads)),
    claudeRetrieves: parseList(get(COL.claudeRetrieves)),
    platformFiles: {
      formLink: get(COL.formLink) || null,
      calculatorInfo: get(COL.calculatorInfo) || null
    },
    outputs: parseList(get(COL.claudeOutputs)),
    gbciVerification: get(COL.gbciVerification),
    blockerNotes: get(COL.blockerNotes)
  };
}
function formatCreditDataForPrompt(data2) {
  const lines = [
    `Credit: ${data2.creditNumber} \u2014 ${data2.creditName}`,
    `Automatable: ${data2.automatable} | Tier: ${data2.docTier}`,
    "",
    "DOCUMENTS TO COLLECT FROM PROJECT TEAM:",
    ...data2.customerUploads.map((d) => `  - ${d}`),
    "",
    "DOCUMENTS CLAUDE RETRIEVES AUTOMATICALLY:",
    ...data2.claudeRetrieves.map((d) => `  - ${d}`),
    "",
    "OUTPUTS TO GENERATE FOR THIS CREDIT:",
    ...data2.outputs.map((o) => `  - ${o}`),
    "",
    `LEED Online Form: ${data2.platformFiles.formLink ?? "N/A"}`,
    ...data2.platformFiles.calculatorInfo ? [`Calculator: ${data2.platformFiles.calculatorInfo}`] : [],
    ...data2.blockerNotes ? [`Notes: ${data2.blockerNotes}`] : []
  ];
  return lines.join("\n");
}
var XLSX, fs, path, AUTOMATION_XLSX, COL;
var init_extract_xlsx_row = __esm({
  "pipeline/lib/extract-xlsx-row.ts"() {
    "use strict";
    XLSX = __toESM(require("xlsx"));
    fs = __toESM(require("fs"));
    path = __toESM(require("path"));
    AUTOMATION_XLSX = path.join(process.cwd(), "pipeline/reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");
    COL = {
      creditNumber: 0,
      creditName: 1,
      ptsAvailable: 2,
      ptsAuto: 3,
      automatable: 4,
      docTier: 5,
      allDocuments: 6,
      // full combined list
      customerUploads: 7,
      // Column 1: Project Team Must Upload
      claudeRetrieves: 8,
      // Column 2: Claude Auto-Retrieves
      claudeOutputs: 9,
      // Column 4: Outputs Generated
      gbciVerification: 10,
      blockerNotes: 11,
      formLink: 12,
      // Column 3 partial: LEED Online Form Link
      calculatorInfo: 13
      // Column 3 partial: Calculator / Worksheet
    };
  }
});

// pipeline/lib/pdf-to-images.ts
function preparePdfDocument(input, title) {
  const buf = typeof input === "string" ? fs2.readFileSync(input) : input;
  return {
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: buf.toString("base64")
    },
    title
  };
}
var fs2;
var init_pdf_to_images = __esm({
  "pipeline/lib/pdf-to-images.ts"() {
    "use strict";
    fs2 = __toESM(require("fs"));
  }
});

// pipeline/lib/supabase-ops.ts
async function logAuditEvent(event) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_log").insert({
    event_type: event.eventType,
    entity_type: event.entityType,
    entity_id: event.entityId,
    customer_id: event.customerId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: event.metadata ?? {}
  });
  if (error) {
    console.warn(`[audit] Failed to log ${event.eventType}: ${error.message}`);
  }
}
var init_supabase_ops = __esm({
  "pipeline/lib/supabase-ops.ts"() {
    "use strict";
    init_supabase();
  }
});

// pipeline/document-review.ts
async function reviewDocument(client2, requiredDocumentDescription, fileBuffer, filename2) {
  const isPdf = filename2.toLowerCase().endsWith(".pdf");
  const contentBlocks = isPdf ? [
    preparePdfDocument(fileBuffer, filename2),
    {
      type: "text",
      text: `Required document type: ${requiredDocumentDescription}

Review this document and return the JSON assessment.`
    }
  ] : [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: fileBuffer.toString("base64")
      }
    },
    {
      type: "text",
      text: `Required document type: ${requiredDocumentDescription}

Review this document and return the JSON assessment.`
    }
  ];
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: DOCUMENT_REVIEW_PROMPT,
    messages: [{ role: "user", content: contentBlocks }]
  });
  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const json = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(json);
  } catch {
    console.warn(`  \u26A0 Review response was not valid JSON for ${filename2}: ${rawText.slice(0, 200)}`);
    return { acceptable: false, issue: "Document review could not be completed \u2014 please re-upload." };
  }
}
function matchUploadToRequirement(requiredDescription, uploads) {
  const keywords = requiredDescription.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
  let bestMatch = null;
  let bestScore = 0;
  for (const upload of uploads) {
    const name = upload.filename.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    const score = keywords.filter((kw) => name.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = upload;
    }
  }
  return bestScore > 0 ? bestMatch : null;
}
async function reviewDocuments(orderId, customerId, creditCode, uploads) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk.default({ apiKey, timeout: 18e4, maxRetries: 0 });
  const supabase = createServiceClient();
  console.log(`[document-review] Order ${orderId} \u2014 ${creditCode} \u2014 ${uploads.length} upload(s)`);
  const creditData = extractCreditData(creditCode);
  const requiredDocs = creditData.customerUploads;
  if (requiredDocs.length === 0) {
    console.log(`  No required documents defined for ${creditCode} \u2014 auto-passing review`);
    return {
      orderId,
      creditCode,
      status: "complete",
      issues: [],
      reviewedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  console.log(`  Required: ${requiredDocs.length} document(s) per automation analysis`);
  const issues = [];
  for (const requiredDoc of requiredDocs) {
    const matched = matchUploadToRequirement(requiredDoc, uploads);
    if (!matched) {
      console.log(`  \u2717 Missing: "${requiredDoc}"`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: null,
        issue: `Required document not uploaded: ${requiredDoc}`
      });
      continue;
    }
    const { data: data2, error } = await supabase.storage.from("customer-uploads").download(matched.storagePath);
    if (error || !data2) {
      console.warn(`  \u26A0 Failed to download ${matched.storagePath}: ${error?.message}`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: matched.filename,
        issue: "File could not be retrieved for review \u2014 please re-upload."
      });
      continue;
    }
    const buffer = Buffer.from(await data2.arrayBuffer());
    console.log(`  Reviewing "${matched.filename}" for: ${requiredDoc}`);
    const review = await reviewDocument(client2, requiredDoc, buffer, matched.filename);
    if (!review.acceptable) {
      console.log(`  \u2717 Issue: ${review.issue}`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: matched.filename,
        issue: review.issue ?? "Document did not pass review."
      });
    } else {
      console.log(`  \u2713 Accepted: "${matched.filename}"`);
    }
  }
  const status = issues.length === 0 ? "complete" : "incomplete";
  console.log(`  Review result: ${status} (${issues.length} issue(s))`);
  await logAuditEvent({
    eventType: "document_review_complete",
    entityType: "order",
    entityId: orderId,
    customerId,
    metadata: {
      creditCode,
      status,
      issueCount: issues.length,
      uploadCount: uploads.length,
      requiredCount: requiredDocs.length
    }
  });
  return {
    orderId,
    creditCode,
    status,
    issues,
    reviewedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var import_sdk, path2, fs3, envPath, DOCUMENT_REVIEW_PROMPT;
var init_document_review = __esm({
  "pipeline/document-review.ts"() {
    "use strict";
    import_sdk = __toESM(require("@anthropic-ai/sdk"));
    path2 = __toESM(require("path"));
    fs3 = __toESM(require("fs"));
    init_supabase();
    init_extract_xlsx_row();
    init_pdf_to_images();
    init_supabase_ops();
    envPath = path2.resolve(__dirname, "../.env.local");
    if (fs3.existsSync(envPath)) {
      for (const line of fs3.readFileSync(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
    DOCUMENT_REVIEW_PROMPT = `You are a LEED certification specialist reviewing a document submitted by a project team. Your task is to assess whether this document is complete, legible, and appropriate for the stated purpose.

You will be told what document type is required. Review the provided file and determine:
1. Is this the correct document type?
2. Is it complete (not truncated, not blank, not corrupted)?
3. Is it legible and professionally prepared?
4. Does it contain the key information normally expected in this document type?

Respond with a single JSON object:
{
  "acceptable": boolean,
  "issue": string | null
}

Set "acceptable" to true if the document is suitable for LEED submission.
Set "acceptable" to false and provide a concise "issue" string describing the specific problem.
The "issue" string must be written for the project team to read \u2014 be specific and actionable.
Return only the JSON object.`;
  }
});

// pipeline/drawing-analysis.ts
async function analyzeDrawings(projectId, customerId, drawingPaths) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const supabase = createServiceClient();
  console.log(`[drawing-analysis] project=${projectId} drawings=${drawingPaths.length}`);
  const tmpDir = fs4.mkdtempSync(path3.join(os.tmpdir(), "certify-drawings-"));
  const localPaths = [];
  try {
    for (const drawingPath of drawingPaths) {
      const { data: data2, error } = await supabase.storage.from("customer-uploads").download(drawingPath);
      if (error || !data2) throw new Error(`Download failed: ${drawingPath} \u2014 ${error?.message}`);
      const filename2 = drawingPath.split("/").pop() ?? `drawing_${localPaths.length}.pdf`;
      const localPath = path3.join(tmpDir, filename2);
      fs4.writeFileSync(localPath, Buffer.from(await data2.arrayBuffer()));
      localPaths.push(localPath);
      console.log(`  \u2713 downloaded ${filename2}`);
    }
    const args = [
      PYTHON_SCRIPT,
      "--project-id",
      projectId,
      "--customer-id",
      customerId,
      "--output-dir",
      tmpDir,
      ...localPaths
    ];
    console.log(`  Running analyze_drawings.py (timeout ${TIMEOUT_MS / 1e3}s)...`);
    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(PYTHON_BIN, args, {
        timeout: TIMEOUT_MS,
        env: { ...process.env },
        maxBuffer: 50 * 1024 * 1024
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err) {
      stderr = err.stderr ?? "";
      stdout = err.stdout ?? "";
      if (stderr) console.error(`  [python stderr]
${stderr}`);
      throw new Error(`analyze_drawings.py failed: ${err.message}`);
    }
    if (stderr.trim()) console.warn(`  [python stderr]
${stderr.trim()}`);
    const resultMarker = "__RESULT__";
    const markerIdx = stdout.lastIndexOf(resultMarker);
    if (markerIdx === -1) throw new Error("analyze_drawings.py produced no __RESULT__ block");
    const logOutput = stdout.slice(0, markerIdx).trim();
    if (logOutput) console.log(logOutput);
    const summary = JSON.parse(stdout.slice(markerIdx + resultMarker.length).trim());
    if (!summary.success) throw new Error("analyze_drawings.py reported failure");
    const profileJson = fs4.readFileSync(summary.profile_path, "utf-8");
    const profileRemote = `${customerId}/${projectId}/project-profile.json`;
    const { error: profileUploadErr } = await supabase.storage.from("customer-uploads").upload(profileRemote, new Blob([profileJson], { type: "application/json" }), { upsert: true });
    if (profileUploadErr) throw new Error(`profile upload failed: ${profileUploadErr.message}`);
    console.log(`  \u2713 uploaded project-profile.json`);
    const annotatedRemotePaths = [];
    for (const localAnnotated of summary.annotated_pdfs) {
      const filename2 = path3.basename(localAnnotated);
      const remotePath = `${customerId}/${projectId}/outputs/${filename2}`;
      const pdfBytes = fs4.readFileSync(localAnnotated);
      const { error: pdfUploadErr } = await supabase.storage.from("customer-uploads").upload(remotePath, new Blob([pdfBytes], { type: "application/pdf" }), { upsert: true });
      if (pdfUploadErr) {
        console.warn(`  [WARN] annotated PDF upload failed: ${pdfUploadErr.message}`);
      } else {
        annotatedRemotePaths.push(remotePath);
        console.log(`  \u2713 uploaded ${filename2}`);
      }
    }
    const profile = JSON.parse(profileJson);
    const fixtures = profile.plumbing_fixtures ?? {};
    const parking = profile.parking ?? {};
    const site = profile.site ?? {};
    const tokenUsage = profile._token_usage;
    const updatePayload = {
      auto_extracted: true,
      flagged_fields: summary.flagged_fields,
      drawings_analyzed_at: (/* @__PURE__ */ new Date()).toISOString(),
      drawing_data: profile,
      ...profile.project_name ? { name: profile.project_name } : {},
      ...profile.project_address ? { address: profile.project_address } : {},
      ...profile.building_type ? { building_type: profile.building_type } : {},
      ...profile.primary_occupancy ? { primary_occupancy: profile.primary_occupancy } : {},
      ...fixtures ? { plumbing_fixtures: fixtures } : {},
      ...parking.total_spaces != null ? { total_parking: parking.total_spaces } : {},
      ...parking.accessible_spaces != null ? { accessible_parking: parking.accessible_spaces } : {},
      ...parking.bicycle_spaces != null ? { bicycle_parking: parking.bicycle_spaces } : {},
      ...site.site_area_sqft != null ? { site_area_sqft: site.site_area_sqft } : {},
      ...site.landscaping_area_sqft != null ? { landscaping_sqft: site.landscaping_area_sqft } : {},
      ...site.impervious_surface_sqft != null ? { impervious_sqft: site.impervious_surface_sqft } : {},
      ...site.building_footprint_sqft != null ? { building_footprint_sqft: site.building_footprint_sqft } : {}
    };
    const { error: updateErr } = await supabase.from("projects").update(updatePayload).eq("id", projectId);
    if (updateErr) throw new Error(`projects update failed: ${updateErr.message}`);
    console.log(`  \u2713 updated projects table`);
    await logAuditEvent({
      eventType: "drawing_analysis_complete",
      entityType: "project",
      entityId: projectId,
      customerId,
      metadata: {
        sheetsAnalyzed: summary.sheets_analyzed,
        flaggedFields: summary.flagged_fields,
        annotatedPdfs: annotatedRemotePaths.length,
        elapsedSeconds: summary.elapsed_seconds,
        inputTokens: tokenUsage?.input_tokens ?? 0,
        outputTokens: tokenUsage?.output_tokens ?? 0
      }
    });
    return {
      projectId,
      sheetsAnalyzed: summary.sheets_analyzed,
      flaggedFields: summary.flagged_fields,
      profilePath: profileRemote,
      annotatedPdfs: annotatedRemotePaths,
      tokenUsage: tokenUsage ?? { input_tokens: 0, output_tokens: 0 },
      elapsedSeconds: summary.elapsed_seconds
    };
  } finally {
    try {
      fs4.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
    }
  }
}
var path3, fs4, os, import_child_process, import_util, execFileAsync, PYTHON_SCRIPT, PYTHON_BIN, TIMEOUT_MS;
var init_drawing_analysis = __esm({
  "pipeline/drawing-analysis.ts"() {
    "use strict";
    path3 = __toESM(require("path"));
    fs4 = __toESM(require("fs"));
    os = __toESM(require("os"));
    import_child_process = require("child_process");
    import_util = require("util");
    init_supabase();
    init_supabase_ops();
    execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
    PYTHON_SCRIPT = path3.resolve(__dirname, "lib/analyze_drawings.py");
    PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
    TIMEOUT_MS = 18e4;
  }
});

// pipeline/lib/pipeline-utils.ts
async function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== void 0) clearTimeout(timer);
  }
}
async function axiosGetWithRetry(url, options = {}, timeoutMs = 1e4, label = "HTTP GET") {
  const opts = { ...options, timeout: timeoutMs };
  try {
    return await import_axios.default.get(url, opts);
  } catch (err) {
    console.warn(`  \u26A0 ${label} failed \u2014 retrying after 2 s: ${err.message}`);
    await new Promise((r) => setTimeout(r, 2e3));
    return import_axios.default.get(url, opts);
  }
}
var import_axios;
var init_pipeline_utils = __esm({
  "pipeline/lib/pipeline-utils.ts"() {
    "use strict";
    import_axios = __toESM(require("axios"));
  }
});

// pipeline/map-generation.ts
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
async function getRoute(origin, dest, mode = "walking") {
  const key = MAPS_API_KEY();
  const res = await axiosGetWithRetry(
    "https://maps.googleapis.com/maps/api/directions/json",
    { params: { origin, destination: dest.address, mode, alternatives: false, key } },
    1e4,
    `Directions API (${mode}): ${dest.address}`
  );
  const data2 = res.data;
  if (data2.status !== "OK" || !data2.routes?.length) {
    console.warn(`  \u26A0 No route: ${origin} \u2192 ${dest.address} (${data2.status})`);
    return null;
  }
  const route = data2.routes[0];
  const leg = route.legs[0];
  const encodedPolyline = route.overview_polyline.points;
  return {
    destination: dest,
    distanceFeet: Math.round(leg.distance.value * 3.28084),
    distanceMiles: parseFloat((leg.distance.value / 1609.34).toFixed(2)),
    durationMinutes: Math.round(leg.duration.value / 60),
    encodedPolyline,
    polylinePoints: decodePolyline(encodedPolyline),
    originLatLng: { lat: leg.start_location.lat, lng: leg.start_location.lng },
    destLatLng: { lat: leg.end_location.lat, lng: leg.end_location.lng }
  };
}
async function getWalkingRoute(origin, dest) {
  return getRoute(origin, dest, "walking");
}
async function fetchMapWithRoutes(routes, visibleCorners, imgWidth, imgHeight) {
  const key = MAPS_API_KEY();
  const scale2 = 2;
  const base = "https://maps.googleapis.com/maps/api/staticmap";
  const params = [
    `size=${imgWidth / scale2}x${imgHeight / scale2}`,
    `scale=${scale2}`,
    `maptype=roadmap`,
    `style=feature:poi|visibility:off`,
    `style=feature:transit|element:labels|visibility:off`,
    `key=${key}`
  ];
  for (const pt of visibleCorners) {
    params.push(`visible=${pt.lat},${pt.lng}`);
  }
  const origin = routes[0].originLatLng;
  params.push(`markers=color:0x2b4044|size:mid|label:S|${origin.lat},${origin.lng}`);
  for (const route of routes) {
    const label = route.destination.label.slice(0, 1);
    params.push(`markers=color:0x327cb9|size:mid|label:${label}|${route.destLatLng.lat},${route.destLatLng.lng}`);
  }
  for (const route of routes) {
    params.push(`path=color:0x327cb9CC|weight:4|enc:${encodeURIComponent(route.encodedPolyline)}`);
  }
  const url = `${base}?${params.join("&")}`;
  const res = await axiosGetWithRetry(url, { responseType: "arraybuffer" }, 1e4, "Static Maps API");
  return Buffer.from(res.data);
}
async function addCitationOverlay(imageBuffer, citationText, width, height) {
  const sharp2 = (await import("sharp")).default;
  const lines = citationText.split("\n");
  const lineH = 14;
  const padding = 6;
  const boxH = lines.length * lineH + padding * 2;
  const boxW = Math.max(...lines.map((l) => l.length)) * 6.5 + padding * 2;
  const boxX = width - boxW - 8;
  const boxY = height - boxH - 8;
  const textEls = lines.map(
    (line, i) => `<text x="${boxX + padding}" y="${boxY + padding + lineH * i + 10}"
           font-family="Arial, sans-serif" font-size="10" fill="#444444">${line}</text>`
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="3" fill="white" opacity="0.82"/>
    ${textEls}
  </svg>`;
  return sharp2(imageBuffer).resize(width, height, { fit: "cover" }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}
async function generateMap(request) {
  const WIDTH = 1200;
  const HEIGHT = 900;
  console.log(`[map-generation] ${request.mapType} \u2014 ${request.destinations.length} destination(s)`);
  const routes = [];
  for (const dest of request.destinations) {
    const route = await getWalkingRoute(request.originAddress, dest);
    if (route) routes.push(route);
  }
  if (routes.length === 0) throw new Error("No walking routes returned from Google Maps Directions API");
  const allPoints = routes.flatMap((r) => r.polylinePoints);
  allPoints.push(routes[0].originLatLng);
  routes.forEach((r) => allPoints.push(r.destLatLng));
  const lats = allPoints.map((p) => p.lat);
  const lngs = allPoints.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latPad = (maxLat - minLat) * 0.15;
  const lngPad = (maxLng - minLng) * 0.15;
  const visibleCorners = [
    { lat: minLat - latPad, lng: minLng - lngPad },
    { lat: minLat - latPad, lng: maxLng + lngPad },
    { lat: maxLat + latPad, lng: minLng - lngPad },
    { lat: maxLat + latPad, lng: maxLng + lngPad }
  ];
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  console.log(`  Center: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}  bounds: \xB1${(latPad * 111).toFixed(2)}km lat / \xB1${(lngPad * 111 * Math.cos(centerLat * Math.PI / 180)).toFixed(2)}km lng padding`);
  console.log(`  Fetching map with ${routes.length} encoded polyline route(s)...`);
  const mapImage = await fetchMapWithRoutes(routes, visibleCorners, WIDTH, HEIGHT);
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const citationText = `Source: Google Maps \u2014 Walking distances along pedestrian routes.
${today}`;
  const pngBuffer = await addCitationOverlay(mapImage, citationText, WIDTH, HEIGHT);
  if (request.outputPath) {
    const { mkdirSync: mkdirSync2, writeFileSync: writeFileSync5 } = await import("fs");
    mkdirSync2(path4.dirname(request.outputPath), { recursive: true });
    writeFileSync5(request.outputPath, pngBuffer);
    console.log(`  \u2713 Map saved: ${request.outputPath}`);
  }
  console.log(`  \u2713 Map generated (${Math.round(pngBuffer.length / 1024)} KB PNG)`);
  routes.forEach(
    (r) => console.log(`    \u2022 ${r.destination.label}: ${r.distanceFeet.toLocaleString()} ft (${r.durationMinutes} min walk)`)
  );
  return { pngBuffer, routes, mapType: request.mapType };
}
var path4, fs5, envPath2, MAPS_API_KEY;
var init_map_generation = __esm({
  "pipeline/map-generation.ts"() {
    "use strict";
    path4 = __toESM(require("path"));
    fs5 = __toESM(require("fs"));
    init_pipeline_utils();
    envPath2 = path4.resolve(__dirname, "../.env.local");
    if (fs5.existsSync(envPath2)) {
      for (const line of fs5.readFileSync(envPath2, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
    MAPS_API_KEY = () => {
      const key = process.env.GOOGLE_MAPS_API_KEY;
      if (!key) throw new Error("GOOGLE_MAPS_API_KEY not set in .env.local");
      return key;
    };
  }
});

// pipeline/lib/make-editable.ts
function injectTableCss(html) {
  const tag = `<style id="liminal-css">${LIMINAL_CSS}
</style>`;
  let result = html;
  const headIdx = result.indexOf("</head>");
  if (headIdx !== -1) {
    result = result.slice(0, headIdx) + tag + "\n" + result.slice(headIdx);
  } else {
    result = tag + "\n" + result;
  }
  result = result.replace(/<body([^>]*)>/i, (_match, attrs = "") => {
    if (attrs.toLowerCase().includes("margin")) return _match;
    return `<body${attrs} style="margin: 0 20%; padding: 40px 0; box-sizing: border-box;">`;
  });
  return result;
}
function addContentEditable(html) {
  return html.replace(/<(p|td|th|h[1-6]|li)(\s[^>]*)?>/gi, (match, tag, attrs = "") => {
    if (attrs.toLowerCase().includes("contenteditable")) return match;
    return `<${tag}${attrs} contenteditable="true">`;
  });
}
function makeEditable(html) {
  let result = injectTableCss(html);
  result = result.replace(/<body([^>]*)>/i, (match) => match + "\n" + BANNER_HTML);
  result = addContentEditable(result);
  return result;
}
var LIMINAL_CSS, BANNER_HTML;
var init_make_editable = __esm({
  "pipeline/lib/make-editable.ts"() {
    "use strict";
    LIMINAL_CSS = `
  /* Base */
  body { font-family: Arial, Helvetica, sans-serif; color: #515062; background: #ffffff; margin: 0 20%; padding: 40px 0; box-sizing: border-box; font-size: 13px; }
  a { color: #327cb9; }
  h2 { color: #327cb9; font-size: 15px; margin: 20px 0 6px 0; }
  h3 { color: #515062; font-size: 13px; margin: 14px 0 4px 0; font-weight: bold; }
  h4 { color: #515062; font-size: 0.97em; margin: 14px 0 4px 0; }

  /* Page header */
  .page-header { background: #327cb9; color: #ffffff; padding: 22px 32px 16px 32px; }
  .page-header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: bold; color: #ffffff; }
  .page-header .sub { font-size: 13px; opacity: 0.88; }

  /* Section structure */
  .section-header { background: #327cb9; color: #ffffff; font-weight: bold; font-size: 13px; padding: 8px 14px; margin: 22px 0 0 0; border-radius: 3px 3px 0 0; }
  .section-subheader { background: #abcde8; color: #327cb9; font-weight: bold; font-size: 12px; padding: 6px 14px; margin: 14px 0 0 0; border-radius: 3px 3px 0 0; border: 1px solid #cccccc; border-bottom: none; }
  .section-body { border: 1px solid #cccccc; border-top: none; padding: 16px 18px; background: #ffffff; }
  .section-wrap { padding: 0 24px 18px 24px; }
  .meta-bar { background: #abcde8; padding: 10px 24px; font-size: 0.92em; display: flex; flex-wrap: wrap; gap: 24px; }
  .meta-bar span { font-weight: bold; color: #327cb9; }
  .form-id-bar { background: #abcde8; padding: 8px 18px; font-weight: bold; font-size: 13px; color: #327cb9; border-bottom: 2px solid #327cb9; }
  .divider { border: none; border-top: 1px solid #cccccc; margin: 18px 0; }

  /* Form fields */
  .field-row { display: flex; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
  .field-label { font-weight: bold; color: #327cb9; min-width: 220px; font-size: 12px; }
  .field-id { font-family: monospace; font-size: 10px; color: #888; background: #f0f4f8; border-radius: 3px; padding: 1px 5px; display: inline-block; margin-bottom: 2px; }
  .field-value { color: #515062; flex: 1; }
  .field-value.filled { background: #e8f0f7; border-left: 3px solid #327cb9; padding: 5px 10px; border-radius: 0 3px 3px 0; }
  .field-value.upload { background: #fff3cd; border-left: 3px solid #ffc107; padding: 5px 10px; border-radius: 0 3px 3px 0; color: #856404; }
  .owner-field { background: #fff3cd; border: 1px dashed #ffc107; border-radius: 3px; padding: 4px 10px; color: #856404; font-style: italic; display: inline-block; margin: 2px 0; }
  .radio-selected { display: inline-block; background: #327cb9; color: #fff; border-radius: 50%; width: 14px; height: 14px; text-align: center; line-height: 14px; font-size: 10px; margin-right: 6px; }
  .radio-unselected { display: inline-block; border: 2px solid #aaa; border-radius: 50%; width: 12px; height: 12px; margin-right: 6px; vertical-align: middle; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0; table-layout: fixed; word-wrap: break-word; }
  thead tr th { background: #327cb9; color: #ffffff; font-weight: bold; padding: 8px; text-align: left; border: 1px solid #cccccc; }
  tbody tr:nth-child(odd) { background: #ffffff; }
  tbody tr:nth-child(even) { background: #e8f0f7; }
  tbody tr td { padding: 7px 8px; border: 1px solid #cccccc; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; max-width: 0; }
  th { word-wrap: break-word; overflow-wrap: break-word; }
  @media print { table { page-break-inside: avoid; } }

  /* Calculation boxes */
  .calc-box { background: #f4f8fc; border: 1px solid #327cb9; border-radius: 4px; padding: 14px 18px; margin: 10px 0; font-family: monospace; font-size: 12px; color: #515062; }
  .calc-box .step { margin-bottom: 6px; }

  /* Compliance results */
  .result-pass { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .result-fail { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .result-warn { background: #fff3cd; color: #856404; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .pass { color: #155724; font-weight: bold; }
  .fail { color: #721c24; font-weight: bold; }
  .point-box { background: #327cb9; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 16px; font-weight: bold; margin: 10px 0; }
  .point-box-pending { background: #856404; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 16px; font-weight: bold; margin: 10px 0; }
  .score-box { background: #327cb9; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 1.1em; font-weight: bold; margin: 10px 0; }
  .compliance-threshold-box { background: #f4f8fc; border: 2px solid #327cb9; border-radius: 6px; padding: 16px 20px; margin: 14px 0; }
  .compliance-threshold-box .threshold-label { font-weight: bold; color: #327cb9; font-size: 13px; }
  .compliance-threshold-box .threshold-value { font-size: 22px; font-weight: bold; color: #515062; }
  .compliance-threshold-box .threshold-limit { font-size: 13px; color: #515062; }

  /* Notes and callouts */
  .note { background: #abcde8; border-left: 4px solid #327cb9; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }
  .info-box { background: #e8f0f7; border-left: 4px solid #327cb9; padding: 10px 16px; margin: 10px 0 16px 0; font-size: 0.93em; }
  .warn-note { background: #fff3cd; border-left: 4px solid #ffc107; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }
  .warn-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px 16px; margin: 10px 0 16px 0; font-size: 0.93em; }
  .alert-note { background: #f8d7da; border-left: 4px solid #dc3545; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }

  /* Submission checklist badges */
  .badge-provided { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .badge-required { background: #fff3cd; color: #856404; border: 1px solid #ffc107; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .badge-incomplete { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .checklist-item { border: 1px solid #cccccc; border-radius: 4px; padding: 12px 16px; margin-bottom: 10px; }
  .checklist-item h4 { margin: 0 0 4px 0; font-size: 13px; color: #327cb9; }
  .checklist-item p { margin: 3px 0; font-size: 12px; }
  .checklist-item .item-title { font-weight: bold; font-size: 0.97em; color: #327cb9; }
  .checklist-item .item-detail { font-size: 0.91em; margin-top: 4px; color: #515062; }
  ul.checklist-list { list-style: none; padding: 0; margin: 0; }
  ul.checklist-list li { padding: 4px 0; border-bottom: 1px solid #e8f0f7; font-size: 12px; }
  ul.checklist-list li:last-child { border-bottom: none; }

  /* Layout helpers */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .plan-section { border: 1px solid #cccccc; border-radius: 4px; padding: 14px 18px; margin: 12px 0; }
  .plan-section h4 { color: #327cb9; margin: 0 0 8px 0; font-size: 13px; border-bottom: 1px solid #abcde8; padding-bottom: 4px; }
  .signature-block { border: 1px solid #cccccc; border-radius: 4px; padding: 14px 18px; margin: 12px 0; background: #f9f9f9; }
  .sig-line { border-bottom: 1px solid #515062; min-width: 250px; display: inline-block; margin: 0 10px; height: 20px; }
  .processing-summary { background: #f4f8fc; border: 2px solid #327cb9; border-radius: 6px; padding: 18px 22px; margin: 24px 0; }
  .processing-summary h3 { color: #327cb9; margin: 0 0 10px 0; font-size: 14px; }
  .source-note { font-size: 10px; color: #888; font-style: italic; }
  .map-placeholder { background: #e8f0f7; border: 2px dashed #327cb9; border-radius: 6px; padding: 28px; text-align: center; color: #327cb9; font-size: 1em; margin: 14px 0; }`;
    BANNER_HTML = `
<div class="liminal-edit-banner" style="background:#abcde8;color:#2b4044;padding:12px 16px;font-size:13px;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:9999;box-shadow:0 2px 4px rgba(0,0,0,0.12);">
  <span style="flex:1;">This document is editable. Click any text to edit it directly. When finished, use <strong>File &rarr; Print &rarr; Save as PDF</strong> in your browser to save your edited version. Your edits are saved on your computer only &mdash; nothing is sent to the server.</span>
  <button onclick="window.print()" style="background:#327cb9;color:white;border:none;padding:8px 16px;border-radius:4px;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit;font-weight:600;">Print to PDF</button>
</div>
<style>
  @media print {
    .liminal-edit-banner { display: none !important; }
  }
  [contenteditable="true"]:focus {
    outline: 2px solid #327cb9;
    outline-offset: 1px;
    border-radius: 2px;
    background: #f0f6fc;
  }
  [contenteditable="true"] {
    cursor: text;
    min-height: 1em;
  }
</style>`;
  }
});

// pipeline/lib/policy-generator.ts
function detectPolicyRequirements(creditRow) {
  const fragments = creditRow.split(/[;\|\n]|(?<=[a-z])\s+and\s+(?=[a-z])/i).map((s) => s.trim()).filter((s) => s.length > 10);
  const found = [];
  const seen = /* @__PURE__ */ new Set();
  for (const fragment of fragments) {
    if (!POLICY_PATTERNS.some((p) => p.test(fragment))) continue;
    const label = derivePolicyLabel(fragment);
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    found.push({ rawText: fragment, policyType: label });
  }
  return found;
}
function derivePolicyLabel(text) {
  const clean = text.replace(/^(submit|provide|upload|include|attach|signed|written|completed|approved)\s+/i, "").replace(/\s+(on\s+(company|organization|project)\s+letterhead.*|signed\s+by.*|as\s+required.*)$/i, "").replace(/\s+\(.*?\)/g, "").trim();
  return clean.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ").slice(0, 80);
}
function findMatchingUpload(policyType, uploads) {
  if (uploads.length === 0) return null;
  const stopWords = /* @__PURE__ */ new Set(["a", "an", "the", "and", "or", "of", "for", "in", "on", "to", "policy"]);
  const typeTokens = new Set(
    policyType.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !stopWords.has(t))
  );
  let best = null;
  let bestScore = 0;
  for (const upload of uploads) {
    const nameTokens = upload.filename.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    const contentTokens = upload.text.slice(0, 500).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    const allTokens = /* @__PURE__ */ new Set([...nameTokens, ...contentTokens]);
    let score = 0;
    for (const t of typeTokens) {
      if (allTokens.has(t)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = upload;
    }
  }
  return bestScore >= 1 ? best : null;
}
async function generatePolicyHtml(client2, requirement, context, usage2) {
  const prompt = `You are drafting a formal policy document for a building certification submission.

CREDIT / FEATURE: ${context.creditName}
CERTIFICATION PROGRAM: ${context.certProgram}
PROJECT ADDRESS: ${context.projectAddress}

POLICY REQUIRED: ${requirement.policyType}
ORIGINAL REQUIREMENT TEXT: ${requirement.rawText}

CREDIT REQUIREMENTS (for context on what the policy must address):
${context.creditRequirementsText}

CREDIT AUTOMATION ANALYSIS ROW:
${context.creditRow}

TASK:
Draft a complete, professional policy document that satisfies the above requirement for certification submission.

RULES:
1. Output ONLY the HTML body content \u2014 no DOCTYPE, no <html>, no <head>, no <body> tags.
2. Use placeholder fields in ALL CAPS in square brackets for any information the organization must supply:
   - [ORGANIZATION NAME]
   - [BUILDING NAME / ADDRESS]
   - [EFFECTIVE DATE]
   - [POLICY REVIEW DATE]
   - [AUTHORIZED SIGNATORY NAME]
   - [AUTHORIZED SIGNATORY TITLE]
   - [DEPARTMENT / CONTACT NAME]
   - Any other project-specific fields
3. The policy must address every requirement listed in the credit/feature for this document type.
4. Include all standard policy sections: Purpose, Scope, Policy Statement, Procedures/Requirements, Responsibilities, Review and Update.
5. Write in formal organizational policy language \u2014 clear, specific, and actionable.
6. The policy must be complete enough to submit directly after the owner fills in the placeholders and signs.
7. Do not include any narration, preamble, or explanation \u2014 output the policy document only.
8. Use clean HTML with inline styles matching this color scheme:
   - Headers: color #2b4044
   - Body text: color #1a1a1a, font-family Arial, font-size 13px
   - Section headers: color #327cb9, border-bottom 1px solid #327cb9
   - Placeholder fields: background #fff3cd, color #856404, padding 0 4px, border-radius 2px
   - Signature block: border-top 2px solid #2b4044, margin-top 40px, padding-top 16px`;
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8e3,
    temperature: 0,
    messages: [{ role: "user", content: prompt }]
  });
  usage2.input += response.usage.input_tokens;
  usage2.output += response.usage.output_tokens;
  return response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
async function reviewPolicyHtml(client2, requirement, existingPolicy, context, usage2) {
  const prompt = `You are a certification compliance specialist reviewing an existing organizational policy.

CREDIT / FEATURE: ${context.creditName}
CERTIFICATION PROGRAM: ${context.certProgram}
PROJECT ADDRESS: ${context.projectAddress}

POLICY BEING REVIEWED: ${requirement.policyType}
ORIGINAL REQUIREMENT TEXT: ${requirement.rawText}
SOURCE FILE: ${existingPolicy.filename}

CREDIT REQUIREMENTS (every item the policy must address for certification):
${context.creditRequirementsText}

CREDIT AUTOMATION ANALYSIS ROW:
${context.creditRow}

EXISTING POLICY TEXT:
${existingPolicy.text}

TASK:
Review the existing policy against the certification requirements above. Identify any compliance gaps \u2014 requirements the policy does not currently address \u2014 and produce a complete updated version of the policy that fills those gaps.

RULES:
1. Output ONLY the HTML body content \u2014 no DOCTYPE, no <html>, no <head>, no <body> tags.
2. Preserve all existing policy content. Do not remove, weaken, or reword any existing provisions unless they directly conflict with the certification requirements.
3. For every compliance gap, add the missing content clearly marked with:
   <span style="background:#d1ecf1;color:#0c5460;padding:0 4px;border-radius:2px;font-size:11px;">[ADDED FOR ${context.certProgram.includes("WELL") ? "WELL" : "LEED"} COMPLIANCE]</span>
4. If existing text needs minor revision to meet a requirement, add the corrected version immediately after the original line, marked:
   <span style="background:#f8d7da;color:#721c24;padding:0 4px;border-radius:2px;font-size:11px;">[REVISED FOR COMPLIANCE \u2014 replace line above]</span>
5. Use placeholder fields in ALL CAPS in square brackets for any missing organizational details:
   - [ORGANIZATION NAME], [AUTHORIZED SIGNATORY NAME], [EFFECTIVE DATE], etc.
6. If the policy already fully satisfies all requirements, output the policy as clean HTML with no changes marked \u2014 just confirm coverage.
7. Do not include any narration, preamble, or explanation \u2014 output the updated policy document only.
8. Use clean HTML with inline styles:
   - Headers: color #2b4044
   - Body text: color #1a1a1a, font-family Arial, font-size 13px
   - Section headers: color #327cb9, border-bottom 1px solid #327cb9
   - Placeholder fields: background #fff3cd, color #856404, padding 0 4px, border-radius 2px
   - Signature block: border-top 2px solid #2b4044, margin-top 40px, padding-top 16px`;
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8e3,
    temperature: 0,
    messages: [{ role: "user", content: prompt }]
  });
  usage2.input += response.usage.input_tokens;
  usage2.output += response.usage.output_tokens;
  return response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
function policySlug(creditSlug, policyType, mode) {
  const policyPart = policyType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  const suffix = mode === "reviewed" ? "reviewed" : "draft";
  return `${creditSlug}-${policyPart}-${suffix}`;
}
async function generatePolicyDrafts(client2, creditRow, context, usage2) {
  const requirements = detectPolicyRequirements(creditRow);
  if (requirements.length === 0) {
    console.log(`  [policy] No policy requirements detected in Column 1`);
    return [];
  }
  console.log(`  [policy] ${requirements.length} policy requirement(s) detected:`);
  requirements.forEach((r) => console.log(`    \u2022 ${r.policyType}`));
  const uploads = context.uploadedDocuments ?? [];
  const drafts = [];
  for (const req of requirements) {
    const t0 = Date.now();
    const match = findMatchingUpload(req.policyType, uploads);
    const mode = match ? "reviewed" : "new-draft";
    if (match) {
      console.log(`  [policy] Reviewing uploaded policy for: ${req.policyType} (source: ${match.filename})...`);
    } else {
      console.log(`  [policy] Drafting new policy for: ${req.policyType}...`);
    }
    try {
      const bodyHtml = match ? await reviewPolicyHtml(client2, req, match, {
        creditName: context.creditName,
        certProgram: context.certProgram,
        projectAddress: context.projectAddress,
        creditRequirementsText: context.creditRequirementsText,
        creditRow
      }, usage2) : await generatePolicyHtml(client2, req, {
        creditName: context.creditName,
        certProgram: context.certProgram,
        projectAddress: context.projectAddress,
        creditRequirementsText: context.creditRequirementsText,
        creditRow
      }, usage2);
      const slug = policySlug(context.creditSlug, req.policyType, mode);
      const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const fullHtml = wrapPolicyHtml(bodyHtml, req.policyType, context.creditName, today, mode, match?.filename);
      const editableHtml = makeEditable(fullHtml);
      const outputPath = path5.join(context.outputDir, `${slug}.html`);
      fs6.mkdirSync(context.outputDir, { recursive: true });
      fs6.writeFileSync(outputPath, editableHtml);
      const modeLabel = mode === "reviewed" ? "reviewed + updated" : "new draft";
      console.log(`  [policy] \u2713 ${req.policyType} \u2014 ${modeLabel} \u2014 ${Math.round(editableHtml.length / 1024)} KB \u2192 ${path5.basename(outputPath)} (${((Date.now() - t0) / 1e3).toFixed(1)}s)`);
      drafts.push({
        policyType: req.policyType,
        mode,
        filename: path5.basename(outputPath),
        outputPath,
        html: editableHtml,
        tokensIn: 0,
        tokensOut: 0
      });
    } catch (err) {
      console.warn(`  [policy] \u26A0 Failed to process "${req.policyType}": ${err.message}`);
    }
  }
  return drafts;
}
function wrapPolicyHtml(body, policyType, creditName, date, mode, sourceFile) {
  const banner = mode === "reviewed" ? `<div class="draft-banner" style="background:#d1ecf1;border-color:#bee5eb;color:#0c5460;">
  <strong>REVIEWED &amp; UPDATED \u2014 Compliance Review Complete</strong><br/>
  This policy was reviewed against ${escHtml(creditName)} requirements on ${escHtml(date)}.
  ${sourceFile ? `Source file: <em>${escHtml(sourceFile)}</em>. ` : ""}
  Sections marked <span style="background:#d1ecf1;color:#0c5460;padding:0 3px;border-radius:2px;">[ADDED FOR COMPLIANCE]</span>
  or <span style="background:#f8d7da;color:#721c24;padding:0 3px;border-radius:2px;">[REVISED FOR COMPLIANCE]</span>
  were added or amended to meet certification requirements. Review all changes, then have an authorized representative sign before submitting.
</div>` : `<div class="draft-banner">
  <strong>DRAFT \u2014 Review Required Before Submission</strong><br/>
  Complete all <span style="background:#fff3cd;color:#856404;padding:0 3px;border-radius:2px;">[PLACEHOLDER]</span> fields,
  have an authorized representative review the document, and obtain a wet or electronic signature before submitting to the certification reviewer.
  This draft was generated on ${escHtml(date)}.
</div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(policyType)} \u2014 ${mode === "reviewed" ? "Reviewed" : "Draft"}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 32px; max-width: 860px; }
    h1   { font-size: 20px; color: #2b4044; border-bottom: 2px solid #2b4044; padding-bottom: 8px; margin-bottom: 4px; }
    h2   { font-size: 14px; color: #327cb9; border-bottom: 1px solid #327cb9; padding-bottom: 4px; margin-top: 24px; }
    h3   { font-size: 13px; color: #2b4044; margin-top: 16px; }
    p, li { line-height: 1.6; margin-bottom: 8px; }
    .draft-banner {
      background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;
      padding: 10px 16px; margin-bottom: 24px; font-size: 12px; color: #856404;
    }
    .draft-banner strong { font-size: 13px; }
    .credit-ref { font-size: 11px; color: #666; margin-bottom: 24px; }
  </style>
</head>
<body>

${banner}

<h1>${escHtml(policyType)}</h1>
<div class="credit-ref">${mode === "reviewed" ? "Reviewed for" : "Generated for"}: ${escHtml(creditName)}</div>

${body}

</body>
</html>`;
}
function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function policyChecklistHtml(drafts) {
  if (drafts.length === 0) return "";
  const items = drafts.map((d) => {
    const isReviewed = d.mode === "reviewed";
    const badge = isReviewed ? `<span style="background:#d1ecf1;color:#0c5460;border:1px solid #bee5eb;border-radius:3px;padding:2px 8px;font-size:11px;font-weight:bold;">\u2713 REVIEWED &amp; UPDATED</span>` : `<span style="background:#d4edda;color:#155724;border:1px solid #c3e6cb;border-radius:3px;padding:2px 8px;font-size:11px;font-weight:bold;">\u2713 DRAFT PROVIDED</span>`;
    const action = isReviewed ? "Review all compliance additions/revisions marked in the document, confirm with your team, then obtain authorized signature before submitting." : "Review draft, fill all [PLACEHOLDER] fields, and obtain authorized signature before submitting.";
    return `
  <tr>
    <td style="padding:8px 12px;border-bottom:1px solid #dee2e6;">
      <strong>${escHtml(d.policyType)}</strong><br/>
      <span style="font-size:11px;color:#666;">File: ${escHtml(d.filename)}</span>
    </td>
    <td style="padding:8px 12px;border-bottom:1px solid #dee2e6;">${badge}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #dee2e6;font-size:11px;color:#666;">${escHtml(action)}</td>
  </tr>`;
  }).join("");
  const reviewedCount = drafts.filter((d) => d.mode === "reviewed").length;
  const newCount = drafts.length - reviewedCount;
  const summary = [
    reviewedCount > 0 ? `${reviewedCount} reviewed` : null,
    newCount > 0 ? `${newCount} new draft${newCount !== 1 ? "s" : ""}` : null
  ].filter(Boolean).join(", ");
  return `
<div style="background:#d4edda;border:1px solid #c3e6cb;border-radius:4px;padding:12px 16px;margin:16px 0;">
  <strong style="color:#155724;">\u2713 Policy Document(s) \u2014 ${drafts.length} file${drafts.length !== 1 ? "s" : ""} (${summary})</strong>
  <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;">
    <thead>
      <tr style="background:#c3e6cb;">
        <th style="padding:6px 12px;text-align:left;">Policy Document</th>
        <th style="padding:6px 12px;text-align:left;">Status</th>
        <th style="padding:6px 12px;text-align:left;">Action Required</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table>
</div>`;
}
var fs6, path5, POLICY_PATTERNS;
var init_policy_generator = __esm({
  "pipeline/lib/policy-generator.ts"() {
    "use strict";
    fs6 = __toESM(require("fs"));
    path5 = __toESM(require("path"));
    init_make_editable();
    POLICY_PATTERNS = [
      /signed\s+\w+\s+policy/i,
      /written\s+\w+\s+policy/i,
      /\w+\s+policy\s+(letter|document|statement|commitment)/i,
      /policy\s+(on|for|regarding)\s+/i,
      /commitment\s+letter/i,
      /signed\s+commitment/i,
      /signed\s+statement/i,
      /management\s+plan/i,
      /operations\s+(and\s+maintenance\s+)?plan/i,
      /maintenance\s+plan/i,
      /transportation\s+demand\s+management/i,
      /tdm\s+program/i,
      /green\s+cleaning\s+policy/i,
      /smoking\s+policy/i,
      /tobacco\s+policy/i,
      /lighting\s+policy/i,
      /thermal\s+comfort\s+policy/i,
      /indoor\s+air\s+quality\s+policy/i,
      /acoustic\s+policy/i,
      /wellness\s+policy/i,
      /tenant\s+guide(lines?)?/i,
      /lease\s+(agreement|language|addendum)/i,
      /\bpolicy\b/i
    ];
  }
});

// pipeline/lib/calculator-guide.ts
function cc(s) {
  return s.toLowerCase().replace(/prerequisite/g, "prereq").replace(/[^a-z0-9]/g, "");
}
function findSchemaForCredit(creditName, schemas) {
  const nameNorm = cc(creditName);
  for (const schema of Object.values(schemas)) {
    if (schema.credits.some((c) => nameNorm.includes(cc(c)))) return schema;
  }
  const STOP_WORDS = /* @__PURE__ */ new Set([
    "management",
    "performance",
    "materials",
    "building",
    "project",
    "credit",
    "calculator",
    "worksheet",
    "systems",
    "reduction",
    "enhanced",
    "minimum",
    "fundamental",
    "indoor",
    "outdoor"
  ]);
  for (const schema of Object.values(schemas)) {
    if (nameNorm.includes(cc(schema.id))) return schema;
    const schemaWords = schema.name.toLowerCase().split(/\W+/).filter((w) => w.length > 5 && !STOP_WORDS.has(w));
    if (schemaWords.some((w) => nameNorm.includes(w))) return schema;
  }
  return null;
}
function extractCalculatorUrl(creditRow) {
  const urlMatch = creditRow.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch) return urlMatch[0];
  return "https://www.usgbc.org/resources";
}
async function extractGuideEntries(client2, schema, projectData, usage2) {
  const skipTabs = /* @__PURE__ */ new Set([
    "instructions",
    "instructions bd+c",
    "instructions id+c",
    "lookups",
    "reference",
    "summary",
    "sourcing of raw materials",
    "material ingredients"
  ]);
  const inputTabs = schema.tabs.filter((t) => !skipTabs.has(t.toLowerCase()));
  const fieldContext = Object.entries(schema).filter(([k, v]) => k.toLowerCase().includes("input") && Array.isArray(v)).map(([k, v]) => `${k}:
${v.map((f) => `  - ${f}`).join("\n")}`).join("\n\n");
  const validOccupancy = schema.validOccupancyCategoryInputs ?? [];
  const occupancyNote = validOccupancy.length > 0 ? `
VALID OCCUPANCY CATEGORY STRINGS (use exact spelling including trailing spaces):
${validOccupancy.map((s) => `  "${s}"`).join("\n")}` : "";
  const prompt = `You are producing a Calculator Input Guide for the LEED ${schema.name}.

CALCULATOR SCHEMA \u2014 input fields required:
${fieldContext}
${occupancyNote}

INPUT TABS TO POPULATE (skip Instructions, Summary, Lookups):
${inputTabs.join(", ")}

PROJECT DATA:
${projectData.slice(0, 5e4)}

Return ONLY a valid JSON array (no markdown, no explanation) of entry objects.
Each object has these exact keys:
  "tab"         \u2014 exact tab name from INPUT TABS list above
  "context"     \u2014 (optional) grouping context, e.g. "AHU-3" or "AHU-3 / Zone: Gymnasium"
  "field_label" \u2014 exact field name as listed in the schema inputs
  "value"       \u2014 the value extracted from project data (string or number), or null if unknown
  "unit"        \u2014 unit of measure if applicable (e.g. "cfm", "sq ft", "people"), else ""
  "source"      \u2014 one of:
                    "mechanical drawings"  \u2014 value read directly from drawing
                    "project profile"      \u2014 project name, address, date, owner
                    "auto-retrieved"       \u2014 ASHRAE tables, EPA data, built-in calculator logic
                    "[OWNER TO CONFIRM: <brief description>]"  \u2014 only if truly unknown

Rules:
- Emit one entry per field per zone / system. For multi-zone systems, repeat the zone-level fields for every zone.
- Include EVERY zone, fixture, space, or system found in the project data \u2014 be exhaustive.
- For Occupancy Category fields: use the exact string from VALID OCCUPANCY CATEGORY STRINGS above.
- Do NOT include auto-calculated fields (Rp, Ra, Vbz, Ez, Voz, Ev, Vot, Zpz, D, Vou) \u2014 those compute in Excel.
- Numbers without quotes; strings in quotes; null for truly unknown values.
- The "value" key must never be omitted \u2014 use null if no value is available.`;
  const stream = client2.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 16e3,
    temperature: 0,
    messages: [{ role: "user", content: prompt }]
  });
  let text = "";
  stream.on("text", (chunk) => {
    text += chunk;
  });
  const final = await stream.finalMessage();
  usage2.input += final.usage.input_tokens;
  usage2.output += final.usage.output_tokens;
  text = text.trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Calculator guide extraction: Claude did not return a JSON array");
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(`Calculator guide extraction: JSON parse failed \u2014 ${text.slice(start, start + 200)}`);
  }
}
function esc(v) {
  if (v === null || v === void 0) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function sourceLabel(source) {
  if (!source) return "";
  if (source.startsWith("[OWNER TO CONFIRM")) {
    return `<span style="color:#856404;font-weight:600;">${esc(source)}</span>`;
  }
  const labels = {
    "mechanical drawings": "Mechanical drawings",
    "project profile": "Project profile",
    "auto-retrieved": "Auto-retrieved"
  };
  const label = labels[source.toLowerCase()] ?? esc(source);
  return `<span style="color:#6b7e82;">${label}</span>`;
}
function renderGuideHtml(schema, entries, creditRow) {
  const calcUrl = extractCalculatorUrl(creditRow);
  const tabOrder = schema.tabs.filter((t) => {
    const tl = t.toLowerCase();
    return !["instructions", "summary"].includes(tl);
  });
  const byTab = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (!byTab.has(entry.tab)) byTab.set(entry.tab, []);
    byTab.get(entry.tab).push(entry);
  }
  const renderedTabs = [];
  const seenTabs = /* @__PURE__ */ new Set();
  const tabRenderOrder = [
    ...tabOrder,
    ...[...byTab.keys()].filter((t) => !tabOrder.includes(t))
  ];
  for (const tab of tabRenderOrder) {
    if (seenTabs.has(tab)) continue;
    seenTabs.add(tab);
    const tabEntries = byTab.get(tab);
    if (!tabEntries || tabEntries.length === 0) continue;
    const byContext = /* @__PURE__ */ new Map();
    for (const e of tabEntries) {
      const key = e.context ?? "";
      if (!byContext.has(key)) byContext.set(key, []);
      byContext.get(key).push(e);
    }
    let contextBlocks = "";
    for (const [ctx, ctxEntries] of byContext) {
      const ctxHeader = ctx ? `<tr><td colspan="5" style="background:${LIGHT_BG};font-weight:600;padding:6px 10px;font-size:12px;color:${BODY_TEXT};">${esc(ctx)}</td></tr>` : "";
      const rows2 = ctxEntries.map((e) => {
        const valueDisplay = e.value === null ? `<span style="color:#856404;">\u2014</span>` : `<strong>${esc(e.value)}</strong>`;
        return `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;color:${BODY_TEXT};font-size:13px;">${esc(e.field_label)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:13px;">${valueDisplay}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:12px;color:#6b7e82;">${esc(e.unit ?? "")}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:12px;">${sourceLabel(e.source)}</td>
          </tr>`;
      }).join("\n");
      contextBlocks += ctxHeader + rows2;
    }
    renderedTabs.push(`
      <div style="margin-bottom:24px;">
        <div style="background:${LIGHT_BG};border-radius:4px 4px 0 0;padding:8px 14px;font-weight:700;font-size:14px;color:${BODY_TEXT};">
          Tab: ${esc(tab)}
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #cccccc;border-top:none;font-family:sans-serif;">
          <thead>
            <tr style="background:${PALE_BG};">
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:34%;">Field Label</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:28%;">Value to Enter</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:10%;">Unit</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:28%;">Source</th>
            </tr>
          </thead>
          <tbody>
            ${contextBlocks}
          </tbody>
        </table>
      </div>`);
  }
  const checkItems = entries.map((e) => {
    const label = e.context ? `${e.context} \u2014 ${e.field_label}` : e.field_label;
    return `<li style="margin:4px 0;font-size:13px;color:${BODY_TEXT};">
        <label style="cursor:pointer;">
          <input type="checkbox" style="margin-right:8px;"/>
          ${esc(label)}
          ${e.value !== null ? `<span style="color:#155724;font-size:12px;"> \u2014 ${esc(e.value)}</span>` : `<span style="color:#856404;font-size:12px;"> \u2014 <em>confirm with owner</em></span>`}
        </label>
      </li>`;
  }).join("\n");
  const ownerConfirmCount = entries.filter((e) => e.source?.startsWith("[OWNER TO CONFIRM")).length;
  const ownerNote = ownerConfirmCount > 0 ? `<p style="margin:8px 0 0;font-size:12px;color:#856404;"><strong>${ownerConfirmCount} field(s) require owner confirmation</strong> \u2014 shown with [OWNER TO CONFIRM] label above.</p>` : "";
  return `
<div style="margin-top:40px;border:2px solid ${PRIMARY};border-radius:6px;overflow:hidden;font-family:sans-serif;">

  <!-- Header -->
  <div style="background:${PRIMARY};padding:14px 20px;">
    <h2 style="margin:0;color:${WHITE};font-size:18px;font-weight:700;">
      Calculator Input Guide \u2014 ${esc(schema.name)}
    </h2>
    <div style="color:${LIGHT_BG};font-size:13px;margin-top:4px;">
      LEED Credit: ${esc(schema.credits.join(", "))} &nbsp;\xB7&nbsp; Version: ${esc(String(schema.version ?? ""))}
    </div>
  </div>

  <div style="padding:20px;background:${WHITE};">

    <!-- Section 1 \u2014 Instructions -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
      <h3 style="margin:0 0 8px;color:${PRIMARY};font-size:15px;">Section 1 \u2014 Instructions</h3>
      <p style="margin:0;font-size:13px;color:${BODY_TEXT};line-height:1.6;">
        Open the official USGBC ${esc(schema.name)} from the Calculator Access section below.
        Enter the values shown in the tab-by-tab tables into the corresponding cells.
        Fields marked <strong>[OWNER TO CONFIRM]</strong> require site-specific data from the project team.
        Do not manually enter auto-calculated values (highlighted in yellow in the calculator) \u2014 those compute automatically from your inputs.
        After entering all values, verify that the formula cells recalculate and review the Summary tab for compliance status.
      </p>
    </div>

    <!-- Section 2 \u2014 Tab-by-tab input tables -->
    <h3 style="margin:0 0 14px;color:${PRIMARY};font-size:15px;">Section 2 \u2014 Input Values by Tab</h3>
    ${renderedTabs.join("\n")}

    <!-- Section 3 \u2014 Completion checklist -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
      <h3 style="margin:0 0 10px;color:${PRIMARY};font-size:15px;">Section 3 \u2014 Completion Checklist</h3>
      <ul style="margin:0;padding:0 0 0 4px;list-style:none;">
        ${checkItems}
        <li style="margin:10px 0 4px;font-size:13px;color:${BODY_TEXT};border-top:1px solid #cccccc;padding-top:10px;">
          <label style="cursor:pointer;">
            <input type="checkbox" style="margin-right:8px;"/>
            <strong>Verify all formula cells recalculate correctly</strong> \u2014 check Summary tab for compliance status before submitting
          </label>
        </li>
      </ul>
      ${ownerNote}
    </div>

    <!-- Section 4 \u2014 Calculator Access -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;">
      <h3 style="margin:0 0 8px;color:${PRIMARY};font-size:15px;">Section 4 \u2014 Calculator Access</h3>
      <p style="margin:0;font-size:13px;color:${BODY_TEXT};">
        Download the official calculator from USGBC:
        <a href="${esc(calcUrl)}" style="color:${PRIMARY};font-weight:600;" target="_blank">${esc(calcUrl)}</a>
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7e82;">
        Calculator: <strong>${esc(schema.name)}</strong> (${esc(String(schema.version ?? ""))}).
        Upload the completed file to LEED Online under the documentation tab for ${esc(schema.credits.join(", "))}.
      </p>
    </div>

  </div>
</div>`;
}
async function generateCalculatorGuide(client2, creditRow, creditName, projectData, usage2) {
  if (!creditRow.toLowerCase().includes("calculator")) {
    return null;
  }
  const rawSchemas = fs7.existsSync(CALC_SCHEMA_PATH) ? JSON.parse(fs7.readFileSync(CALC_SCHEMA_PATH, "utf-8")) : {};
  const schemas = rawSchemas.calculators ?? {};
  const schema = findSchemaForCredit(creditName, schemas);
  if (!schema) {
    const reason = `No calculator schema matched: credit="${creditName}"`;
    console.warn(`  [calc-guide] \u26A0 ${reason}`);
    return {
      html: skippedHtml(creditName, reason),
      calculatorName: creditName,
      tabCount: 0,
      fieldCount: 0,
      ownerConfirmCount: 0,
      skipped: true,
      skipReason: reason
    };
  }
  console.log(`
  [calc-guide] Generating Input Guide for ${schema.name}`);
  console.log(`  [calc-guide] Extracting field values from project data...`);
  const entries = await extractGuideEntries(client2, schema, projectData, usage2);
  const tabsPresent = [...new Set(entries.map((e) => e.tab))];
  const fieldCount = entries.length;
  const ownerConfirmCount = entries.filter((e) => e.source?.startsWith("[OWNER TO CONFIRM")).length;
  console.log(`  [calc-guide] \u2713 ${fieldCount} entries across ${tabsPresent.length} tab(s), ${ownerConfirmCount} owner-confirm`);
  const html = renderGuideHtml(schema, entries, creditRow);
  return {
    html,
    calculatorName: schema.name,
    tabCount: tabsPresent.length,
    fieldCount,
    ownerConfirmCount,
    skipped: false
  };
}
function skippedHtml(creditName, reason) {
  return `
<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:12px;margin:8px 0;font-family:sans-serif;">
  <strong style="color:#856404;">\u26A0 Calculator Input Guide \u2014 Manual Step Required</strong><br/>
  <span style="font-size:12px;color:#6b7e82;">
    A calculator is required for ${esc(creditName)} but could not be auto-populated.<br/>
    Reason: ${esc(reason)}<br/>
    Download the official calculator from <a href="https://www.usgbc.org/resources" style="color:#327cb9;">usgbc.org/resources</a> and complete manually.
  </span>
</div>`;
}
var fs7, path6, CALC_SCHEMA_PATH, PRIMARY, LIGHT_BG, PALE_BG, BODY_TEXT, WHITE;
var init_calculator_guide = __esm({
  "pipeline/lib/calculator-guide.ts"() {
    "use strict";
    fs7 = __toESM(require("fs"));
    path6 = __toESM(require("path"));
    CALC_SCHEMA_PATH = path6.join(process.cwd(), "pipeline/reference/leed/leed_v41_calculator_schemas.json");
    PRIMARY = "#327cb9";
    LIGHT_BG = "#abcde8";
    PALE_BG = "#f7fafd";
    BODY_TEXT = "#515062";
    WHITE = "#ffffff";
  }
});

// pipeline/lib/specs-extract.ts
function convertToText(buffer, filename2) {
  const ext = path7.extname(filename2).toLowerCase();
  const tmp = path7.join(os2.tmpdir(), `certify-specs-${Date.now()}${ext}`);
  try {
    fs8.writeFileSync(tmp, buffer);
    if (ext === ".rtf") {
      return (0, import_child_process2.execSync)(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
    }
    if (ext === ".docx" || ext === ".doc") {
      try {
        return (0, import_child_process2.execSync)(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      } catch {
        return (0, import_child_process2.execSync)(`strings "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      }
    }
    if (ext === ".txt" || ext === ".text" || ext === ".md") {
      return buffer.toString("utf-8");
    }
    return buffer.toString("utf-8");
  } finally {
    try {
      fs8.unlinkSync(tmp);
    } catch {
    }
  }
}
async function extractChunk(client2, content, usage2) {
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8e3,
    temperature: 0,
    messages: [{ role: "user", content }]
  });
  usage2.input += response.usage.input_tokens;
  usage2.output += response.usage.output_tokens;
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return { products: [], summary: "" };
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      products: parsed.products ?? [],
      summary: parsed.summary ?? ""
    };
  } catch {
    return { products: [], summary: "" };
  }
}
async function extractPdfChunked(client2, pdfBuffer2, filename2, usage2) {
  const allProducts2 = [];
  const summaries2 = [];
  const pdfB64 = pdfBuffer2.toString("base64");
  const content = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
    { type: "text", text: EXTRACTION_PROMPT }
  ];
  console.log(`  [specs-extract] Extracting from ${filename2} (${(pdfBuffer2.length / 1024 / 1024).toFixed(1)} MB PDF)...`);
  const result = await extractChunk(client2, content, usage2);
  if (result.products.length > 0) {
    console.log(`  [specs-extract] \u2713 ${result.products.length} products found`);
    return result;
  }
  console.log(`  [specs-extract] PDF appears large or text-sparse \u2014 chunking by page range...`);
  return extractPdfByPageChunks(client2, pdfBuffer2, filename2, usage2);
}
async function extractPdfByPageChunks(client, pdfBuffer, filename, usage) {
  const _req = eval("require");
  const pdfjsLib = _req("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${_req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;
  const data = new Uint8Array(pdfBuffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const total = pdf.numPages;
  const CHUNK_PAGES = 100;
  const allProducts = [];
  const summaries = [];
  for (let start = 1; start <= total; start += CHUNK_PAGES) {
    const end = Math.min(start + CHUNK_PAGES - 1, total);
    let chunkText = "";
    for (let p = start; p <= end; p++) {
      const page = await pdf.getPage(p);
      const content2 = await page.getTextContent();
      const text = content2.items.map((item) => item.str).join(" ");
      chunkText += `
--- Page ${p} ---
${text}`;
    }
    if (chunkText.replace(/\s/g, "").length < 500) continue;
    console.log(`  [specs-extract] Chunk pages ${start}\u2013${end}...`);
    const content = [
      { type: "text", text: `SPECIFICATION PAGES ${start}\u2013${end} of ${total}:
${chunkText.slice(0, 12e4)}

${EXTRACTION_PROMPT}` }
    ];
    const result = await extractChunk(client, content, usage);
    allProducts.push(...result.products);
    if (result.summary) summaries.push(result.summary);
  }
  return {
    products: deduplicateProducts(allProducts),
    summary: summaries.join(" ")
  };
}
function deduplicateProducts(products) {
  const seen = /* @__PURE__ */ new Map();
  for (const p of products) {
    const key = `${p.csi_division}::${(p.name ?? "").toLowerCase()}::${(p.manufacturer ?? "").toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return Array.from(seen.values());
}
async function extractSpecsContent(files, client2, usage2) {
  const allProducts2 = [];
  const summaries2 = [];
  const sourceFiles = [];
  for (const file of files) {
    const ext = path7.extname(file.filename).toLowerCase();
    sourceFiles.push(file.filename);
    if (file.mimeType === "application/pdf" || ext === ".pdf") {
      const result = await extractPdfChunked(client2, file.buffer, file.filename, usage2);
      allProducts2.push(...result.products);
      if (result.summary) summaries2.push(result.summary);
    } else {
      console.log(`  [specs-extract] Converting ${file.filename} (${ext}) to text...`);
      const text = convertToText(file.buffer, file.filename);
      const CHUNK_CHARS = 12e4;
      for (let offset = 0; offset < text.length; offset += CHUNK_CHARS) {
        const chunk = text.slice(offset, offset + CHUNK_CHARS);
        const content = [
          { type: "text", text: `SPECIFICATION TEXT (chars ${offset}\u2013${offset + chunk.length}):
${chunk}

${EXTRACTION_PROMPT}` }
        ];
        const result = await extractChunk(client2, content, usage2);
        allProducts2.push(...result.products);
        if (result.summary) summaries2.push(result.summary);
      }
    }
  }
  const products = deduplicateProducts(allProducts2);
  return {
    extracted_at: (/* @__PURE__ */ new Date()).toISOString(),
    source_files: sourceFiles,
    product_count: products.length,
    products,
    summary: summaries2.join(" "),
    token_usage: usage2
  };
}
async function extractSpecs(projectId, customerId, files) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk2.default({ apiKey });
  const supabase = createServiceClient();
  const usage2 = { input: 0, output: 0 };
  const profile = await extractSpecsContent(files, client2, usage2);
  const storagePath = `${customerId}/${projectId}/${PROFILE_FILENAME}`;
  const { error: uploadError } = await supabase.storage.from(UPLOADS_BUCKET).upload(storagePath, JSON.stringify(profile, null, 2), {
    contentType: "application/json",
    upsert: true
  });
  if (uploadError) throw new Error(`Failed to upload specs-profile.json: ${uploadError.message}`);
  const { error: updateError } = await supabase.from("projects").update({ specs_extracted: true }).eq("id", projectId);
  if (updateError) console.warn(`[specs-extract] Could not set specs_extracted flag: ${updateError.message}`);
  console.log(`  [specs-extract] \u2713 ${profile.product_count} products extracted from ${profile.source_files.length} file(s)`);
  console.log(`  [specs-extract]   in:${usage2.input.toLocaleString()} out:${usage2.output.toLocaleString()} tokens`);
  return profile;
}
async function loadSpecsProfile(customerId, projectId) {
  const supabase = createServiceClient();
  const storagePath = `${customerId}/${projectId}/${PROFILE_FILENAME}`;
  const { data: data2, error } = await supabase.storage.from(UPLOADS_BUCKET).download(storagePath);
  if (error || !data2) return null;
  try {
    return JSON.parse(await data2.text());
  } catch {
    return null;
  }
}
function formatSpecsProfileForContext(profile) {
  const lines = [
    `SPECS PROFILE \u2014 ${profile.product_count} products from: ${profile.source_files.join(", ")}`,
    profile.summary ? `Summary: ${profile.summary}` : "",
    "",
    "Product / Material Inventory:"
  ];
  for (const p of profile.products) {
    const parts = [
      p.csi_division,
      p.material_type,
      p.name,
      p.manufacturer ? `(${p.manufacturer}${p.model ? ` ${p.model}` : ""})` : "",
      p.sustainability_notes ? `[${p.sustainability_notes}]` : ""
    ].filter(Boolean);
    lines.push(`  \u2022 ${parts.join(" \u2014 ")}`);
  }
  return lines.filter((l) => l !== void 0).join("\n");
}
var import_sdk2, fs8, path7, os2, import_child_process2, UPLOADS_BUCKET, PROFILE_FILENAME, EXTRACTION_PROMPT;
var init_specs_extract = __esm({
  "pipeline/lib/specs-extract.ts"() {
    "use strict";
    import_sdk2 = __toESM(require("@anthropic-ai/sdk"));
    fs8 = __toESM(require("fs"));
    path7 = __toESM(require("path"));
    os2 = __toESM(require("os"));
    import_child_process2 = require("child_process");
    init_supabase();
    UPLOADS_BUCKET = "customer-uploads";
    PROFILE_FILENAME = "specs-profile.json";
    EXTRACTION_PROMPT = `You are extracting a compact product and material inventory from a construction specification document.

Extract ONLY the following for each permanently installed building product or material:
- Product name / description
- Manufacturer name (if specified)
- Model number or series (if specified)
- CSI Division and section number
- Material type or category (e.g. Concrete, Steel, Glazing, Acoustic Ceiling, Flooring, etc.)
- Any sustainability notes (recycled content, EPD available, LEED credit referenced, etc.)

IGNORE: administrative text, bid procedures, general conditions, substitution procedures, warranties, execution methods, testing procedures, and any prose that does not identify a specific product.

Return a JSON object with this exact structure:
{
  "products": [
    {
      "name": "product name",
      "manufacturer": "manufacturer or null",
      "model": "model/series or null",
      "csi_division": "e.g. 09 51 13",
      "material_type": "category",
      "sustainability_notes": "notes or null"
    }
  ],
  "summary": "2-3 sentence plain-text summary of the overall material palette and any notable sustainability specifications"
}

Return ONLY the JSON \u2014 no markdown, no explanation.`;
  }
});

// pipeline/lib/document-extract.ts
function toText(buffer, filename2) {
  const ext = path8.extname(filename2).toLowerCase();
  const tmp = path8.join(os3.tmpdir(), `certify-doc-${Date.now()}${ext}`);
  try {
    fs9.writeFileSync(tmp, buffer);
    if ([".rtf", ".docx", ".doc"].includes(ext)) {
      try {
        return (0, import_child_process3.execSync)(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      } catch {
        return (0, import_child_process3.execSync)(`strings "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      }
    }
    return buffer.toString("utf-8");
  } finally {
    try {
      fs9.unlinkSync(tmp);
    } catch {
    }
  }
}
function buildContentBlocks(buffer, filename2) {
  const ext = path8.extname(filename2).toLowerCase();
  if (ext === ".pdf") {
    return [{
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") }
    }];
  }
  const text = toText(buffer, filename2);
  return [{ type: "text", text: text.slice(0, 1e5) }];
}
async function runExtraction(client2, content, filename2, usage2) {
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4e3,
    temperature: 0,
    messages: [{ role: "user", content: [...content, { type: "text", text: EXTRACTION_PROMPT2 }] }]
  });
  usage2.input += response.usage.input_tokens;
  usage2.output += response.usage.output_tokens;
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return {
      type_name: "Unknown Document",
      type_slug: "unknown",
      firm: null,
      author: null,
      date: null,
      project_reference: null,
      data: { raw_excerpt: text.slice(0, 500) },
      context_block: `UNRECOGNIZED DOCUMENT \u2014 ${filename2}
Could not extract structured data from this file.`,
      summary: `Unrecognized document: ${filename2}. Manual review required.`
    };
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      type_name: parsed.type_name ?? "Unknown Document",
      type_slug: (parsed.type_slug ?? "unknown").replace(/[^a-z0-9-]/g, "-").toLowerCase(),
      firm: parsed.firm ?? null,
      author: parsed.author ?? null,
      date: parsed.date ?? null,
      project_reference: parsed.project_reference ?? null,
      data: parsed.data ?? {},
      context_block: parsed.context_block ?? "",
      summary: parsed.summary ?? ""
    };
  } catch {
    return {
      type_name: "Unknown Document",
      type_slug: "unknown",
      firm: null,
      author: null,
      date: null,
      project_reference: null,
      data: { parse_error: text.slice(0, 500) },
      context_block: `DOCUMENT \u2014 ${filename2}
Could not parse extraction output.`,
      summary: `Document extraction failed for ${filename2}.`
    };
  }
}
async function extractDocumentContent(file, client2, usage2) {
  console.log(`  [doc-extract] Extracting ${file.filename}...`);
  const content = buildContentBlocks(file.buffer, file.filename);
  const result = await runExtraction(client2, content, file.filename, usage2);
  console.log(`  [doc-extract] \u2713 ${result.type_name} (${result.type_slug})`);
  return {
    ...result,
    extracted_at: (/* @__PURE__ */ new Date()).toISOString(),
    source_file: file.filename,
    token_usage: { ...usage2 }
  };
}
async function extractDocument(projectId, customerId, file) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk3.default({ apiKey });
  const supabase = createServiceClient();
  const usage2 = { input: 0, output: 0 };
  const profile = await extractDocumentContent(file, client2, usage2);
  const storagePath = `${customerId}/${projectId}/doc-profiles/${profile.type_slug}.json`;
  const { error: uploadError } = await supabase.storage.from(UPLOADS_BUCKET2).upload(storagePath, JSON.stringify(profile, null, 2), { contentType: "application/json", upsert: true });
  if (uploadError) throw new Error(`Failed to upload ${profile.type_slug} profile: ${uploadError.message}`);
  await supabase.from("projects").select("doc_profiles_extracted").eq("id", projectId).single().then(({ data: data2 }) => {
    const current = data2?.doc_profiles_extracted ?? {};
    current[profile.type_slug] = true;
    return supabase.from("projects").update({ doc_profiles_extracted: current }).eq("id", projectId);
  });
  console.log(`  [doc-extract] \u2713 ${profile.type_slug} stored \u2014 ${profile.type_name}`);
  return profile;
}
async function loadAllDocumentProfiles(customerId, projectId) {
  const supabase = createServiceClient();
  const prefix = `${customerId}/${projectId}/doc-profiles`;
  const { data: files, error } = await supabase.storage.from(UPLOADS_BUCKET2).list(prefix);
  if (error || !files?.length) return [];
  const profiles = await Promise.all(
    files.filter((f) => f.name.endsWith(".json")).map(async (f) => {
      const { data: data2, error: dlErr } = await supabase.storage.from(UPLOADS_BUCKET2).download(`${prefix}/${f.name}`);
      if (dlErr || !data2) return null;
      try {
        return JSON.parse(await data2.text());
      } catch {
        return null;
      }
    })
  );
  return profiles.filter((p) => p !== null);
}
function formatDocumentProfileForContext(profile) {
  return profile.context_block || `${profile.type_name} \u2014 ${profile.source_file}
${profile.summary}`;
}
function formatAllDocumentProfilesForContext(profiles) {
  if (!profiles.length) return "";
  return profiles.map(formatDocumentProfileForContext).join("\n\n");
}
var import_sdk3, fs9, path8, os3, import_child_process3, UPLOADS_BUCKET2, EXTRACTION_PROMPT2;
var init_document_extract = __esm({
  "pipeline/lib/document-extract.ts"() {
    "use strict";
    import_sdk3 = __toESM(require("@anthropic-ai/sdk"));
    fs9 = __toESM(require("fs"));
    path8 = __toESM(require("path"));
    os3 = __toESM(require("os"));
    import_child_process3 = require("child_process");
    init_supabase();
    UPLOADS_BUCKET2 = "customer-uploads";
    EXTRACTION_PROMPT2 = `You are analyzing a professional document uploaded as part of a LEED v4.1 building certification project.

Read this document carefully and extract all information relevant to LEED credit submissions.

Return a JSON object with this exact structure:
{
  "type_name": "Full human-readable document type \u2014 e.g. 'Geotechnical Investigation Report', 'Energy Model Output', 'Stormwater Management Plan', 'Phase I Environmental Site Assessment', 'Traffic Impact Study', 'Commissioning Report', 'Water Audit', 'Structural Report', 'Owner's Project Requirements', 'Construction Waste Management Plan', 'Acoustics Report', 'Photometric/Lighting Calculation Report', 'Indoor Air Quality Management Plan', 'Habitat Survey', 'Ventilation Design Report', 'Site Survey', 'Mechanical Schedule', or whatever this document actually is",
  "type_slug": "kebab-case short identifier \u2014 e.g. 'geotechnical', 'energy-model', 'stormwater-plan', 'phase-i-esa', 'traffic-study', 'commissioning', 'water-audit', 'structural', 'opr', 'waste-management-plan', 'acoustics', 'lighting', 'iaq-plan', 'habitat-survey', 'ventilation', 'site-survey', 'mechanical-schedule'",
  "firm": "authoring firm name or null",
  "author": "author/engineer name and credentials or null",
  "date": "document date as string or null",
  "project_reference": "project name and/or address found in the document or null",
  "data": {
    // Extract ALL quantitative values, thresholds, compliance determinations, and key findings.
    // Organize into logical sub-objects by topic. Use whatever fields fit this document type.
    // Be thorough \u2014 include every number, area, rating, classification, recommendation, and conclusion
    // that could inform a LEED credit analysis. Examples by document type:
    //
    // Geotechnical: site_address, topography, groundwater_depth_ft, seasonal_high_groundwater_ft,
    //   soils (array of layers with depth/description/USCS), hydrologic_soil_group, expansive_soils,
    //   expansion_index, liquefaction_potential, seismic_site_class, contamination_findings,
    //   phase_ii_recommended, foundation_recommendation, bearing_capacity_psf
    //
    // Energy model: software, baseline_standard, gross_floor_area_sf, proposed_site_eui,
    //   baseline_site_eui, percent_better_than_baseline, annual_energy_cost, hvac_system,
    //   heating_fuel, window_u_factor, window_shgc, roof_r_value, lpd_proposed, renewables_kw,
    //   ea_credit_1_points
    //
    // Stormwater: pre_development_runoff_cf, post_development_runoff_cf, retention_volume_cf,
    //   percent_runoff_managed, treatment_methods (array), infiltration_rate_in_hr,
    //   ss_credit_applicable, green_infrastructure_sf
    //
    // Phase I ESA: rec_status, recs (array with description/type/recommendation),
    //   historical_uses, regulatory_findings, phase_ii_recommended
    //
    // Commissioning: cx_agent, commissioned_systems, opr_status, bod_status, cx_plan_status,
    //   issues_identified, issues_resolved, ea_prereq_satisfied, ea_enhanced_cx
    //
    // Traffic/TDM: peak_hour_trips, level_of_service, transit_access, bike_facilities,
    //   tdm_measures, lt_credit_applicable
    //
    // Water audit: baseline_water_use_kgal, proposed_water_use_kgal, percent_reduction,
    //   fixture_types (array), we_credit_points
    //
    // Use judgment for any other document type \u2014 extract whatever is credit-relevant.
  },
  "context_block": "Compact plain-text block formatted for injection into a LEED credit analysis AI prompt. Structure: lead with document type name, firm, author, date, and project reference on the first line. Then present all key findings as short labeled lines or bullet points grouped by topic. Include every number, threshold, classification, and compliance determination. End with any open items, limitations, or recommendations that could affect credit eligibility. Target 250-450 words \u2014 dense with data, no filler prose.",
  "summary": "2-3 sentence plain English summary of what this document is, its key findings, and which LEED credits it is most relevant to."
}

Return ONLY the JSON \u2014 no markdown fences, no explanation.`;
  }
});

// pipeline/lib/pdf-extract.ts
async function renderPdfToTiles(pdfBuffer, cols = 2, rows = 2, dpi = 200, tileMaxSide = 2500) {
  const _req = eval("require");
  const pdfjsLib = _req("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = _req("@napi-rs/canvas");
  const sharp = (await import("sharp")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${_req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;
  const data = new Uint8Array(pdfBuffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const scale = dpi / 72;
  const tiles = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const fullPng = canvas.toBuffer("image/png");
    const tileW = Math.ceil(width / cols);
    const tileH = Math.ceil(height / rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = c * tileW;
        const top = r * tileH;
        const tw = Math.min(tileW, width - left);
        const th = Math.min(tileH, height - top);
        const longest = Math.max(tw, th);
        const resizeOpts = longest > tileMaxSide ? tw >= th ? { width: tileMaxSide } : { height: tileMaxSide } : {};
        const jpegBuf = await sharp(fullPng).extract({ left, top, width: tw, height: th }).resize(resizeOpts).jpeg({ quality: 92 }).toBuffer();
        const quadrant = ["top-left", "top-right", "bottom-left", "bottom-right"][r * cols + c] ?? `r${r}c${c}`;
        tiles.push({ buffer: jpegBuf, label: `Page ${pageNum}, tile ${r * cols + c + 1}/${rows * cols} (${quadrant})` });
      }
    }
  }
  return tiles;
}
async function _extract(client2, pdfBuffer2, filename2, extractionPrompt, renderMode, cacheKey) {
  const t0 = Date.now();
  let content;
  if (renderMode === "tiled-image") {
    console.log(`  [pdf-extract] Rendering tiles: ${filename2}...`);
    const tiles2 = await renderPdfToTiles(pdfBuffer2);
    console.log(`  [pdf-extract] ${tiles2.length} tiles ready \u2014 sending to Claude`);
    content = [
      ...tiles2.map((tile) => ({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: tile.buffer.toString("base64")
        }
      })),
      {
        type: "text",
        text: `The above ${tiles2.length} images are tiles from the same drawing sheet, arranged in a 2-column \xD7 2-row grid (left-to-right, top-to-bottom). Together they form the complete sheet at higher resolution than a single image allows.

` + extractionPrompt
      }
    ];
  } else {
    const pdfB64 = pdfBuffer2.toString("base64");
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
      { type: "text", text: extractionPrompt }
    ];
  }
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8e3,
    temperature: 0,
    messages: [{ role: "user", content }]
  });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const elapsedMs = Date.now() - t0;
  console.log(
    `  [pdf-extract] \u2713 ${filename2} [${renderMode}] \u2014 ${(elapsedMs / 1e3).toFixed(1)}s  in:${response.usage.input_tokens.toLocaleString()} out:${response.usage.output_tokens.toLocaleString()}`
  );
  _cache.set(cacheKey, text);
  return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, elapsedMs, cacheHit: false };
}
async function extractPdfContent(client2, pdfPath, extractionPrompt, renderMode = "document") {
  const cacheKey = `${pdfPath}::${renderMode}::${extractionPrompt}`;
  if (_cache.has(cacheKey)) {
    console.log(`  [pdf-extract] Cache hit: ${path9.basename(pdfPath)}`);
    return { text: _cache.get(cacheKey), inputTokens: 0, outputTokens: 0, elapsedMs: 0, cacheHit: true };
  }
  console.log(`  [pdf-extract] Extracting from ${path9.basename(pdfPath)} [${renderMode}]...`);
  const pdfBuffer2 = fs10.readFileSync(pdfPath);
  return _extract(client2, pdfBuffer2, path9.basename(pdfPath), extractionPrompt, renderMode, cacheKey);
}
async function extractPdfContentFromBuffer(client2, pdfBuffer2, filename2, extractionPrompt, renderMode = "document") {
  const cacheKey = `buffer::${filename2}::${pdfBuffer2.length}::${renderMode}::${extractionPrompt}`;
  if (_cache.has(cacheKey)) {
    console.log(`  [pdf-extract] Cache hit: ${filename2}`);
    return { text: _cache.get(cacheKey), inputTokens: 0, outputTokens: 0, elapsedMs: 0, cacheHit: true };
  }
  console.log(`  [pdf-extract] Extracting from ${filename2} [${renderMode}]...`);
  return _extract(client2, pdfBuffer2, filename2, extractionPrompt, renderMode, cacheKey);
}
var fs10, path9, _cache, EXTRACT_PROMPTS;
var init_pdf_extract = __esm({
  "pipeline/lib/pdf-extract.ts"() {
    "use strict";
    fs10 = __toESM(require("fs"));
    path9 = __toESM(require("path"));
    _cache = /* @__PURE__ */ new Map();
    EXTRACT_PROMPTS = {
      CIVIL_DRAWING: `Extract all of the following from this civil drawing set:
- Project name
- Project address (full street address, city, state, zip)
- Owner / developer name (if shown)
- Project description / building type
- Site area (total lot area in sq ft and/or acres)
- Development footprint area (building footprint + impervious area if shown)
- Site boundary description
- Any noted land features: wetlands, floodplain notes, water bodies, detention/retention areas, easements
- Zoning designation (if noted)
- Any environmental or permitting notes
- Benchmark / datum and coordinate system if shown
- Any slope or grading notes relevant to sensitive land classification
Output as structured plain text. Be thorough \u2014 include every data point visible.`,
      CREDIT_REQUIREMENTS: `Extract all of the following from this LEED credit guide:
- Credit name and number
- Points available
- All compliance options with their full thresholds and requirements
- All items that must be documented or calculated
- All items listed as required uploads or submittals
- Items that can be retrieved from public databases (FEMA, NWI, Census, etc.)
- Items that require owner input or site-specific data
- All LEED Online form fields described or referenced
- Any definitions or special terms
Output as structured plain text. Be complete \u2014 every requirement matters.`,
      GEOTECHNICAL_REPORT: `Extract all of the following from this geotechnical report:
- Project name and address
- Report date and author
- Soil classifications (USCS or ASTM) for each boring or test pit
- Prime farmland soil types identified (if any)
- Groundwater depth observations
- Any notes on wetlands, fill, or sensitive soil conditions
- Bearing capacity values
- Any environmental observations
Output as structured plain text.`
    };
  }
});

// pipeline/prompts/credit-submission.ts
var CREDIT_SUBMISSION_PROMPT;
var init_credit_submission = __esm({
  "pipeline/prompts/credit-submission.ts"() {
    "use strict";
    CREDIT_SUBMISSION_PROMPT = `ABSOLUTE OUTPUT RULE \u2014 THIS OVERRIDES EVERYTHING ELSE:

Your output is a customer-facing professional document. The customer paid for this document. They will submit it as part of a building certification review.

You are forbidden from including any of the following in your output under any circumstances:
- Any description of what you are about to do
- Any description of what you just did
- Any summary of search results
- Any statement of what data you found or retrieved
- Any internal reasoning or decision process
- Any notes about data currency or retrieval dates inline in content
- Any separator lines used to divide your thinking from your output
- Any sentence that begins with: I will, I'll, Let me, Now I, I found, I retrieved, I determined, I calculated, I assessed, I searched, I looked up

If you find yourself writing any of these \u2014 stop immediately and delete what you wrote. Begin again with the actual content.

Your output begins with the first field of the form or the first word of the first section heading. Nothing before that. Nothing after the last deliverable item. No preamble. No summary. No narration. Ever.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You are a building certification expert and certification documentation specialist.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
WEB SEARCH \u2014 USE EXTENSIVELY FOR ALL DATA RETRIEVAL
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You have web search available. Use it extensively and thoroughly. For any credit requiring location data or external data:

- Search multiple sources \u2014 never rely on a single search result.
- For transit: search for all transit agencies serving this city, all routes near this address, all stop locations within required distances. Do not limit to one agency.
- For distance measurement: use your knowledge of standard walking speeds and block lengths to estimate distances when exact data is unavailable, but always prefer measured data from web search.
- For trip counts: search agency websites, GTFS feeds via transit.land or mobilitydata.org, and published schedules. Use the most authoritative source available.
- For census data, density, land use: search US Census, city planning department, or equivalent authoritative sources.
- For utility rates: search the utility provider's published rate schedule.
- For any other data type: search the most authoritative public source available.

Return all findings directly in the output. Do NOT add a "Data Source" column to any table \u2014 source references belong in the Submission Checklist (Part 3), not inline in tables. Never ask the customer for data that can be found through web search.

SEARCH TO MAXIMUM \u2014 NOT TO MINIMUM.
Your goal for every credit is the highest achievable score, not the lowest passing threshold. Do not stop searching once you have found enough qualifying items to meet a minimum threshold. Search until you have found every qualifying item that exists within the required parameters \u2014 or until you have confirmed through exhaustive search that nothing more exists.

This applies universally: transit stops, diverse uses, bicycle facilities, open space, density data, product alternatives, or any other credit where qualifying items must be identified and counted.

Before concluding any search:
- Have you checked every agency, provider, or source type relevant to this credit? If not, search again.
- Have you verified results across multiple sources? If not, search again.
- Could there be qualifying items you have not yet found? If yes, search again.
- Have you confirmed the full search radius or parameter space is exhausted? If not, search again.

Stopping early because a minimum threshold is met is not acceptable. A project that qualifies for 1 point may qualify for 5 \u2014 you will not know until you have searched completely. Search completely every time.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
ABSOLUTE RULE \u2014 NON-NEGOTIABLE \u2014 APPLIES TO EVERY CREDIT WITHOUT EXCEPTION
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You have web search and have retrieved data before this prompt ran. That data is included in this context. You must use it directly in the output. You must never ask the customer to provide any item that has already been retrieved and provided to you in this context.

You must never ask the customer to provide: transit schedules, trip counts, walking distances, maps, census data, density data, surrounding land use data, utility rates, product specifications, or any other item that can be sourced from public data.

If you find yourself about to write any instruction asking the customer to provide something \u2014 stop. Check whether that item is in the retrieved data already provided to you. If it is \u2014 use it. If it is not in the retrieved data and cannot be found in any public source \u2014 use [OWNER TO CONFIRM: description] for owner-specific items only.

The customer provides only: proprietary project documents, owner decisions, signed commitments, internal specifications, and items requiring physical site access. Nothing else.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
ABSOLUTE RULES \u2014 THESE APPLY TO EVERY CREDIT, EVERY RUN
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

OUTPUT IS BODY CONTENT ONLY \u2014 NO HTML DOCUMENT WRAPPER.
Do not output <!DOCTYPE>, <html>, <head>, or <style> tags. The pipeline provides the complete HTML document wrapper and stylesheet. Your output is the body content only \u2014 start directly with the first content element (e.g. <div class="page-header">). Do not wrap your output in a document shell at any point, even if you are generating multiple sections across multiple searches.

OUTPUT BEGINS IMMEDIATELY WITH CONTENT. NO EXCEPTIONS.
The very first token of your response must be the first token of actual content \u2014 a heading, a form field, an HTML tag. Nothing else.

Never write any of the following anywhere in the output:
- "I have reviewed...", "I've analyzed...", "I have gathered...", "I have all the information needed..."
- "Now I have...", "Now let me...", "Let me now...", "Let me compile..."
- "Based on the attached...", "Based on my review...", "Based on the civil drawing..."
- "After reviewing...", "After analyzing...", "After searching..."
- "Here is the...", "Below is the...", "The following sections contain..."
- "As requested...", "Per your instructions...", "In this response..."
- "Using web search...", "I retrieved...", "I searched for..."
- "This document presents...", "This report contains...", "This section provides..."
- Any sentence that describes what you are doing, what you found, or how you produced the output.

This rule applies to the entire document \u2014 opening, closing, section introductions, and transitions. The output is a customer-facing certification document. There is no audience for process narration. Violation of this rule produces unusable output that must be regenerated.

FIELD IDs ARE NEVER VISIBLE IN OUTPUT.
The form schema contains internal identifiers like "fieldId: splCircumstances". These are for your reference only when identifying which field to populate. Never output a fieldId value as visible text \u2014 not next to a label, not as a caption, not anywhere. If you include a LEED Online field identifier in the document, it must be wrapped in <span class="field-id">...</span>. Raw camelCase field ID strings appearing as plain text in the output are a hard error.

NEVER USE THE NAME "CERTIFYAI".
The platform is called Liminal. Do not use "CertifyAI" anywhere in any output \u2014 not in section headers, not in checklist labels, not in any text. If you need to indicate that an item was produced or retrieved by the platform, say "Provided" or attribute to "Liminal." The word "CertifyAI" must never appear in customer-facing output.

MAPS ARE NEVER GENERATED BY YOU.
Walking distance maps, site context maps, transit maps, bicycle maps \u2014 all maps are produced by the Google Maps API pipeline, not by you. When a map is required, insert exactly this placeholder and nothing else: <!-- WALKING_DISTANCE_MAP -->
Never produce an SVG map. Never produce a drawn map. Never produce a map of any kind. The placeholder is replaced programmatically after your response is complete.

TABLES ARE ALWAYS REAL HTML TABLES.
Any tabular content \u2014 trip count tables, threshold comparison tables, distance tables, calculation tables, schedule data, fixture counts, any data with rows and columns \u2014 must be rendered as a proper HTML <table> with <thead>, <tbody>, <tr>, <th>, and <td> elements. Never use plain text, tab spacing, pre-formatted text, or markdown for tabular data. Real HTML tables are required in every output.

BOTH HTML FILES ARE ALWAYS PRODUCED.
Every run produces exactly two files: one standard HTML file and one editable HTML file. Neither is optional. Both contain identical content. The calling code handles file generation. Do not reference Word, .docx, or any non-HTML format.

NO PLACEHOLDER GRAPHICS.
Every visual element is either real (a real image, a real map, a real annotated drawing) or replaced by the exact comment placeholder specified above. No placeholder boxes, no "image goes here" text, no gray rectangles.

NO PROCESS NARRATION OF ANY KIND.
Do not write: "I have reviewed...", "Based on the attached...", "The following sections contain...", "As requested...", "Here is the...", "I will now...", or any similar framing. Content only.

CLAUDE RETRIEVES EVERYTHING IT CAN BEFORE ASKING THE CUSTOMER.
Before listing any item as required from the customer, first determine whether it can be retrieved, calculated, or generated automatically. If it can be retrieved \u2014 retrieve it. The customer is never asked to provide something that can be obtained from an external source.

This rule applies to every item in every credit across all three programs without exception. Items Claude retrieves automatically include but are not limited to:

- Transit schedules and trip counts: retrieved from agency GTFS feeds, agency websites, or Google Maps transit data. Never ask the customer to provide transit schedules.
- Walking distances and routes: retrieved from Google Maps Directions API (walking mode). Never ask the customer to measure distances.
- Census data, population density, employment density: retrieved from US Census API or equivalent public sources. Never ask the customer to provide demographic data.
- Surrounding land use and diverse uses inventory: retrieved from Google Maps Places API, OpenStreetMap, or equivalent. Never ask the customer to inventory nearby uses.
- Municipal utility rates: retrieved from utility provider websites. Never ask the customer to provide rate schedules.
- Product specifications and cut sheets: retrieved from manufacturer websites where publicly available. Never ask the customer to provide specs that are publicly available.
- Aerial maps and satellite imagery: retrieved from Google Maps Static API. Never ask the customer to provide maps.
- Weather and climate data: retrieved from NOAA or equivalent public sources.
- Building code references: retrieved from publicly available municipal or state code databases.
- Agency contacts and permit requirements: retrieved from official government websites.
- Any other data available from public sources, APIs, or web search.

The customer provides only what is genuinely unavailable from any external source: proprietary project documents, owner decisions, internal specifications, signed commitments, and items that require physical access to the building or site.

When an item is retrieved automatically, the retrieved data must be included directly in the output as supporting documentation. The source must be cited. The retrieval date must be shown. Do not reference a source \u2014 include the actual data.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
AUTHORITATIVE REFERENCE FILES \u2014 MANDATORY \u2014 NO EXCEPTIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You have been provided with the following authoritative reference files for this LEED credit. Use them exclusively \u2014 never fall back to training data for any form field, calculator input, or credit requirement.

- Automation analysis spreadsheet row for this credit: tells you exactly what the team must upload, what you auto-retrieve and from which specific named sources, and exactly what you produce
- Form schema for this credit: contains every field ID, field type, checkbox label, upload field name, and radio option from the live LEED Online form \u2014 populate fields using these exact IDs and field names
- Calculator schema if applicable: contains every tab name and input field label from the actual USGBC calculator file \u2014 populate using these exact field labels

Column I of the automation analysis spreadsheet tells you exactly which public sources to retrieve data from for this credit with specific source names. Retrieve from those exact named sources. Do not use other sources unless the specified source is unavailable \u2014 if unavailable use the closest equivalent and note the substitution clearly.

If any lookup returns empty or a source is unavailable flag it with: [SOURCE UNAVAILABLE: description of what could not be retrieved and what was used instead]

Never guess. Never fall back to training data. If a reference file lookup returns empty flag it \u2014 do not substitute training knowledge.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
WHAT DRIVES THE OUTPUT \u2014 READ FIRST
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

1. Read the automation analysis spreadsheet row for this credit and identify:
   - Column 1: Documents the project team provided (attached)
   - Column 2: Items retrieved automatically without customer involvement
   - Column 3: Platform reference files \u2014 requirements PDF, form link, calculator
   - Column 4: EXACT list of outputs to produce \u2014 generate every item, nothing else

2. Read the credit requirements PDF for requirements specific to this program version. Use nothing else for requirements.

3. If a form link is provided: reproduce only the fields, tables, and uploads on that form. Nothing added, nothing omitted.

4. If no form link: skip Part 1, produce Part 2 only.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
OUTPUT STRUCTURE (for every credit)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

PART 1 \u2014 Online Submittal Form
Reproduce only what appears on the actual form. Populate every field with real data sourced from the project address, attached documents, or standard reference values for this credit type. For any field requiring owner decision: [OWNER TO CONFIRM: specific description of what is needed]. Include the walking distance map placeholder exactly where the map upload appears on the form: <!-- WALKING_DISTANCE_MAP -->

PART 2 \u2014 Supporting Project Documentation

SECTION A \u2014 Retrieved Data (Column 2)
For every item listed in Column 2 (DOCUMENTS CLAUDE RETRIEVES AUTOMATICALLY): retrieve it and include the complete, actual data in this section. Not a reference. Not a link. Not a summary. The full retrieved data, formatted and ready for a certification reviewer to read and verify.

This is the evidence behind the submission. If a transit schedule is listed in Column 2, the schedule appears here in full. If census density data is listed, the data appears here in full. If a map is listed, the map appears here. Every Column 2 item is a deliverable \u2014 treat it as such.

If any Column 2 item cannot be retrieved, mark it clearly: \u26A0 RETRIEVAL INCOMPLETE \u2014 [reason] \u2014 and describe what the project team must obtain manually as a substitute.

SECTION B \u2014 Generated Outputs (Column 4)
Generate every item listed in Column 4 of the automation analysis spreadsheet. Generate each item completely. Do not add items not on the list. Do not omit items that are on the list.

PART 3 \u2014 Complete Submission Checklist (MANDATORY \u2014 every credit, every run, every program, no exceptions)

This section is required in every output. It gives the project team a complete, actionable picture of everything required for certification review and exactly who is responsible for each item.

Title this section: "Complete Submission Checklist"

Organize it into two groups:

GROUP A \u2014 PROVIDED
List every item from Column 2 (Claude Auto-Retrieves). For each item:
  - Item name
  - Badge: \u2713 PROVIDED
  - Where it appears: the exact section name in this document (e.g., "Table 1 \u2014 Qualifying Transit Stops", "Walking Distance Map", "Points Determination")
  - Source link: a direct, clickable <a href="..."> URL to the original data so the certification reviewer can independently download or verify the source. This is required for every Column 2 item. Use the most specific URL available \u2014 the agency's published schedule page, the GTFS feed download, the Census data permalink, the utility rate schedule PDF, etc. If a direct URL was used to retrieve the data, use that exact URL. Never omit this link.

Also list every document generated from Column 4 outputs:
  - Item name
  - Badge: \u2713 PROVIDED
  - Reference: "See [Section Name] in this document"

GROUP B \u2014 REQUIRED FROM PROJECT TEAM
List every item from Column 1 (Project Team Must Upload). Every item. None may be omitted.
For each item:
  - Item name exactly as it appears in Column 1
  - Badge: \u25C9 REQUIRED \u2014 Project Team
  - What it is: a specific, plain-language description of the document, file, photograph, or commitment needed
  - Why it must come from the project team \u2014 use one of these exact reasons and add specifics:
      \xB7 "Requires physical site access" \u2014 for photographs, site measurements, field observations
      \xB7 "Requires owner decision or signature" \u2014 for commitments, policy letters, signed statements
      \xB7 "Proprietary project document" \u2014 for internal specs, drawings, contracts not publicly available
      \xB7 "Site-specific and cannot be found in any public source" \u2014 for custom calculations or unique conditions
  - Format required: PDF / photograph / signed letter on letterhead / stamped drawing / etc.

Never omit any Column 1 item. Never omit any Column 2 item. If a Column 2 item was not successfully retrieved, mark it \u26A0 RETRIEVAL INCOMPLETE and explain what the project team should verify.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
HTML OUTPUT \u2014 CLASS VOCABULARY (MANDATORY)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

The pipeline injects the Liminal stylesheet into every output. You MUST use these CSS class names. Do NOT write <style> blocks or inline style= attributes \u2014 the stylesheet is provided for you. Use the classes that apply to the content; unused classes are harmless.

DOCUMENT STRUCTURE
Use this pattern for every credit, adapting sections as the credit requires:

  <div class="page-header">
    <h1>Credit Code \u2014 Credit Name</h1>
    <div class="sub">Project Name \xB7 City, State \xB7 Date</div>
  </div>
  <div class="meta-bar"><span>Program:</span> LEED v4.1 BD+C &nbsp; <span>Credit:</span> LT Credit 5</div>

  <div class="section-header">Section Title</div>
  <div class="section-body">
    ... section content ...
  </div>

  <div class="section-subheader">Subsection Title</div>  \u2190 lighter, nested under a section
  <div class="section-body"> ... </div>

  <div class="section-wrap"> ... padding wrapper for free-flowing content ... </div>
  <div class="form-id-bar">LEED Online \u2014 Form Section Identifier</div>
  <hr class="divider">

FORM FIELDS (Part 1 \u2014 online form reproduction)
  <div class="field-row">
    <span class="field-label">Field Name</span>
    <span class="field-value filled">Populated value here</span>
  </div>
  <div class="field-row">
    <span class="field-label">Upload Field</span>
    <span class="field-value upload">[OWNER TO CONFIRM: description of what is needed]</span>
  </div>
  <span class="owner-field">[OWNER TO CONFIRM: description]</span>  \u2190 inline owner item
  <span class="field-id">field_id_123</span>  \u2190 LEED Online field ID, monospace
  <span class="radio-selected">\u25CF</span> Selected option
  <span class="radio-unselected"></span> Other option

TABLES \u2014 always real HTML tables, never plain text or markdown
  <table>
    <thead><tr><th>Column</th><th>Column</th></tr></thead>
    <tbody>
      <tr><td>Data</td><td>Data</td></tr>
    </tbody>
  </table>
  thead th: #327cb9 background, white text \u2014 automatic from stylesheet
  tbody rows: alternating white/#e8f0f7 \u2014 automatic from stylesheet

CALCULATION BOXES
  <div class="calc-box">
    <div class="step">Step 1: formula or value</div>
    <div class="step">Step 2: result</div>
  </div>

COMPLIANCE RESULTS
  <div class="result-pass">\u2713 COMPLIANT \u2014 3 Points Earned</div>
  <div class="result-fail">\u2717 NOT COMPLIANT</div>
  <div class="result-warn">\u26A0 CONDITIONAL \u2014 owner confirmation required</div>
  <span class="pass">Compliant</span> / <span class="fail">Non-compliant</span>  \u2190 inline
  <div class="point-box">3 / 5 Points</div>
  <div class="point-box-pending">Pending Owner Confirmation</div>
  <div class="compliance-threshold-box">
    <div class="threshold-label">Weekday Directional Trips</div>
    <div class="threshold-value">147</div>
    <div class="threshold-limit">Required: \u2265 100 \u2014 THRESHOLD MET</div>
  </div>

NOTES AND CALLOUTS
  <div class="note">Blue informational note \u2014 for context or methodology</div>
  <div class="info-box">Light blue info box \u2014 for retrieved data summaries</div>
  <div class="warn-note">Yellow warning \u2014 for conditional items or caveats</div>
  <div class="warn-box">Yellow warning box \u2014 larger warning area</div>
  <div class="alert-note">Red alert \u2014 for retrieval failures or critical missing items</div>

SUBMISSION CHECKLIST (Part 3 \u2014 use these exact badge classes)
  <div class="checklist-item">
    <h4>Item Name <span class="badge-provided">\u2713 PROVIDED</span></h4>
    <p>Where it appears: Section name in this document</p>
    <p><a href="https://source-url.gov">Source: agency name</a></p>
  </div>
  <div class="checklist-item">
    <h4>Item Name <span class="badge-required">\u25C9 REQUIRED \u2014 Project Team</span></h4>
    <p>What it is: description</p>
    <p>Why from project team: Proprietary project document / Requires owner signature / etc.</p>
    <p>Format required: PDF / signed letter / stamped drawing</p>
  </div>
  <div class="checklist-item">
    <h4>Item Name <span class="badge-incomplete">\u26A0 RETRIEVAL INCOMPLETE</span></h4>
    <p>Reason retrieval failed and what the project team should verify.</p>
  </div>

LAYOUT HELPERS (use when credit content calls for it)
  <div class="two-col"> ... two equal columns for side-by-side data ... </div>
  <div class="plan-section"><h4>Policy Section Heading</h4> ... policy content ... </div>
  <div class="signature-block">Name: <span class="sig-line"></span> Date: <span class="sig-line"></span></div>
  <div class="source-note">Source: agency.gov, retrieved 2026-05-26</div>
  <ul class="checklist-list"><li>Item one</li><li>Item two</li></ul>

PROCESSING SUMMARY (at the very end of every output)
  <div class="processing-summary">
    <h3>Processing Summary</h3>
    <p><strong>Credit:</strong> LT Credit 5 \u2014 Access to Quality Transit (LEED v4.1 BD+C)</p>
    <p><strong>Outputs generated:</strong> Online Form, Supporting Documentation, Submission Checklist</p>
    <p><strong>Owner confirmation items:</strong> list any [OWNER TO CONFIRM] items here</p>
  </div>

MAP INSERTION
  <img data-map-insert="1" alt="Walking distance map">
  \u2190 This exact element is the only map placeholder. The pipeline replaces it with the actual map image.
  Never use text descriptions or .map-placeholder div for the actual map location.

POLICY SIGNAL \u2014 REQUIRED WHEN A POLICY IS NEEDED
If a policy, plan, or commitment document is required as part of the compliance path being documented, place exactly this HTML comment at the very end of Part 2 output, immediately before the Processing Summary:
<!-- POLICY_REQUIRED -->

Rules for this marker:
- Include it ONLY when a policy, plan, or written commitment is a required deliverable for the specific compliance path being documented.
- Do NOT include it when a policy is only one option among multiple compliance paths and a different path was selected.
- Do NOT include it when a policy is mentioned in the credit language but is not required for the chosen path.
- The pipeline reads this marker to decide whether to generate policy drafts. If the marker is absent, no policy drafts are generated. If it is present when not needed, unnecessary documents are produced. Place it accurately.`;
  }
});

// src/lib/resend.ts
function getResend() {
  if (!_resend) {
    _resend = new import_resend.Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
function FROM() {
  return process.env.RESEND_FROM_EMAIL ?? "noreply@liminalsva.com";
}
function APP() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://liminalsva.com";
}
async function sendQAReviewEmail({
  customerName,
  customerEmail,
  creditName,
  projectName,
  orderId,
  generatedAt,
  deliveryScheduledAt,
  standardHtmlUrl,
  editableHtmlUrl,
  approveUrl,
  requestChangesUrl,
  isRegeneration = false,
  changeInstructions
}) {
  const delivery = new Date(deliveryScheduledAt);
  const now = new Date(generatedAt);
  const msLeft = delivery.getTime() - now.getTime();
  const hLeft = Math.floor(msLeft / 36e5);
  const mLeft = Math.floor(msLeft % 36e5 / 6e4);
  const shortId = orderId.slice(0, 8).toUpperCase();
  const regenerationNote = isRegeneration ? `<div style="background:#fff8e1;border-left:3px solid #f5a623;padding:12px 16px;margin-bottom:16px;font-size:14px;">
        <strong>REGENERATED OUTPUT</strong> \u2014 Changes were requested and the pipeline has re-run.
        ${changeInstructions ? `<br><br><strong>Instructions applied:</strong><br><pre style="margin:8px 0 0;white-space:pre-wrap;font-size:13px;">${changeInstructions}</pre>` : ""}
       </div>` : "";
  return getResend().emails.send({
    from: FROM(),
    to: "reviews@liminalsva.com",
    subject: `QA Review Required \u2014 ${creditName} \u2014 ${projectName} \u2014 Order #${shortId}`,
    html: `
      <div style="font-family:sans-serif;max-width:680px;margin:0 auto;">
        <h2 style="margin-bottom:4px;">QA Review Required</h2>
        <p style="color:#666;margin-top:0;">${isRegeneration ? "Regenerated output ready for re-review." : "New output ready for review."}</p>

        ${regenerationNote}

        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:24px;">
          <tr><td style="padding:6px 12px 6px 0;color:#888;width:140px;">Customer</td><td style="padding:6px 0;">${customerName} &lt;${customerEmail}&gt;</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Credit</td><td style="padding:6px 0;">${creditName}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Project</td><td style="padding:6px 0;">${projectName}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Order ID</td><td style="padding:6px 0;font-family:monospace;">${orderId}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Generated</td><td style="padding:6px 0;">${new Date(generatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Auto-delivers</td><td style="padding:6px 0;">${delivery.toLocaleString("en-US", { timeZone: "America/New_York" })} ET <span style="color:#c0392b;font-weight:600;">(${hLeft}h ${mLeft}m remaining)</span></td></tr>
        </table>

        <h3 style="margin-bottom:8px;">Output Files</h3>
        <ul style="padding-left:20px;font-size:14px;line-height:2;">
          <li><a href="${standardHtmlUrl}" style="color:#388fa6;">Standard HTML Output</a> \u2014 submission.html</li>
          <li><a href="${editableHtmlUrl}" style="color:#388fa6;">Editable HTML Output</a> \u2014 submission-editable.html</li>
        </ul>

        <h3 style="margin-top:24px;margin-bottom:12px;">Actions</h3>
        <table style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:12px;">
              <a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#27ae60;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">APPROVE</a>
            </td>
            <td>
              <a href="${requestChangesUrl}" style="display:inline-block;padding:12px 24px;background:#e67e22;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">REQUEST CHANGES</a>
            </td>
          </tr>
        </table>

        <p style="font-size:12px;color:#aaa;margin-top:32px;">
          If no action is taken, output delivers automatically at ${delivery.toLocaleString("en-US", { timeZone: "America/New_York" })} ET.
          If changes were requested and not approved before that time, the customer receives a delay notice.
        </p>
      </div>
    `
  });
}
async function sendAddressInvalidEmail({
  to,
  name,
  creditName,
  projectId,
  reason
}) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Action required \u2014 project address needs correction`,
    html: `
      <h1>Your project address could not be verified</h1>
      <p>Hi ${name},</p>
      <p>We were unable to process your <strong>${creditName}</strong> submission because the project address could not be verified:</p>
      <p style="background:#fff8e1;border-left:3px solid #f59e0b;padding:12px 16px;font-size:14px;">${reason}</p>
      <p>Please update your project address and resubmit. No additional charge will apply for this resubmission.</p>
      <p><a href="${APP()}/projects/${projectId}/edit">Update Project Address \u2192</a></p>
      <p style="font-size:12px;color:#888;">If you believe your address is correct, please reply to this email and we will investigate.</p>
    `
  });
}
var import_resend, _resend;
var init_resend = __esm({
  "src/lib/resend.ts"() {
    "use strict";
    import_resend = require("resend");
    _resend = null;
  }
});

// pipeline/lib/geocode.ts
async function validateAddress(address) {
  if (!address || address.trim().length < 5) {
    return { valid: false, reason: "No project address was provided. Please add a full street address to your project before submitting." };
  }
  return { valid: true, reason: "Address present" };
}
var init_geocode = __esm({
  "pipeline/lib/geocode.ts"() {
    "use strict";
  }
});

// src/lib/qa-token.ts
function secret() {
  return process.env.QA_SECRET ?? process.env.CRON_SECRET ?? "";
}
function signQaToken(orderId) {
  return (0, import_crypto.createHmac)("sha256", secret()).update(orderId).digest("hex");
}
var import_crypto;
var init_qa_token = __esm({
  "src/lib/qa-token.ts"() {
    "use strict";
    import_crypto = require("crypto");
  }
});

// pipeline/lib/validate-output.ts
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ").replace(/&#\d+;/gi, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function validateNoUnnecessaryCustomerRequests(html) {
  const text = stripHtml(html);
  const violations = [];
  const seen = /* @__PURE__ */ new Set();
  for (const { pattern, description } of BLOCKING_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(text.length, match.index + match[0].length + 80);
      const context = `\u2026${text.slice(start, end).trim()}\u2026`;
      const key = description + "|" + match[0].slice(0, 50).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        violations.push({ description, context });
      }
      if (regex.lastIndex <= match.index) regex.lastIndex = match.index + 1;
    }
  }
  return violations;
}
function outputKeywords(item) {
  return item.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !OUTPUT_STOP_WORDS.has(w));
}
function validateAllOutputsProduced(html, outputs) {
  const text = stripHtml(html).toLowerCase();
  const violations = [];
  for (const item of outputs) {
    const keywords = outputKeywords(item);
    if (keywords.length === 0) continue;
    const matched = keywords.filter((kw) => text.includes(kw));
    const matchRatio = matched.length / keywords.length;
    if (matchRatio < 0.6) {
      violations.push({
        description: `Column 4 output missing from document: "${item}"`,
        context: `Keywords checked: [${keywords.join(", ")}] \u2014 ${matched.length}/${keywords.length} matched`
      });
    }
  }
  return violations;
}
function validateCalculatorGuidePresent(html, creditRow) {
  if (!creditRow.toLowerCase().includes("calculator")) return [];
  const text = stripHtml(html).toLowerCase();
  if (text.includes("calculator input guide")) return [];
  return [{
    description: "Calculator Input Guide missing from output",
    context: "Automation analysis requires a calculator but the output HTML contains no 'Calculator Input Guide' heading. generateCalculatorGuide() may have been skipped or thrown."
  }];
}
var BLOCKING_PATTERNS, OUTPUT_STOP_WORDS;
var init_validate_output = __esm({
  "pipeline/lib/validate-output.ts"() {
    "use strict";
    BLOCKING_PATTERNS = [
      // ── 1. Unfilled auto-retrievable placeholders ────────────────────────────
      // [INSERT TRANSIT DATA], [INSERT TRIP COUNT], [INSERT GTFS DATA], etc.
      {
        pattern: /\[INSERT\s+[^\]]{0,80}(?:TRANSIT\s+(?:SCHEDULE|DATA|TIMETABLE)|TRIP\s+COUNT|GTFS|WALKING\s+DISTANCE\s+(?:MEASUREMENT|DATA)|CENSUS\s+DATA|UTILITY\s+RATE|AERIAL\s+(?:MAP|IMAGE)|WEATHER\s+DATA)[^\]]{0,30}\]/i,
        description: "Unfilled placeholder for auto-retrievable data"
      },
      // ── 2. [OWNER/CUSTOMER TO CONFIRM] on auto-retrievable data ─────────────
      // Only flags when the content is unambiguously auto-retrievable.
      // EXCLUDED: "transit agency" (appears in "transit agency committed to restoring service")
      // EXCLUDED: "service rerouted", "service disruption" (owner decision, not auto-retrievable)
      // EXCLUDED: "site plan", "pedestrian routes", "drawing set" (legitimate customer uploads)
      {
        pattern: /\[(?:CUSTOMER|TEAM|OWNER)\s+TO\s+(?:PROVIDE|CONFIRM)[^\]]{0,120}(?:transit\s+(?:schedule|timetable)|bus\s+(?:schedule|route\s+schedule)|trip\s+counts?|directional\s+(?:trip|count)|one-direction\s+(?:trip|count)|gtfs|census\s+data|utility\s+rates?|aerial\s+(?:map|photo)|weather\s+data|walking\s+distance\s+(?:measurement|data))/i,
        description: "[OWNER/CUSTOMER TO CONFIRM] used on auto-retrievable item"
      },
      // ── 3. Named-subject instruction to customer ─────────────────────────────
      // "customer must provide trip counts" / "project team should collect GTFS data"
      // Requires named subject + modal verb, so it cannot match descriptive text.
      {
        pattern: /(?:customer|owner|project\s+team|applicant|you)\s+(?:should|must|will\s+need\s+to|needs?\s+to|is\s+required\s+to|are\s+required\s+to)\s+(?:provide|submit|obtain|collect|gather|supply)\s+[^.]{0,120}(?:trip\s+counts?|transit\s+(?:schedule|timetable)|directional\s+(?:trip|count)|gtfs|census\s+data|utility\s+rates?)/i,
        description: "Customer instructed by name to obtain auto-retrievable data"
      },
      // ── 4. Full-phrase: provide trip counts from agency timetables ────────────
      // "provide one-direction trip counts for Routes X, sourced from IndyGo timetables"
      // Very specific — the complete phrase that Claude uses when asking for GTFS data.
      {
        pattern: /(?:provide|obtain|collect)\s+[^.]{0,80}trip\s+counts?\s+[^.]{0,80}(?:sourced?\s+from|from\s+the)\s+[^.]{0,80}(?:timetable|published\s+schedule)/i,
        description: "Customer asked to source trip counts from transit agency timetables"
      }
    ];
    OUTPUT_STOP_WORDS = /* @__PURE__ */ new Set([
      "the",
      "and",
      "for",
      "with",
      "from",
      "that",
      "this",
      "are",
      "has",
      "have",
      "its",
      "not",
      "but",
      "all",
      "each",
      "any",
      "per",
      "via",
      "tab",
      "html",
      "file",
      "list",
      "full",
      "leed",
      "well"
    ]);
  }
});

// pipeline/lib/output-cleaner.ts
function inc(counts, id, n = 1) {
  counts[id] = (counts[id] ?? 0) + n;
}
function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/&#\d+;/gi, " ").replace(/\s+/g, " ").trim();
}
function scrubSentencesInBlock(block, counts) {
  const parts = block.split(/(?<=[.!?])\s+/);
  const kept = [];
  for (const sentence of parts) {
    const s = sentence.trim();
    if (!s) {
      kept.push(sentence);
      continue;
    }
    const blockHit = BLOCK_PATTERNS.find(({ re }) => re.test(s));
    if (blockHit) {
      inc(counts, blockHit.id);
      continue;
    }
    const sentenceHit = SENTENCE_PATTERNS.find(({ re }) => re.test(s));
    if (sentenceHit) {
      inc(counts, sentenceHit.id);
      continue;
    }
    kept.push(sentence);
  }
  return kept.join(" ");
}
function scrubPlainText(text, counts) {
  const paragraphs = text.split(/\n{2,}/);
  const cleaned = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (SEPARATOR_LINE_RE.test(trimmed)) {
      inc(counts, "P4-separator");
      continue;
    }
    const blockHit = BLOCK_PATTERNS.find(({ re }) => re.test(trimmed));
    if (blockHit) {
      inc(counts, blockHit.id);
      continue;
    }
    const scrubbed = scrubSentencesInBlock(trimmed, counts);
    if (scrubbed.trim()) {
      cleaned.push(scrubbed);
    }
  }
  return cleaned.join("\n\n");
}
function scrubHtml(html, counts) {
  let result = html;
  const firstTagIdx = result.search(/<(?:!DOCTYPE|html|head|body|h[1-6]|div|section|p|table|style|article|ul|ol|figure)\b/i);
  if (firstTagIdx > 0) {
    const stripped = result.slice(0, firstTagIdx);
    if (stripped.trim()) {
      inc(counts, "pre-html-text-stripped");
      console.log(`  [scrub-narration] Stripped ${stripped.trim().length} chars of pre-HTML text`);
    }
    result = result.slice(firstTagIdx);
  }
  const lastTagEnd = result.lastIndexOf(">");
  if (lastTagEnd !== -1 && lastTagEnd < result.length - 1) {
    const trailing = result.slice(lastTagEnd + 1);
    if (trailing.trim()) {
      inc(counts, "post-html-text-stripped");
    }
    result = result.slice(0, lastTagEnd + 1);
  }
  result = result.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    const text = stripTags(inner);
    if (!text) return match;
    const sentences = text.split(/(?<=[.!?])\s+/);
    const narrationCount = sentences.filter((s) => {
      const t = s.trim();
      return BLOCK_PATTERNS.some(({ re }) => re.test(t)) || SENTENCE_PATTERNS.some(({ re }) => re.test(t));
    }).length;
    if (narrationCount === sentences.length) {
      inc(counts, "HTML-p-narration", narrationCount);
      return "";
    }
    if (sentences.length > 1 && narrationCount / sentences.length > 0.5) {
      inc(counts, "HTML-p-narration-partial", narrationCount);
      return "";
    }
    return match;
  });
  result = result.replace(/^[ \t]*(?:-{3,}|\*{3,}|={3,})[ \t]*$/gm, () => {
    inc(counts, "P4-separator");
    return "";
  });
  result = result.replace(/>([^<]{5,})</g, (_m, textNode) => {
    const scrubbed = scrubSentencesInBlock(textNode, counts);
    return `>${scrubbed}<`;
  });
  return result;
}
function containsNarration(content) {
  const text = content.includes("<") ? stripTags(content) : content;
  for (const para of text.split(/\n{2,}/)) {
    const t = para.trim();
    if (BLOCK_PATTERNS.some(({ re }) => re.test(t))) return true;
    for (const s of t.split(/(?<=[.!?])\s+/)) {
      const st = s.trim();
      if (SENTENCE_PATTERNS.some(({ re }) => re.test(st))) return true;
      if (BLOCK_PATTERNS.some(({ re }) => re.test(st))) return true;
    }
  }
  return false;
}
function scrubNarration(input) {
  const counts = {};
  let text = input;
  let fenceCount = 0;
  text = text.replace(/^```(?:html|HTML)?\s*\n?([\s\S]*?)\n?```\s*$/gm, (_m, inner) => {
    fenceCount++;
    return inner.trim();
  });
  if (fenceCount) inc(counts, "code-fence", fenceCount);
  const isHtml = /<!DOCTYPE|<html\b|<body\b|<div\b|<section\b|<p\b|<table\b|<h[1-6]\b/i.test(text);
  if (isHtml) {
    text = scrubHtml(text, counts);
  } else {
    text = scrubPlainText(text, counts);
  }
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]+$/gm, "");
  const total2 = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total2 > 0) {
    console.log(`  [scrub-narration] Removed ${total2} narration instance(s):`);
    for (const [id, n] of Object.entries(counts).sort()) {
      console.log(`    ${id}: ${n}`);
    }
  }
  return { cleaned: text, counts, total: total2 };
}
var SENTENCE_PATTERNS, BLOCK_PATTERNS, SEPARATOR_LINE_RE;
var init_output_cleaner = __esm({
  "pipeline/lib/output-cleaner.ts"() {
    "use strict";
    SENTENCE_PATTERNS = [
      // Pattern 1 — Search / action announcements (what Claude is about to do)
      { id: "P1-ill-search", re: /\bI'?(?:ll| will)\s+search\b/i },
      { id: "P1-let-me-search", re: /\bLet\s+me\s+search\b/i },
      { id: "P1-searching-for", re: /\bSearching\s+for\b/i },
      { id: "P1-ill-look-up", re: /\bI'?(?:ll| will)\s+look\s+up\b/i },
      { id: "P1-let-look-up", re: /\bLet\s+me\s+look\s+up\b/i },
      { id: "P1-ill-retrieve", re: /\bI'?(?:ll| will)\s+retrieve\b/i },
      { id: "P1-ill-find", re: /\bI'?(?:ll| will)\s+find\b/i },
      { id: "P1-now-ill", re: /\bNow\s+I'?ll\b/i },
      { id: "P1-im-going-to", re: /\bI'?m\s+going\s+to\b/i },
      { id: "P1-i-will-now", re: /\bI\s+will\s+now\b/i },
      { id: "P1-first-ill", re: /\bFirst\s+I'?ll\b/i },
      { id: "P1-next-ill", re: /\bNext\s+I'?ll\b/i },
      // "Let me compile / generate / produce / write / create / present / provide / organize / begin"
      { id: "P1-let-me-action", re: /\bLet\s+me\s+(?:now\s+)?(?:compile|generate|produce|write|create|present|provide|organize|structure|format|begin|complete|fill|populate|build|construct|draft)\b/i },
      // "I'll now compile / generate / produce / write / fill / complete / populate"
      { id: "P1-ill-now-action", re: /\bI'?(?:ll| will)\s+now\s+(?:compile|generate|produce|write|create|present|provide|organize|complete|fill|populate|build|construct|draft)\b/i },
      // Pattern 3 — Process narration (completion / state announcements)
      { id: "P3-now-i-have-all", re: /\bNow\s+I\s+have\s+(?:all\s+(?:the\s+)?(?:data|information)|everything)\b/i },
      { id: "P3-now-i-have-evth", re: /\bNow\s+I\s+have\s+everything\b/i },
      // "I now have [comprehensive / complete / detailed / sufficient / enough / all / the data]"
      { id: "P3-i-now-have", re: /\bI\s+now\s+have\s+(?:comprehensive|complete|detailed|sufficient|enough|all|the\s+(?:data|information|context|details|results|findings|information\s+needed|data\s+needed))\b/i },
      { id: "P3-i-have-gathered", re: /\bI\s+have\s+(?:now\s+)?gathered\b/i },
      { id: "P3-i-have-collected", re: /\bI\s+have\s+(?:now\s+)?collected\b/i },
      { id: "P3-i-have-retrieved", re: /\bI\s+have\s+(?:now\s+)?retrieved\b/i },
      { id: "P3-i-have-found-all", re: /\bI\s+have\s+found\s+all\b/i },
      { id: "P3-i-have-compiled", re: /\bI\s+have\s+(?:now\s+)?compiled\b/i },
      { id: "P3-i-have-completed", re: /\bI\s+have\s+(?:now\s+)?completed\b/i },
      { id: "P3-with-info-now", re: /\bWith\s+this\s+(?:data|information|context)\s+I\s+(?:can\s+now|will\s+now|'ll\s+now)\b/i },
      { id: "P3-i-now-have-need", re: /\bI\s+now\s+have\s+what\s+I\s+need\b/i },
      { id: "P3-i-have-what-need", re: /\bI\s+have\s+(?:all\s+)?(?:the\s+)?(?:data|information|context|details)\s+(?:I\s+need|needed)\b/i },
      // Pattern 5 — Data retrieval currency notes inline
      { id: "P5-current-as-of", re: /\b(?:data|information|rates?|values?|results?)\s+(?:is|are)\s+current\s+as\s+of\b/i },
      // Pattern 6 — Internal reasoning / process description
      { id: "P6-i-determined", re: /\bI\s+determined\s+that\b/i },
      { id: "P6-i-calculated", re: /\bI\s+calculated\b/i },
      { id: "P6-i-assessed", re: /\bI\s+assessed\b/i },
      { id: "P6-i-evaluated", re: /\bI\s+evaluated\b/i },
      { id: "P6-based-my-analysis", re: /\bBased\s+on\s+my\s+(?:analysis|review|search|findings|research)\b/i },
      { id: "P6-after-reviewing", re: /\bAfter\s+(?:reviewing|analyzing|searching|examining|researching)\b/i },
      { id: "P6-i-can-now", re: /\bI\s+can\s+now\s+(?:compile|generate|produce|write|create|complete|fill|provide|present)\b/i }
    ];
    BLOCK_PATTERNS = [
      // Pattern 2 — Findings summaries / preambles
      { id: "P2-key-findings", re: /^Key\s+findings?:/i },
      { id: "P2-heres-what", re: /^Here'?s\s+what\s+I\s+found:/i },
      { id: "P2-here-are-results", re: /^Here\s+are\s+the\s+results?:/i },
      { id: "P2-i-found-that", re: /^I\s+found\s+that\b/i },
      { id: "P2-my-search", re: /^My\s+search\s+returned\b/i },
      { id: "P2-search-shows", re: /^The\s+search\s+shows?\b/i },
      { id: "P2-search-results", re: /^Search\s+results?:/i },
      { id: "P2-based-my-search", re: /^Based\s+on\s+my\s+search\b/i },
      // "Based on the search results / the data / this information / these findings"
      { id: "P2-based-on-the", re: /^Based\s+on\s+(?:the\s+|these\s+|this\s+|those\s+)?(?:search\s+results?|data|information|findings?|analysis|results?|above)\b/i },
      { id: "P2-i-was-able", re: /^I\s+was\s+able\s+to\s+find\b/i },
      { id: "P2-i-retrieved-fol", re: /^I\s+retrieved\s+the\s+following\b/i },
      { id: "P2-with-that", re: /^With\s+(?:that|this|these|those)\s+(?:data|information|findings?|results?|context),?\s+I\b/i }
    ];
    SEPARATOR_LINE_RE = /^[ \t]*(?:-{3,}|\*{3,}|={3,})[ \t]*$/;
  }
});

// pipeline/process-order.ts
var process_order_exports = {};
__export(process_order_exports, {
  buildExpectedPdfName: () => buildExpectedPdfName,
  processOrder: () => processOrder
});
function buildExpectedPdfName(program, creditCode, creditName) {
  const code = creditCode.replace(/β/g, "beta");
  const name = creditName.replace(/β/g, "beta");
  if (program === "leed_bdc_v41") {
    const m = code.match(/^([A-Z]+)(c|p)\d+$/i);
    const catAbbrev = m ? m[1].toUpperCase() : code.replace(/[^A-Z]/gi, "").toUpperCase();
    return `LEED_${catAbbrev}_${name}.pdf`;
  }
  if (program === "well_v2") return `WELL_V2_${code}_${name}.pdf`;
  return `WELL_HSR_${code}_${name}.pdf`;
}
function findCategoryFolder(programDir, category, creditCode) {
  if (!fs11.existsSync(programDir)) return void 0;
  const allFolders = fs11.readdirSync(programDir).filter(
    (d) => fs11.statSync(path10.join(programDir, d)).isDirectory()
  );
  const categoryLow = category.toLowerCase();
  const exact = allFolders.find((d) => d.toLowerCase() === categoryLow);
  if (exact) return exact;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalised = allFolders.find((d) => norm(d) === norm(category));
  if (normalised) return normalised;
  const prefixMatch = creditCode.match(/^([A-Z]+)/i);
  const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : null;
  if (prefix) {
    const byPrefix = allFolders.find((d) => {
      const words = d.trim().toUpperCase().split(/\s+/);
      return words.includes(prefix);
    });
    if (byPrefix) return byPrefix;
  }
  return void 0;
}
function findCreditPdfBuffer(program, category, creditCode, creditName) {
  const subdir = PROGRAM_REF_SUBDIR[program];
  if (!subdir) return { found: false, searchedDir: "(unknown program)", filesFound: [] };
  const programDir = path10.join(REF_BASE, subdir);
  const categoryDir = findCategoryFolder(programDir, category, creditCode);
  const searchedDir = categoryDir ? path10.join(programDir, categoryDir) : path10.join(programDir, category);
  if (!categoryDir) return { found: false, searchedDir, filesFound: [] };
  const folderPath = path10.join(programDir, categoryDir);
  const allFiles = fs11.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const expectedName = buildExpectedPdfName(program, creditCode, creditName);
  const exact = allFiles.find((f) => f.toLowerCase() === expectedName.toLowerCase());
  if (exact) {
    const fullPath = path10.join(folderPath, exact);
    return { buffer: fs11.readFileSync(fullPath), resolvedPath: fullPath };
  }
  const nameLower = creditName.toLowerCase();
  const match = allFiles.find((f) => f.includes(creditCode)) ?? allFiles.find((f) => f.toLowerCase().includes(nameLower));
  if (match) {
    const fullPath = path10.join(folderPath, match);
    return { buffer: fs11.readFileSync(fullPath), resolvedPath: fullPath };
  }
  return { found: false, searchedDir, filesFound: allFiles };
}
function scanPdfForAppendixRefs(buffer) {
  const text = buffer.toString("latin1");
  const nums = /* @__PURE__ */ new Set();
  const re = /appendix\s+(\d+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 20) nums.add(n);
  }
  return [...nums].sort((a, b) => a - b);
}
function loadLeedAppendices(referencedNums) {
  const leedDir = path10.join(REF_BASE, "leed");
  const allFiles = fs11.existsSync(leedDir) ? fs11.readdirSync(leedDir) : [];
  const appendixFiles = allFiles.filter((f) => {
    const fl = f.toLowerCase();
    return fl.startsWith("appendix") && fl.endsWith(".pdf");
  });
  const results = [];
  for (const num of referencedNums) {
    const match = appendixFiles.find((f) => {
      const fl = f.toLowerCase();
      return fl.includes(`appendix ${num} `) || fl.includes(`appendix ${num}.`);
    });
    if (match) {
      results.push({ num, buffer: fs11.readFileSync(path10.join(leedDir, match)), filename: match });
    } else {
      console.warn(`  Step 12.7: Appendix ${num} referenced but not found in pipeline/reference/leed/`);
    }
  }
  return results;
}
function isLeed(creditCode) {
  return LEED_CODE_RE.test(creditCode);
}
function creditCodeToFormKey(code) {
  const m = code.match(/^([A-Z]+)(c|p)(\d+)$/i);
  if (!m) return code;
  return `${m[1].toUpperCase()} ${m[2].toLowerCase() === "c" ? "Credit" : "Prereq"} ${m[3]}`;
}
function loadLeedReferenceData(creditCode, creditName, hasCalculator) {
  const lines = [
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "LEED AUTHORITATIVE REFERENCE FILES \u2014 USE EXCLUSIVELY",
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "These files are the authoritative source of truth. Never fall back to training data",
    "for any form field ID, calculator input label, or credit requirement.",
    ""
  ];
  const formSchemaPath = path10.join(REF_BASE, "leed/leed_v41_form_schemas.json");
  try {
    const allSchemas = JSON.parse(fs11.readFileSync(formSchemaPath, "utf-8"));
    const formKey = creditCodeToFormKey(creditCode);
    const creditSchema = allSchemas.credits?.[formKey] ?? Object.values(allSchemas.credits ?? {}).find(
      (c) => (c.name ?? "").toLowerCase().includes(creditName.toLowerCase().slice(0, 12))
    );
    if (creditSchema?.fields?.all?.length > 0) {
      lines.push(`FORM FIELD SCHEMA \u2014 ${formKey} (${creditSchema.fields.all.length} fields):`);
      lines.push("Use these exact field IDs, labels, and option values. Do not invent or rename fields.");
      lines.push(JSON.stringify(creditSchema.fields.all, null, 2));
    } else {
      lines.push(`FORM FIELD SCHEMA: not found for ${creditCode} \u2014 use web search to identify live form fields`);
    }
  } catch (err) {
    lines.push(`FORM FIELD SCHEMA: failed to load \u2014 ${err.message}`);
  }
  if (hasCalculator) {
    const calcSchemaPath = path10.join(REF_BASE, "leed/leed_v41_calculator_schemas.json");
    try {
      const allCalcSchemas = JSON.parse(fs11.readFileSync(calcSchemaPath, "utf-8"));
      const formKey = creditCodeToFormKey(creditCode);
      const calcSchema = allCalcSchemas.calculators?.[formKey] ?? Object.values(allCalcSchemas.calculators ?? {}).find(
        (c) => (c.name ?? "").toLowerCase().includes(creditName.toLowerCase().slice(0, 12))
      );
      if (calcSchema) {
        lines.push("\nCALCULATOR SCHEMA:");
        lines.push("Use these exact tab names and input field labels. Do not rename or reorder.");
        lines.push(JSON.stringify(calcSchema, null, 2));
      } else {
        lines.push(`
CALCULATOR SCHEMA: not found for ${creditCode}`);
      }
    } catch (err) {
      lines.push(`
CALCULATOR SCHEMA: failed to load \u2014 ${err.message}`);
    }
  }
  return lines.join("\n");
}
function orderFolderPath(customerId, projectId, orderId, creditCode) {
  return `${customerId}/${projectId}/orders/${orderId}-${creditCode}`;
}
function attemptPath(base, attempt) {
  return `${base}/attempt-${attempt}`;
}
function outputsPath(base) {
  return `${base}/outputs`;
}
function drawingsPath(customerId, projectId) {
  return `${customerId}/${projectId}/drawings`;
}
async function dbCall(query, label) {
  return withTimeout(Promise.resolve(query), 1e4, `Supabase: ${label}`);
}
function detectRequiredMapType(outputs) {
  const combined = outputs.join(" ").toLowerCase();
  for (const [mapType, keywords] of Object.entries(MAP_OUTPUT_KEYWORDS)) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return mapType;
    }
  }
  return null;
}
function validateAllDeliverables(params) {
  const checks = [];
  const outputsText = params.outputs.join(" ").toLowerCase();
  checks.push({
    item: "Online Submittal Form HTML",
    present: params.htmlGenerated,
    reason: params.htmlGenerated ? void 0 : "Claude API did not return HTML output"
  });
  let cleanedHtml = params.htmlContent;
  if (params.htmlGenerated && containsNarration(cleanedHtml)) {
    console.warn(`  [validateAllDeliverables] Narration detected in HTML \u2014 running second scrub`);
    const rerun = scrubNarration(cleanedHtml);
    cleanedHtml = rerun.cleaned;
    if (rerun.total > 0) console.warn(`    Removed ${rerun.total} additional narration instance(s) in deliverable gate`);
    if (containsNarration(cleanedHtml)) {
      checks.push({
        item: "HTML Narration-Free",
        present: false,
        reason: "Process narration survived two scrub passes \u2014 file flagged for admin review"
      });
      console.error(`  \u2717 Narration still present after second scrub \u2014 marking needs_review`);
    } else {
      console.log(`    \u2713 Narration cleared by second scrub`);
    }
  }
  if (params.hasCalculator) {
    const calcPresent = !!(params.calcGuide && !params.calcGuide.skipped);
    checks.push({
      item: `USGBC Calculator Input Guide (${params.calcGuide?.calculatorName ?? "required"})`,
      present: calcPresent,
      reason: calcPresent ? void 0 : params.calcGuide?.skipReason ?? "Calculator Guide generation failed"
    });
  }
  const mapKeywords = ["map", "transit", "bicycle", "density", "walking"];
  const mapRequired = mapKeywords.some((kw) => outputsText.includes(kw)) || !!params.requiredMapType;
  if (mapRequired && !params.mapGenerated) {
    console.warn(`  [validateAllDeliverables] Map required but not generated \u2014 flagging for QA, not blocking delivery`);
  }
  const policyRequired = ["policy", "plan", "commitment", "statement"].some((kw) => outputsText.includes(kw));
  if (policyRequired) {
    checks.push({
      item: "Policy/Plan Drafts",
      present: params.policyDraftCount > 0,
      reason: params.policyDraftCount > 0 ? void 0 : "No policy drafts generated"
    });
  }
  return { checks, cleanedHtml };
}
async function processOrder(orderId, runId, additionalInstructions) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk4.default({ apiKey, timeout: 18e5, maxRetries: 1 });
  const supabase = createServiceClient();
  console.log(`
[process-order] \u25B6 Order ${orderId} / Run ${runId}`);
  const [runRes, orderRes] = await Promise.all([
    dbCall(supabase.from("runs").select("*").eq("id", runId).single(), "fetch run"),
    dbCall(supabase.from("orders").select("*").eq("id", orderId).single(), "fetch order")
  ]);
  if (runRes.error) throw new Error(`Run not found: ${runRes.error.message}`);
  if (orderRes.error) throw new Error(`Order not found: ${orderRes.error.message}`);
  const run = runRes.data;
  const order = orderRes.data;
  const [projectRes, creditRes, customerRes] = await Promise.all([
    dbCall(supabase.from("projects").select("*").eq("id", order.project_id).single(), "fetch project"),
    dbCall(supabase.from("credits").select("*").eq("id", order.credit_id).single(), "fetch credit"),
    dbCall(supabase.from("customers").select("*").eq("id", order.customer_id).single(), "fetch customer")
  ]);
  if (projectRes.error) throw new Error(`Project not found: ${projectRes.error.message}`);
  if (creditRes.error) throw new Error(`Credit not found: ${creditRes.error.message}`);
  if (customerRes.error) throw new Error(`Customer not found: ${customerRes.error.message}`);
  const project = projectRes.data;
  const credit = creditRes.data;
  const customer = customerRes.data;
  console.log("[Step 2 diagnostic]", {
    cwd: process.cwd(),
    xlsxExists: require("fs").existsSync(require("path").join(process.cwd(), "pipeline/reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx")),
    dirContents: require("fs").readdirSync(require("path").join(process.cwd(), "pipeline")).join(", ")
  });
  console.log(`  Step 2: Loading credit data from automation analysis...`);
  console.log(`  Step 2a: calling extractCreditData for "${credit.credit_code}"...`);
  const creditData = extractCreditData(credit.credit_code);
  console.log(`  Step 2b: extractCreditData returned \u2014 outputs: ${creditData.outputs.join(", ") || "(none)"}`);
  const attemptNumber = run.attempt_number ?? run.run_number ?? 1;
  const orderBase = orderFolderPath(order.customer_id, order.project_id, orderId, credit.credit_code);
  const attemptFolder = attemptPath(orderBase, attemptNumber);
  const outputsFolder = outputsPath(orderBase);
  console.log(`  Step 3: Attempt ${attemptNumber} \u2014 folder: ${attemptFolder}`);
  console.log(`  Step 4: Listing uploads from Storage...`);
  const { data: storageFiles, error: listError } = await dbCall(
    supabase.storage.from(UPLOADS_BUCKET3).list(attemptFolder),
    "list uploads"
  );
  if (listError) throw new Error(`Failed to list uploads: ${listError.message}`);
  const uploads = (storageFiles ?? []).filter((f) => f.name && !f.name.endsWith("/")).map((f) => ({
    storagePath: `${attemptFolder}/${f.name}`,
    filename: f.name,
    mimeType: f.metadata?.mimetype ?? "application/octet-stream"
  }));
  console.log(`    Found ${uploads.length} uploaded file(s)`);
  const { error: step5Err } = await dbCall(
    supabase.from("orders").update({ status: "under_review" }).eq("id", orderId),
    "update order under_review"
  );
  if (step5Err) console.error(`  Step 5 ERROR: ${step5Err.message}`);
  console.log(`  Step 5: Order \u2192 under_review`);
  let reviewResult = null;
  if (uploads.length > 0) {
    console.log(`  Step 6: Running document review...`);
    reviewResult = await reviewDocuments(
      orderId,
      order.customer_id,
      credit.credit_code,
      uploads
    );
  } else {
    console.log(`  Step 6: No uploads \u2014 skipping document review, proceeding directly.`);
  }
  if (reviewResult && reviewResult.status === "incomplete") {
    const issueStrings = reviewResult.issues.map((i) => i.issue);
    if (attemptNumber === 1) {
      console.log(`  Step 7: Review incomplete (attempt 1) \u2014 ${issueStrings.length} issue(s). Notifying customer.`);
      await supabase.from("runs").update({
        status: "failed",
        review_issues: issueStrings,
        completed_at: (/* @__PURE__ */ new Date()).toISOString(),
        error_message: "Document review incomplete"
      }).eq("id", runId);
      await supabase.from("orders").update({ status: "documents_requested" }).eq("id", orderId);
      await logAuditEvent({
        eventType: "documents_requested",
        entityType: "order",
        entityId: orderId,
        customerId: order.customer_id,
        metadata: { attemptNumber, issueCount: issueStrings.length, issues: issueStrings }
      });
      return { orderId, runId, status: "documents_requested", issues: issueStrings };
    }
    console.log(`  Step 7: Review incomplete (attempt ${attemptNumber}) \u2014 proceeding with best-effort run. Issues: ${issueStrings.join("; ")}`);
    await supabase.from("runs").update({
      review_issues: issueStrings
    }).eq("id", runId);
  }
  console.log(`  Step 7.5: Validating project address: "${project.address ?? "(none)"}"...`);
  const addrResult = await validateAddress(project.address ?? "");
  if (!addrResult.valid) {
    console.warn(`  Step 7.5: \u2717 Address invalid \u2014 ${addrResult.reason}`);
    await supabase.from("runs").update({
      status: "address_invalid",
      error_message: addrResult.reason,
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", runId);
    try {
      await sendAddressInvalidEmail({
        to: customer.email,
        name: customer.name ?? "there",
        creditName: credit.credit_name,
        projectId: project.id,
        reason: addrResult.reason
      });
    } catch (emailErr) {
      console.warn(`  Step 7.5: Failed to send address invalid email: ${emailErr.message}`);
    }
    return { orderId, runId, status: "failed", issues: [addrResult.reason] };
  }
  console.log(`  Step 7.5: \u2713 ${addrResult.reason}`);
  const { error: step8OrderErr } = await dbCall(
    supabase.from("orders").update({ status: "processing" }).eq("id", orderId),
    "update order processing"
  );
  if (step8OrderErr) console.error(`  Step 8 ORDER ERROR: ${step8OrderErr.message}`);
  const { error: step8RunErr } = await dbCall(
    supabase.from("runs").update({ status: "processing" }).eq("id", runId),
    "update run processing"
  );
  if (step8RunErr) console.error(`  Step 8 RUN ERROR: ${step8RunErr.message}`);
  console.log(`  Step 8: Order \u2192 processing`);
  console.log(`  Step 9: Downloading ${uploads.length} customer file(s)...`);
  const uploadBuffers = [];
  for (const upload of uploads) {
    const { data: data2, error } = await dbCall(
      supabase.storage.from(UPLOADS_BUCKET3).download(upload.storagePath),
      `download ${upload.filename}`
    );
    if (error || !data2) throw new Error(`Failed to download ${upload.storagePath}: ${error?.message}`);
    uploadBuffers.push({
      filename: upload.filename,
      buffer: Buffer.from(await data2.arrayBuffer()),
      mimeType: upload.mimeType
    });
    console.log(`    \u2713 ${upload.filename}`);
  }
  console.log(`  Step 10: Checking drawing analysis status...`);
  if (!project.auto_extracted) {
    const { data: drawingFiles } = await dbCall(
      supabase.storage.from(UPLOADS_BUCKET3).list(drawingsPath(order.customer_id, order.project_id)),
      "list drawings"
    );
    const drawingPaths = (drawingFiles ?? []).filter((f) => f.name?.endsWith(".pdf")).map((f) => `${drawingsPath(order.customer_id, order.project_id)}/${f.name}`);
    if (drawingPaths.length > 0) {
      console.log(`    Running drawing analysis on ${drawingPaths.length} drawing(s)...`);
      await analyzeDrawings(order.project_id, order.customer_id, drawingPaths);
    } else {
      console.log(`    No drawings uploaded \u2014 skipping drawing analysis`);
    }
  } else {
    console.log(`    Drawing analysis already complete`);
  }
  console.log(`  Step 10.5: Checking specs extraction status...`);
  let specsProfileBlock = "";
  const specFiles = uploadBuffers.filter((u) => {
    const ext = path10.extname(u.filename).toLowerCase();
    return [".pdf", ".rtf", ".docx", ".doc", ".txt"].includes(ext) && !u.filename.toLowerCase().includes("drawing") && !u.filename.toLowerCase().includes("annotated");
  });
  if (!project.specs_extracted && specFiles.length > 0) {
    console.log(`    Running specs extraction on ${specFiles.length} document(s)...`);
    try {
      const specsProfile = await extractSpecs(order.project_id, order.customer_id, specFiles);
      specsProfileBlock = formatSpecsProfileForContext(specsProfile);
      console.log(`    \u2713 Specs extracted \u2014 ${specsProfile.product_count} products`);
    } catch (err) {
      console.warn(`    \u26A0 Specs extraction failed: ${err.message} \u2014 continuing without specs profile`);
    }
  } else if (project.specs_extracted) {
    console.log(`    Specs already extracted \u2014 loading stored profile...`);
    try {
      const specsProfile = await loadSpecsProfile(order.customer_id, order.project_id);
      if (specsProfile) {
        specsProfileBlock = formatSpecsProfileForContext(specsProfile);
        console.log(`    \u2713 Specs profile loaded \u2014 ${specsProfile.product_count} products`);
      }
    } catch (err) {
      console.warn(`    \u26A0 Could not load specs profile: ${err.message}`);
    }
  } else {
    console.log(`    No spec documents uploaded \u2014 skipping`);
  }
  console.log(`  Step 10.6: Checking document extraction status...`);
  let docProfilesBlock = "";
  const docProfiles = project.doc_profiles_extracted ?? {};
  const docFiles = uploadBuffers.filter((u) => {
    const ext = path10.extname(u.filename).toLowerCase();
    const name = u.filename.toLowerCase();
    return [".pdf", ".rtf", ".docx", ".doc"].includes(ext) && !name.includes("drawing") && !name.includes("annotated") && !name.includes("spec") && !name.includes("specification");
  });
  if (docFiles.length > 0) {
    for (const file of docFiles) {
      try {
        const profile = await extractDocument(order.project_id, order.customer_id, {
          filename: file.filename,
          buffer: file.buffer,
          mimeType: file.mimeType
        });
        docProfiles[profile.type_slug] = true;
        console.log(`    \u2713 ${profile.type_slug} profile extracted from ${file.filename}`);
      } catch (err) {
        console.warn(`    \u26A0 Document extraction failed for ${file.filename}: ${err.message}`);
      }
    }
  }
  try {
    const storedProfiles = await loadAllDocumentProfiles(order.customer_id, order.project_id);
    if (storedProfiles.length > 0) {
      docProfilesBlock = formatAllDocumentProfilesForContext(storedProfiles);
      console.log(`    \u2713 ${storedProfiles.length} document profile(s) loaded for context`);
    }
  } catch (err) {
    console.warn(`    \u26A0 Could not load document profiles: ${err.message}`);
  }
  console.log(`  Step 11: Loading project profile...`);
  const profilePath = `${order.customer_id}/${order.project_id}/project-profile.json`;
  let projectProfile = {};
  const { data: profileData } = await dbCall(
    supabase.storage.from(UPLOADS_BUCKET3).download(profilePath),
    "download project profile"
  );
  if (profileData) {
    try {
      projectProfile = JSON.parse(await profileData.text());
    } catch {
      console.warn(`    Failed to parse project-profile.json \u2014 continuing without it`);
    }
  }
  console.log(`  Step 12: Loading credit requirements PDF from pipeline/reference...`);
  const pdfLookup = findCreditPdfBuffer(
    credit.program,
    credit.category,
    credit.credit_code,
    credit.credit_name
  );
  if ("found" in pdfLookup) {
    const expectedName = buildExpectedPdfName(credit.program, credit.credit_code, credit.credit_name);
    console.error(`  Step 12: \u2717 Requirements PDF not found`);
    console.error(`    Directory searched : ${pdfLookup.searchedDir}`);
    console.error(`    Expected filename  : ${expectedName}`);
    console.error(`    Files present      : ${pdfLookup.filesFound.length === 0 ? "(none)" : pdfLookup.filesFound.join(", ")}`);
    console.error(`    Add the correct PDF to pipeline/reference/ and re-run.`);
    const errMsg = `Requirements PDF not found \u2014 searched: ${pdfLookup.searchedDir} \u2014 expected: ${expectedName}`;
    await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
    await supabase.from("runs").update({
      status: "failed",
      error_message: errMsg,
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", runId);
    return { orderId, runId, status: "failed", issues: [errMsg] };
  }
  const reqPdfBuffer = pdfLookup.buffer;
  console.log(`    \u2713 Found: ${pdfLookup.resolvedPath.replace(process.cwd() + path10.sep, "")}`);
  const appendixDocBlocks = [];
  if (isLeed(credit.credit_code)) {
    const appendixNums = scanPdfForAppendixRefs(reqPdfBuffer);
    if (appendixNums.length > 0) {
      console.log(`  Step 12.7: Found references to appendix/appendices: ${appendixNums.join(", ")}`);
      const appendices = loadLeedAppendices(appendixNums);
      for (const ap of appendices) {
        appendixDocBlocks.push(preparePdfDocument(ap.buffer, `LEED v4.1 BD+C Guide \u2014 Appendix ${ap.num}`));
        console.log(`    \u2713 Loaded: ${ap.filename}`);
      }
      if (appendices.length === 0) {
        console.log(`    No matching appendix files found in platform-reference/leed/`);
      }
    } else {
      console.log(`  Step 12.7: No appendix references found in requirements PDF`);
    }
  }
  let referenceDataBlock = "";
  if (isLeed(credit.credit_code)) {
    console.log(`  Step 12.5: Loading LEED reference files for ${credit.credit_code}...`);
    try {
      referenceDataBlock = loadLeedReferenceData(
        credit.credit_code,
        creditData.creditName,
        creditData.platformFiles.calculatorInfo !== null
      );
      const fieldCount = (referenceDataBlock.match(/"fieldId"/g) ?? []).length;
      console.log(`    \u2713 Reference data loaded (${fieldCount} form fields)`);
    } catch (err) {
      console.warn(`    \u26A0 Reference file load failed: ${err.message} \u2014 continuing without reference data`);
    }
  } else {
    console.warn(`  Step 12.5: WELL reference files not yet loaded \u2014 processing with web search and customer documents only`);
  }
  console.log(`  Step 13: Checking for required map outputs...`);
  const requiredMapType = detectRequiredMapType(creditData.outputs);
  console.log(`    Map required: ${requiredMapType ?? "none"}`);
  console.log(`  Step 14: Building prompt...`);
  const creditDataBlock = formatCreditDataForPrompt(creditData);
  const registrationLines = [];
  if (project.regular_occupants != null) registrationLines.push(`  regular_occupants: ${project.regular_occupants}`);
  if (project.peak_visitors != null) registrationLines.push(`  peak_visitors: ${project.peak_visitors}`);
  const projectDataBlock = [
    "PROJECT DATA (extracted from construction drawings):",
    ...Object.entries(projectProfile).filter(([k, v]) => k !== "analyzed_at" && v !== null && v !== void 0).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`),
    "",
    "PROJECT ADDRESS (owner-entered \u2014 use this exact address for ALL location-based lookups including transit, walk score, distances, census data, and any web search requiring a location):",
    `  address: ${project.address ?? "(not provided)"}`,
    ...registrationLines.length > 0 ? ["", "PROJECT REGISTRATION DATA (owner-entered \u2014 use these values for all occupancy calculations, do not estimate):"].concat(registrationLines) : [],
    ...specsProfileBlock ? ["", specsProfileBlock] : [],
    ...docProfilesBlock ? ["", docProfilesBlock] : []
  ].join("\n");
  const compliancePathBlock = run.compliance_path ? [
    "COMPLIANCE PATH (customer-selected \u2014 follow this path exclusively):",
    `  ${run.compliance_path}`,
    "  Do not select a different option or document multiple options. Document only the path the customer has specified.",
    ""
  ].join("\n") : "";
  const userPromptPart1 = [
    creditDataBlock,
    "",
    projectDataBlock,
    ...compliancePathBlock ? ["", compliancePathBlock] : [],
    "",
    "Generate PART 1 \u2014 THE ONLINE FORM SECTION for this credit as instructed."
  ].join("\n");
  const userPromptPart2 = [
    creditDataBlock,
    "",
    projectDataBlock,
    ...compliancePathBlock ? ["", compliancePathBlock] : [],
    "",
    "Generate PART 2 \u2014 SUPPORTING PROJECT DOCUMENTATION (Section A: Retrieved Data, Section B: Generated Outputs) AND PART 3 \u2014 COMPLETE SUBMISSION CHECKLIST for this credit as instructed. Both are required. Do not omit either."
  ].join("\n");
  const systemPrompt = additionalInstructions ? `${CREDIT_SUBMISSION_PROMPT}

${"\u2550".repeat(60)}
QA REVIEW INSTRUCTIONS \u2014 INCORPORATE THESE CHANGES:
${"\u2550".repeat(60)}
${additionalInstructions}` : CREDIT_SUBMISSION_PROMPT;
  const reqDocBlock = preparePdfDocument(reqPdfBuffer, `Requirements: ${credit.credit_code}`);
  const uploadDocBlocks = uploadBuffers.map(
    (u) => u.mimeType === "application/pdf" ? preparePdfDocument(u.buffer, u.filename) : null
  ).filter(Boolean);
  console.log(`  Step 15: Running Claude API (two-pass, temperature: 0)...`);
  const refBlock = referenceDataBlock ? [{ type: "text", text: referenceDataBlock }] : [];
  const part1Response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 64e3,
    temperature: 0,
    system: systemPrompt,
    tools: [WEB_SEARCH_TOOL],
    messages: [{
      role: "user",
      content: [
        ...refBlock,
        reqDocBlock,
        ...appendixDocBlocks,
        ...uploadDocBlocks,
        { type: "text", text: userPromptPart1 }
      ]
    }]
  });
  const part1AllText = part1Response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const part1Html = scrubNarration(part1AllText).cleaned;
  console.log(`    Part 1 complete \u2014 ${part1Response.usage.output_tokens} output tokens (${part1Response.content.filter((b) => b.type === "text").length} text block(s))`);
  let locationsForMap = [];
  if (requiredMapType && project.address) {
    console.log(`  Step 15.7: Extracting locations from Part 1 output...`);
    try {
      const plainText = part1Html.replace(/<[^>]+>/g, " ").slice(0, 15e3);
      const locExtract = await client2.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: `The project is located at: ${project.address}

Extract up to 2 specific named locations (street addresses, transit stops, stations, intersections, named facilities) from the text below that are in the same city or immediate surrounding area as the project. Do NOT include locations in other cities, regions, or states. Return ONLY a valid JSON array of strings. If none found return [].

${plainText}`
        }]
      });
      const locText = locExtract.content[0]?.text ?? "[]";
      const jsonMatch = locText.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const raw = JSON.parse(jsonMatch[0]);
        locationsForMap = raw.filter((l) => typeof l === "string" && l.trim().length > 0).slice(0, 2).map((addr, i) => ({ address: addr, label: String(i + 1) }));
      }
      console.log(`    Extracted ${locationsForMap.length} location(s) from Part 1`);
    } catch (err) {
      console.warn(`  Step 15.7: Location extraction failed: ${err.message} \u2014 using claudeRetrieves fallback`);
    }
    if (locationsForMap.length === 0) {
      locationsForMap = creditData.claudeRetrieves.slice(0, 2).map((r, i) => ({ address: r, label: String(i + 1) }));
      console.log(`    Using ${locationsForMap.length} claudeRetrieves item(s) as map destinations`);
    }
  }
  let mapBuffer = null;
  let mapBase64 = null;
  if (requiredMapType && project.address && locationsForMap.length > 0) {
    console.log(`  Step 15.8: Generating ${requiredMapType} map (${locationsForMap.length} destination(s))...`);
    try {
      const mapResult = await generateMap({
        originAddress: project.address,
        destinations: locationsForMap,
        mapType: requiredMapType
      });
      mapBuffer = mapResult.pngBuffer;
      mapBase64 = mapBuffer.toString("base64");
      console.log(`  Step 15.8: \u2713 Map generated \u2014 ${mapBuffer.length} bytes`);
    } catch (e) {
      console.warn(`  Step 15.8: Map generation failed: ${e.message} \u2014 continuing without map`);
    }
  } else if (requiredMapType) {
    console.log(`  Step 15.8: Map required but no destinations found \u2014 skipping`);
  } else {
    console.log(`  Step 15.8: No map required`);
  }
  const mapContentBlocks = mapBase64 ? [
    {
      type: "text",
      text: "A walking-distance map has been generated for this project (image below). In Part 2, place exactly one <img data-map-insert='1'> element at the most relevant location (walking distances section, transit access section, or site context section). The system will replace this placeholder with the actual map image."
    },
    {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: mapBase64 }
    }
  ] : [];
  const part2Response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 64e3,
    temperature: 0,
    system: systemPrompt,
    tools: [WEB_SEARCH_TOOL],
    messages: [{
      role: "user",
      content: [
        ...refBlock,
        { type: "text", text: `PART 1 OUTPUT (completed \u2014 do not regenerate):
${part1Html}` },
        ...mapContentBlocks,
        reqDocBlock,
        ...appendixDocBlocks,
        ...uploadDocBlocks,
        { type: "text", text: userPromptPart2 }
      ]
    }]
  });
  const part2AllText = part2Response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const part2Html = scrubNarration(part2AllText).cleaned;
  console.log(`    Part 2 complete \u2014 ${part2Response.usage.output_tokens} output tokens (${part2Response.content.filter((b) => b.type === "text").length} text block(s))`);
  let fullHtml = part1Html;
  const bodyCloseIdx = fullHtml.lastIndexOf("</body>");
  if (bodyCloseIdx !== -1) {
    fullHtml = fullHtml.slice(0, bodyCloseIdx) + "\n" + part2Html + "\n</body></html>";
  } else {
    fullHtml += "\n" + part2Html;
  }
  if (mapBuffer) {
    const mapDataUri = `data:image/png;base64,${mapBuffer.toString("base64")}`;
    fullHtml = fullHtml.replace(
      /<img\s+data-map-insert[^>]*\/?>/gi,
      `<img src="${mapDataUri}" alt="Walking distance map" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;display:block;">`
    );
  }
  let calcGuide = null;
  const hasCalculator = !!creditData.platformFiles.calculatorInfo;
  if (hasCalculator) {
    console.log(`  Step 15.5: Generating Calculator Input Guide \u2014 ${creditData.platformFiles.calculatorInfo}`);
    try {
      const calcProjectData = [
        projectDataBlock,
        "",
        `CREDIT: ${creditData.creditNumber} \u2014 ${creditData.creditName}`,
        "",
        "GENERATED HTML OUTPUT (ventilation data):",
        fullHtml.slice(0, 3e4)
      ].join("\n");
      calcGuide = await generateCalculatorGuide(
        client2,
        creditDataBlock,
        creditData.creditName,
        calcProjectData,
        { input: 0, output: 0 }
      );
      if (calcGuide && !calcGuide.skipped) {
        console.log(`  Step 15.5: \u2713 Calculator Input Guide \u2014 ${calcGuide.calculatorName} (${calcGuide.fieldCount} fields, ${calcGuide.tabCount} tabs)`);
        const bodyClose = fullHtml.lastIndexOf("</body>");
        fullHtml = bodyClose !== -1 ? fullHtml.slice(0, bodyClose) + calcGuide.html + "\n</body></html>" : fullHtml + calcGuide.html;
      } else {
        console.warn(`  Step 15.5: \u26A0 Calculator Guide skipped \u2014 ${calcGuide?.skipReason ?? "unknown reason"}`);
        if (calcGuide?.html) {
          const bodyClose = fullHtml.lastIndexOf("</body>");
          fullHtml = bodyClose !== -1 ? fullHtml.slice(0, bodyClose) + calcGuide.html + "\n</body></html>" : fullHtml + calcGuide.html;
        }
      }
    } catch (err) {
      console.error(`  Step 15.5: \u2717 Calculator Guide error \u2014 ${err.message}`);
    }
  } else {
    console.log(`  Step 15.5: No calculator required for ${creditData.creditNumber}`);
  }
  const calcGuideViolations = validateCalculatorGuidePresent(fullHtml, creditDataBlock);
  if (calcGuideViolations.length > 0) {
    calcGuideViolations.forEach((v) => console.warn(`  \u26A0 ${v.description}`));
  }
  const violations = validateNoUnnecessaryCustomerRequests(fullHtml);
  if (violations.length > 0) {
    console.warn(`  \u26A0 FIX 1: ${violations.length} validation violation(s) detected \u2014 running correction pass`);
    violations.forEach((v) => console.warn(`    \u2022 ${v.description}`));
    const correctionResponse = await client2.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 64e3,
      temperature: 0,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL],
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `The HTML document below has ${violations.length} violation(s) where the customer is asked to provide data that can be found via web search.`,
              `Fix ONLY these violations. Use web search to retrieve the correct values and replace each request with the found data.`,
              `Return the complete corrected HTML document.`,
              ``,
              `VIOLATIONS:`,
              violations.map((v, i) => `${i + 1}. ${v.description}
   Found: "${v.context}"`).join("\n\n"),
              ``,
              `HTML TO CORRECT:`,
              fullHtml
            ].join("\n")
          }
        ]
      }]
    });
    const correctedRaw = correctionResponse.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const correctedCleaned = scrubNarration(correctedRaw).cleaned;
    if (correctedCleaned.length >= fullHtml.length * 0.5) {
      fullHtml = correctedCleaned;
    } else {
      console.warn(`    \u26A0 FIX 1 correction response too short (${correctedCleaned.length} chars vs ${fullHtml.length} original) \u2014 keeping original`);
    }
    const remainingViolations = validateNoUnnecessaryCustomerRequests(fullHtml);
    if (remainingViolations.length === 0) {
      console.log(`    \u2713 Correction successful \u2014 all violations resolved`);
    } else {
      console.warn(`    \u26A0 ${remainingViolations.length} violation(s) remain after correction \u2014 delivering with warnings`);
    }
  } else {
    console.log(`  \u2713 FIX 1 validation passed \u2014 no unnecessary customer requests`);
  }
  const missingOutputs = validateAllOutputsProduced(fullHtml, creditData.outputs);
  if (missingOutputs.length > 0) {
    console.warn(`  \u26A0 FIX 2: ${missingOutputs.length} Column 4 output(s) missing \u2014 running correction pass`);
    missingOutputs.forEach((v) => console.warn(`    \u2022 ${v.description}
      ${v.context}`));
    const missingCorrectionResponse = await client2.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 64e3,
      temperature: 0,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL],
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `The HTML document below is missing ${missingOutputs.length} required output(s) from Column 4 of the automation analysis.`,
              `Add each missing output completely. Do not remove or alter any existing content.`,
              `Return the complete corrected HTML document.`,
              ``,
              `MISSING OUTPUTS:`,
              missingOutputs.map((v, i) => `${i + 1}. ${v.description}`).join("\n"),
              ``,
              `HTML TO CORRECT:`,
              fullHtml
            ].join("\n")
          }
        ]
      }]
    });
    const missingCorrectedRaw = missingCorrectionResponse.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const missingCorrectedCleaned = scrubNarration(missingCorrectedRaw).cleaned;
    if (missingCorrectedCleaned.length >= fullHtml.length * 0.5) {
      fullHtml = missingCorrectedCleaned;
    } else {
      console.warn(`    \u26A0 FIX 2 correction response too short (${missingCorrectedCleaned.length} chars vs ${fullHtml.length} original) \u2014 keeping original`);
    }
    const remainingMissing = validateAllOutputsProduced(fullHtml, creditData.outputs);
    if (remainingMissing.length === 0) {
      console.log(`    \u2713 Correction successful \u2014 all Column 4 outputs now present`);
    } else {
      console.warn(`    \u26A0 ${remainingMissing.length} output(s) still missing after correction \u2014 delivering with warnings`);
      remainingMissing.forEach((v) => console.warn(`      \u2022 ${v.description}`));
    }
  } else {
    console.log(`  \u2713 FIX 2 validation passed \u2014 all Column 4 outputs present`);
  }
  const policyRequired = fullHtml.includes("<!-- POLICY_REQUIRED -->");
  console.log(`  [policy] POLICY_REQUIRED marker: ${policyRequired ? "FOUND \u2014 generating drafts" : "absent \u2014 skipping policy generation"}`);
  const policyTokens = { input: 0, output: 0 };
  const uploadedPolicies = [];
  let policyDrafts = [];
  if (policyRequired) {
    const POLICY_FILE_PATTERNS = /policy|plan|commitment|statement|guide|agreement|addendum|lease|protocol/i;
    for (const u of uploadBuffers) {
      if (u.mimeType === "application/pdf" && POLICY_FILE_PATTERNS.test(u.filename)) {
        try {
          const extract = await extractPdfContentFromBuffer(
            client2,
            u.buffer,
            u.filename,
            "Extract the full text content of this policy or plan document. Preserve all section headings, policy statements, procedures, and signature blocks."
          );
          policyTokens.input += extract.inputTokens;
          policyTokens.output += extract.outputTokens;
          uploadedPolicies.push({ filename: u.filename, text: extract.text });
        } catch (err) {
          console.warn(`    [policy] Could not extract text from ${u.filename}: ${err.message}`);
        }
      }
    }
    const reqPdfExtract = await extractPdfContentFromBuffer(
      client2,
      reqPdfBuffer,
      credit.requirements_pdf_path,
      "Extract all credit requirements, required uploads, and documentation requirements."
    );
    policyTokens.input += reqPdfExtract.inputTokens;
    policyTokens.output += reqPdfExtract.outputTokens;
    const tempOutputDir = `/tmp/liminal-policy-${orderId}`;
    policyDrafts = await generatePolicyDrafts(client2, creditData.customerUploads.join("\n"), {
      creditName: credit.credit_code,
      certProgram: credit.credit_code.startsWith("W") ? "WELL v2" : "LEED v4.1",
      projectAddress: project.address ?? "",
      creditRequirementsText: reqPdfExtract.text,
      creditSlug: credit.credit_code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      outputDir: tempOutputDir,
      uploadedDocuments: uploadedPolicies
    }, policyTokens);
  }
  if (policyDrafts.length > 0) {
    const policySection = policyChecklistHtml(policyDrafts);
    const bodyClose = fullHtml.lastIndexOf("</body>");
    fullHtml = bodyClose !== -1 ? fullHtml.slice(0, bodyClose) + policySection + "\n</body></html>" : fullHtml + policySection;
  }
  fullHtml = scrubNarration(fullHtml).cleaned;
  const { checks: deliverableChecks, cleanedHtml: gatedHtml } = validateAllDeliverables({
    creditCode: credit.credit_code,
    outputs: creditData.outputs,
    hasCalculator,
    htmlGenerated: fullHtml.length > 100,
    htmlContent: fullHtml,
    calcGuide,
    mapGenerated: !!mapBuffer,
    requiredMapType,
    policyDraftCount: policyDrafts.length
  });
  fullHtml = gatedHtml;
  const missing2 = deliverableChecks.filter((c) => !c.present);
  const found = deliverableChecks.filter((c) => c.present);
  console.log(`  Step 16.5: Deliverables check for ${credit.credit_code}:`);
  found.forEach((c) => console.log(`    \u2713 ${c.item}`));
  missing2.forEach((c) => console.warn(`    \u2717 MISSING: ${c.item}${c.reason ? " \u2014 " + c.reason : ""}`));
  if (missing2.length > 0) {
    console.warn(`  Step 16.5: \u26A0 ${missing2.length} missing deliverable(s) \u2014 marking order failed`);
    await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
    await supabase.from("runs").update({
      status: "failed",
      error_message: `Missing deliverables: ${missing2.map((c) => c.item).join(", ")}`,
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", runId);
    await logAuditEvent({
      eventType: "deliverables_incomplete",
      entityType: "order",
      entityId: orderId,
      customerId: order.customer_id,
      metadata: { creditCode: credit.credit_code, missing: missing2.map((c) => c.item) }
    });
    return { orderId, runId, status: "failed", issues: missing2.map((c) => `${c.item}: ${c.reason}`) };
  }
  console.log(`  Step 16.5: \u2713 All deliverables confirmed \u2014 proceeding to delivery`);
  console.log(`  Step 18: Uploading outputs to Storage...`);
  const outputPaths = [];
  const standardHtml = injectTableCss(fullHtml);
  const editableHtml = makeEditable(fullHtml);
  const htmlPath = `${outputsFolder}/submission.html`;
  const { error: htmlErr } = await dbCall(
    supabase.storage.from(OUTPUTS_BUCKET).upload(htmlPath, new Blob([standardHtml], { type: "text/html" }), { upsert: true }),
    "upload submission.html"
  );
  if (htmlErr) throw new Error(`Failed to upload HTML output: ${htmlErr.message}`);
  outputPaths.push(htmlPath);
  console.log(`    \u2713 submission.html`);
  const editablePath = `${outputsFolder}/submission-editable.html`;
  const { error: editErr } = await dbCall(
    supabase.storage.from(OUTPUTS_BUCKET).upload(editablePath, new Blob([editableHtml], { type: "text/html" }), { upsert: true }),
    "upload submission-editable.html"
  );
  if (editErr) console.warn(`    Editable HTML upload failed: ${editErr.message}`);
  else {
    outputPaths.push(editablePath);
    console.log(`    \u2713 submission-editable.html`);
  }
  if (mapBuffer) {
    const mapPath = `${outputsFolder}/walking-distance-map.png`;
    const { error: mapErr } = await dbCall(
      supabase.storage.from(OUTPUTS_BUCKET).upload(mapPath, new Blob([new Uint8Array(mapBuffer)], { type: "image/png" }), { upsert: true }),
      "upload map PNG"
    );
    if (mapErr) console.warn(`    Map upload failed: ${mapErr.message}`);
    else {
      outputPaths.push(mapPath);
      console.log(`    \u2713 walking-distance-map.png`);
    }
  }
  for (const draft of policyDrafts) {
    try {
      const draftPath = `${outputsFolder}/${draft.filename}`;
      const { error: draftErr } = await dbCall(
        supabase.storage.from(OUTPUTS_BUCKET).upload(draftPath, new Blob([draft.html], { type: "text/html" }), { upsert: true }),
        `upload policy draft ${draft.filename}`
      );
      if (draftErr) console.warn(`    Policy draft upload failed (${draft.filename}): ${draftErr.message}`);
      else {
        outputPaths.push(draftPath);
        console.log(`    \u2713 ${draft.filename}  [policy ${draft.mode}]`);
      }
    } catch (err) {
      console.warn(`    Policy draft upload error (${draft.filename}): ${err.message}`);
    }
  }
  console.log(`  Step 18: Marking order complete...`);
  const deliveryScheduledAt = new Date(Date.now() + 47 * 60 * 60 * 1e3);
  const { error: step18RunErr } = await dbCall(
    supabase.from("runs").update({
      status: "completed",
      completed_at: (/* @__PURE__ */ new Date()).toISOString(),
      output_html_path: htmlPath
    }).eq("id", runId),
    "update run completed"
  );
  if (step18RunErr) throw new Error(`Step 18: Failed to mark run completed: ${step18RunErr.message}`);
  const { error: step18OrderErr } = await dbCall(
    supabase.from("orders").update({
      status: "complete",
      delivery_scheduled_at: deliveryScheduledAt.toISOString(),
      qa_status: "pending_review"
    }).eq("id", orderId),
    "update order complete"
  );
  if (step18OrderErr) throw new Error(`Step 18: Failed to mark order complete: ${step18OrderErr.message}`);
  const attemptFilePaths = uploads.map((u) => u.storagePath);
  if (attemptFilePaths.length > 0) {
    await supabase.from("cleanup_queue").insert({
      order_id: orderId,
      file_paths: attemptFilePaths
    });
  }
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://liminalsva.com";
    const token = signQaToken(orderId);
    const [standardUrlRes, editableUrlRes] = await Promise.all([
      supabase.storage.from(OUTPUTS_BUCKET).createSignedUrl(htmlPath, 7 * 24 * 3600),
      supabase.storage.from(OUTPUTS_BUCKET).createSignedUrl(editablePath, 7 * 24 * 3600)
    ]);
    await sendQAReviewEmail({
      customerName: customer.name ?? "Customer",
      customerEmail: customer.email,
      creditName: credit.credit_name,
      projectName: project.name,
      orderId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      deliveryScheduledAt: deliveryScheduledAt.toISOString(),
      standardHtmlUrl: standardUrlRes.data?.signedUrl ?? `${appUrl}/orders/${orderId}`,
      editableHtmlUrl: editableUrlRes.data?.signedUrl ?? `${appUrl}/orders/${orderId}`,
      approveUrl: `${appUrl}/api/admin/orders/${orderId}/approve?token=${token}`,
      requestChangesUrl: `${appUrl}/admin/orders/${orderId}/review?token=${token}`,
      isRegeneration: !!additionalInstructions,
      changeInstructions: additionalInstructions
    });
    console.log(`  Step 18.5: \u2713 QA review email sent`);
  } catch (e) {
    console.error(`  Step 18.5: QA review email failed: ${e.message}`);
  }
  const totalTokens = part1Response.usage.input_tokens + part1Response.usage.output_tokens + part2Response.usage.input_tokens + part2Response.usage.output_tokens;
  await logAuditEvent({
    eventType: "order_complete",
    entityType: "order",
    entityId: orderId,
    customerId: order.customer_id,
    metadata: {
      creditCode: credit.credit_code,
      attemptNumber,
      outputCount: outputPaths.length,
      mapGenerated: !!mapBuffer,
      calcGenerated: !!(calcGuide && !calcGuide.skipped),
      totalTokens
    }
  });
  console.log(`
[process-order] \u2713 Complete \u2014 ${outputPaths.length} output(s) uploaded`);
  return { orderId, runId, status: "complete", outputPaths };
}
var import_sdk4, path10, fs11, envPath3, UPLOADS_BUCKET3, OUTPUTS_BUCKET, REF_BASE, PROGRAM_REF_SUBDIR, LEED_CODE_RE, MAP_OUTPUT_KEYWORDS, WEB_SEARCH_TOOL;
var init_process_order = __esm({
  "pipeline/process-order.ts"() {
    "use strict";
    import_sdk4 = __toESM(require("@anthropic-ai/sdk"));
    path10 = __toESM(require("path"));
    fs11 = __toESM(require("fs"));
    init_supabase();
    init_extract_xlsx_row();
    init_document_review();
    init_drawing_analysis();
    init_map_generation();
    init_supabase_ops();
    init_pdf_to_images();
    init_make_editable();
    init_policy_generator();
    init_calculator_guide();
    init_specs_extract();
    init_document_extract();
    init_pdf_extract();
    init_credit_submission();
    init_resend();
    init_geocode();
    init_qa_token();
    init_validate_output();
    init_pipeline_utils();
    init_output_cleaner();
    envPath3 = path10.resolve(__dirname, "../.env.local");
    if (fs11.existsSync(envPath3)) {
      for (const line of fs11.readFileSync(envPath3, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
    UPLOADS_BUCKET3 = "customer-uploads";
    OUTPUTS_BUCKET = "order-outputs";
    REF_BASE = path10.join(process.cwd(), "pipeline/reference");
    PROGRAM_REF_SUBDIR = {
      leed_bdc_v41: "leed",
      well_v2: "well-v2",
      well_hsr: "well-hsr"
    };
    LEED_CODE_RE = /^(LT|SS|WE|EA|MR|EQ|IN|IP)(c|p)\d+$/i;
    MAP_OUTPUT_KEYWORDS = {
      "transit-stops": ["transit", "transit stop", "bus stop", "rail station"],
      "bicycle-facilities": ["bicycle", "bike", "cycling", "cycle"],
      "surrounding-density": ["density", "surrounding", "neighborhood context"],
      "site-context": ["site context", "site map", "vicinity map", "walking distance"]
    };
    WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };
  }
});

// pipeline/worker.ts
var path11 = __toESM(require("path"));
var fs12 = __toESM(require("fs"));
console.log("[worker] starting up...");
try {
  const envPath4 = path11.resolve(__dirname, "../.env.local");
  if (fs12.existsSync(envPath4)) {
    for (const line of fs12.readFileSync(envPath4, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
    console.log("[worker] loaded .env.local");
  }
} catch (err) {
  console.error("[worker] failed to load .env.local:", err.message);
}
var REQUIRED_VARS = [
  "WORKER_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "ANTHROPIC_API_KEY"
];
var missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error("[worker] missing required env vars:", missing.join(", "));
  process.exit(1);
}
console.log("[worker] env vars OK");
var express;
try {
  express = require("express");
  console.log("[worker] express loaded");
} catch (err) {
  console.error("[worker] failed to load express:", err.message);
  process.exit(1);
}
var app = express();
var PORT = process.env.PORT ?? 3001;
var SECRET = process.env.WORKER_SECRET;
app.use(express.json());
app.get("/health", (_req2, res) => {
  res.json({ status: "ok" });
});
app.post("/process", async (req, res) => {
  const authHeader = req.headers["x-worker-secret"];
  if (authHeader !== SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { orderId, runId } = req.body ?? {};
  if (!orderId || !runId) {
    res.status(400).json({ error: "Missing orderId or runId" });
    return;
  }
  res.json({ status: "accepted" });
  const startedAt = Date.now();
  console.log(`[worker] job started  orderId=${orderId} runId=${runId}`);
  try {
    const { processOrder: processOrder2 } = (init_process_order(), __toCommonJS(process_order_exports));
    const result = await processOrder2(orderId, runId);
    const elapsed = ((Date.now() - startedAt) / 1e3).toFixed(1);
    console.log(`[worker] job complete orderId=${orderId} runId=${runId} status=${result.status} elapsed=${elapsed}s`);
  } catch (err) {
    const elapsed = ((Date.now() - startedAt) / 1e3).toFixed(1);
    console.error(`[worker] job failed   orderId=${orderId} runId=${runId} elapsed=${elapsed}s error=${err.message}`);
    console.error(err.stack);
  }
});
try {
  app.listen(PORT, () => {
    console.log(`[worker] listening on port ${PORT}`);
  });
} catch (err) {
  console.error("[worker] failed to start server:", err.message);
  process.exit(1);
}
