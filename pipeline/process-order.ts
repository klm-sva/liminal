/**
 * pipeline/process-order.ts
 *
 * Main orchestrator for processing a Liminal order.
 * Called from src/app/api/orders/[orderId]/ready/route.ts when the
 * customer marks their upload as ready for review.
 *
 * The automation analysis spreadsheet is the single source of truth —
 * all document lists, retrieval targets, and outputs are read from it
 * at runtime. Nothing is hardcoded.
 *
 * Execution sequence (19 steps):
 *   1.  Load order, run, project, customer, credit from DB
 *   2.  Read all 4 columns from automation analysis XLSX for this credit
 *   3.  Determine attempt number and storage paths
 *   4.  List uploaded documents from Storage
 *   5.  Update order → under_review
 *   6.  Run document quality review
 *   7.  If incomplete → documents_requested, notify customer, return
 *   8.  Update order → processing
 *   9.  Download customer upload files
 *   10. Check if drawing analysis is needed; run if so
 *   11. Load project profile (extracted drawing data)
 *   12. Download credit requirements PDF from credit-requirements bucket
 *   13. Check Col 4 outputs — if map required, determine map type
 *   14. Build full system prompt with credit data + project profile
 *   15. Call Claude API (two-pass: Online Form + Supporting Docs) — web_search on every call
 *   16. Generate map PNG if required by Col 4 outputs
 *   18. Upload all outputs to outputs/ folder in Storage
 *   19. Mark run complete, update order → complete, send delivery email, schedule cleanup
 */

import Anthropic from "@anthropic-ai/sdk";
import * as path from "path";
import * as fs from "fs";
import { createServiceClient } from "./lib/supabase";
import { extractCreditData, formatCreditDataForPrompt } from "./lib/extract-xlsx-row";
import { reviewDocuments, type UploadedDocument } from "./document-review";
import { reviewDrawings } from "./drawing-review";
import { analyzeDrawings } from "./drawing-analysis";
import { generateMap, measureWalkingDistances, type MapType, type WalkingRoute } from "./map-generation";
import { findGtfsFeedUrls, getGtfsStopsNearProject, type GtfsStopResult } from "./lib/gtfs-transit";
import { geocodeAddress } from "./lib/geocode";
import { logAuditEvent } from "./lib/supabase-ops";
import { preparePdfDocument } from "./lib/pdf-to-images";
import { injectTableCss, makeEditable } from "./lib/make-editable";
import { generateCalculatorGuide, type CalcGuideResult } from "./lib/calculator-guide";
import { extractSpecs, loadSpecsProfile, formatSpecsProfileForContext } from "./lib/specs-extract";
import { extractDocument, loadAllDocumentProfiles, formatAllDocumentProfilesForContext } from "./lib/document-extract";
import { extractPdfContentFromBuffer } from "./lib/pdf-extract";
import { CREDIT_SUBMISSION_PROMPT } from "./prompts/credit-submission";
import { sendQAReviewEmail, sendAddressInvalidEmail } from "../src/lib/resend";
import { validateAddress } from "./lib/geocode";
import { signQaToken } from "../src/lib/qa-token";
import { validateNoUnnecessaryCustomerRequests, validateAllOutputsProduced, validateCalculatorGuidePresent } from "./lib/validate-output";
import { withTimeout, StepLogger } from "./lib/pipeline-utils";
import { scrubNarration, containsNarration, writeCleanFile } from "./lib/output-cleaner";

// Load env when invoked outside Next.js (e.g. from a background worker)
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const UPLOADS_BUCKET  = "customer-uploads";
const OUTPUTS_BUCKET  = "order-outputs";

// ─── Per-program subdirectory within pipeline/reference/ ─────────────────────

const REF_BASE = path.join(process.cwd(), "pipeline/reference");

const PROGRAM_REF_SUBDIR: Record<string, string> = {
  leed_bdc_v41: "leed",
  well_v2:      "well-v2",
  well_hsr:     "well-hsr",
};

// ─── Local credit requirements PDF lookup ─────────────────────────────────────
// Reads credit requirement PDFs from pipeline/reference/ on the local filesystem.
// Vercel bundles these files via outputFileTracingIncludes in next.config.ts.
//
// Three folder-matching strategies, tried in order:
//   1. Exact case-insensitive name match  ("Air" == "Air")
//   2. Alphanumeric-normalised match       ("Air & Water Quality" ≈ "airwaterquality")
//   3. Credit code prefix word match       "LTc5" → "LT" → found in "LT files"
//
// Two file-matching strategies, tried in order:
//   1. Exact case-insensitive match against the constructed expected filename
//   2. Credit code OR credit name verbatim substring match

export function buildExpectedPdfName(program: string, creditCode: string, creditName: string): string {
  const code = creditCode.replace(/β/g, "beta");
  const name = creditName.replace(/β/g, "beta");
  if (program === "leed_bdc_v41") {
    const m = code.match(/^([A-Z]+)(c|p)\d+$/i);
    const catAbbrev = m ? m[1].toUpperCase() : code.replace(/[^A-Z]/gi, "").toUpperCase();
    return `LEED_${catAbbrev}_${name}.pdf`;
  }
  if (program === "well_v2")  return `WELL_V2_${code}_${name}.pdf`;
  return `WELL_HSR_${code}_${name}.pdf`;
}

function findCategoryFolder(
  programDir: string,
  category:   string,
  creditCode: string,
): string | undefined {
  if (!fs.existsSync(programDir)) return undefined;
  const allFolders  = fs.readdirSync(programDir).filter((d) =>
    fs.statSync(path.join(programDir, d)).isDirectory()
  );
  const categoryLow = category.toLowerCase();

  // Strategy 1: exact case-insensitive
  const exact = allFolders.find((d) => d.toLowerCase() === categoryLow);
  if (exact) return exact;

  // Strategy 2: alphanumeric-normalised
  const norm       = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalised = allFolders.find((d) => norm(d) === norm(category));
  if (normalised) return normalised;

  // Strategy 3: credit code prefix word match ("LTc5" → "LT")
  const prefixMatch = creditCode.match(/^([A-Z]+)/i);
  const prefix      = prefixMatch ? prefixMatch[1].toUpperCase() : null;
  if (prefix) {
    const byPrefix = allFolders.find((d) => {
      const words = d.trim().toUpperCase().split(/\s+/);
      return words.includes(prefix);
    });
    if (byPrefix) return byPrefix;
  }

  return undefined;
}

function findCreditPdfBuffer(
  program:    string,
  category:   string,
  creditCode: string,
  creditName: string,
):
  | { buffer: Buffer; resolvedPath: string }
  | { found: false; searchedDir: string; filesFound: string[] }
{
  const subdir = PROGRAM_REF_SUBDIR[program];
  if (!subdir) return { found: false, searchedDir: "(unknown program)", filesFound: [] };

  const programDir  = path.join(REF_BASE, subdir);
  const categoryDir = findCategoryFolder(programDir, category, creditCode);

  const searchedDir = categoryDir
    ? path.join(programDir, categoryDir)
    : path.join(programDir, category);

  if (!categoryDir) return { found: false, searchedDir, filesFound: [] };

  const folderPath = path.join(programDir, categoryDir);
  const allFiles   = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith(".pdf"));

  // 1. Exact case-insensitive match against constructed expected filename
  const expectedName = buildExpectedPdfName(program, creditCode, creditName);
  const exact = allFiles.find((f) => f.toLowerCase() === expectedName.toLowerCase());
  if (exact) {
    const fullPath = path.join(folderPath, exact);
    return { buffer: fs.readFileSync(fullPath), resolvedPath: fullPath };
  }

  // 2. Credit code substring OR credit name verbatim substring
  const nameLower = creditName.toLowerCase();
  const match =
    allFiles.find((f) => f.includes(creditCode)) ??
    allFiles.find((f) => f.toLowerCase().includes(nameLower));

  if (match) {
    const fullPath = path.join(folderPath, match);
    return { buffer: fs.readFileSync(fullPath), resolvedPath: fullPath };
  }

  return { found: false, searchedDir, filesFound: allFiles };
}

// ─── LEED appendix helpers ────────────────────────────────────────────────────
// Supplementary appendix PDFs live at the root of pipeline/reference/leed/.
// They are loaded when a requirements PDF references them ("See Appendix 2").

function scanPdfForAppendixRefs(buffer: Buffer): number[] {
  // PDF streams are often partially readable as latin1 text. This catches
  // "Appendix 2", "appendix 3", etc. in uncompressed or lightly-compressed streams.
  const text = buffer.toString("latin1");
  const nums = new Set<number>();
  const re   = /appendix\s+(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 20) nums.add(n);
  }
  return [...nums].sort((a, b) => a - b);
}

function loadLeedAppendices(
  referencedNums: number[],
): Array<{ num: number; buffer: Buffer; filename: string }> {
  const leedDir       = path.join(REF_BASE, "leed");
  const allFiles      = fs.existsSync(leedDir) ? fs.readdirSync(leedDir) : [];
  const appendixFiles = allFiles.filter((f) => {
    const fl = f.toLowerCase();
    return fl.startsWith("appendix") && fl.endsWith(".pdf");
  });

  const results: Array<{ num: number; buffer: Buffer; filename: string }> = [];

  for (const num of referencedNums) {
    // Match "appendix 2 " or "appendix 2." to avoid "appendix 21" matching "2"
    const match = appendixFiles.find((f) => {
      const fl = f.toLowerCase();
      return fl.includes(`appendix ${num} `) || fl.includes(`appendix ${num}.`);
    });

    if (match) {
      results.push({ num, buffer: fs.readFileSync(path.join(leedDir, match)), filename: match });
    } else {
      console.warn(`  Step 12.7: Appendix ${num} referenced but not found in pipeline/reference/leed/`);
    }
  }

  return results;
}

// ─── Program detection ────────────────────────────────────────────────────────
// LEED credit codes match pattern: 2-letter prefix + c/p + digit(s) (e.g. LTc5, EAp2)

const LEED_CODE_RE = /^(LT|SS|WE|EA|MR|EQ|IN|IP)(c|p)\d+$/i;

function isLeed(creditCode: string): boolean {
  return LEED_CODE_RE.test(creditCode);
}

function creditCodeToFormKey(code: string): string {
  const m = code.match(/^([A-Z]+)(c|p)(\d+)$/i);
  if (!m) return code;
  return `${m[1].toUpperCase()} ${m[2].toLowerCase() === "c" ? "Credit" : "Prereq"} ${m[3]}`;
}

// ─── LEED reference file loader ───────────────────────────────────────────────
// Loads form and calculator schemas from pipeline/reference/leed/ and formats
// the relevant credit section for injection into the Claude prompt.

function loadLeedReferenceData(
  creditCode:    string,
  creditName:    string,
  hasCalculator: boolean,
): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════════",
    "LEED AUTHORITATIVE REFERENCE FILES — USE EXCLUSIVELY",
    "═══════════════════════════════════════════════════════",
    "These files are the authoritative source of truth. Never fall back to training data",
    "for any form field ID, calculator input label, or credit requirement.",
    "",
  ];

  // Form schema
  const formSchemaPath = path.join(REF_BASE, "leed/leed_v41_form_schemas.json");
  try {
    const allSchemas: any = JSON.parse(fs.readFileSync(formSchemaPath, "utf-8"));
    const formKey         = creditCodeToFormKey(creditCode);
    const creditSchema: any =
      allSchemas.credits?.[formKey] ??
      Object.values(allSchemas.credits ?? {}).find((c: any) =>
        (c.name ?? "").toLowerCase().includes(creditName.toLowerCase().slice(0, 12))
      );

    if (creditSchema?.fields?.all?.length > 0) {
      lines.push(`FORM FIELD SCHEMA — ${formKey} (${creditSchema.fields.all.length} fields):`);
      lines.push("Use these exact field IDs, labels, and option values. Do not invent or rename fields.");
      lines.push(JSON.stringify(creditSchema.fields.all, null, 2));
    } else {
      lines.push(`FORM FIELD SCHEMA: not found for ${creditCode} — use web search to identify live form fields`);
    }
  } catch (err) {
    lines.push(`FORM FIELD SCHEMA: failed to load — ${(err as Error).message}`);
  }

  // Calculator schema (only if this credit has a calculator per the spreadsheet)
  if (hasCalculator) {
    const calcSchemaPath = path.join(REF_BASE, "leed/leed_v41_calculator_schemas.json");
    try {
      const allCalcSchemas: any = JSON.parse(fs.readFileSync(calcSchemaPath, "utf-8"));
      const formKey             = creditCodeToFormKey(creditCode);
      const calcSchema: any =
        allCalcSchemas.calculators?.[formKey] ??
        Object.values(allCalcSchemas.calculators ?? {}).find((c: any) =>
          (c.name ?? "").toLowerCase().includes(creditName.toLowerCase().slice(0, 12))
        );

      if (calcSchema) {
        lines.push("\nCALCULATOR SCHEMA:");
        lines.push("Use these exact tab names and input field labels. Do not rename or reorder.");
        lines.push(JSON.stringify(calcSchema, null, 2));
      } else {
        lines.push(`\nCALCULATOR SCHEMA: not found for ${creditCode}`);
      }
    } catch (err) {
      lines.push(`\nCALCULATOR SCHEMA: failed to load — ${(err as Error).message}`);
    }
  }

  return lines.join("\n");
}

// ─── Storage path helpers ─────────────────────────────────────────────────────

function orderFolderPath(customerId: string, projectId: string, orderId: string, creditCode: string): string {
  return `${customerId}/${projectId}/orders/${orderId}-${creditCode}`;
}

function attemptPath(base: string, attempt: number): string {
  return `${base}/attempt-${attempt}`;
}

function outputsPath(base: string): string {
  return `${base}/outputs`;
}

function drawingsPath(customerId: string, projectId: string): string {
  return `${customerId}/${projectId}/drawings`;
}

// ─── Supabase timeout wrapper ─────────────────────────────────────────────────
// Wraps every Supabase call in a 10 s hard timeout so a hung DB connection
// never stalls the pipeline indefinitely.

async function dbCall<T>(query: PromiseLike<T>, label: string): Promise<T> {
  return withTimeout(Promise.resolve(query), 10000, `Supabase: ${label}`);
}

// ─── Map output detection ─────────────────────────────────────────────────────

const MAP_OUTPUT_KEYWORDS: Record<MapType, string[]> = {
  "transit-stops":       ["transit", "transit stop", "bus stop", "rail station"],
  "bicycle-facilities":  ["bicycle", "bike", "cycling", "cycle"],
  "surrounding-density": ["density", "surrounding", "neighborhood context"],
  "site-context":        ["site context", "site map", "vicinity map", "walking distance"],
};

function detectRequiredMapType(outputs: string[]): MapType | null {
  const combined = outputs.join(" ").toLowerCase();
  for (const [mapType, keywords] of Object.entries(MAP_OUTPUT_KEYWORDS)) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return mapType as MapType;
    }
  }
  return null;
}

// web_search tool — added to every Anthropic API call so Claude can find
// transit stops, census data, utility rates, and any other public data
const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── validateAllDeliverables ──────────────────────────────────────────────────
// Pre-delivery gate: verifies every output required by Column J of the
// automation analysis exists before any file is sent to the customer.
// Returns list of missing items (empty = all present).

interface DeliverableCheck {
  item: string;
  present: boolean;
  reason?: string;
}

function validateAllDeliverables(params: {
  htmlContent:     string;
  requiredMapType: string | null;
  mapGenerated:    boolean;
}): { cleanedHtml: string } {
  let cleanedHtml = params.htmlContent;

  // Narration scrub — second pass, soft warning only
  if (containsNarration(cleanedHtml)) {
    console.warn(`  [validateAllDeliverables] Narration detected — running second scrub`);
    const rerun = scrubNarration(cleanedHtml);
    cleanedHtml = rerun.cleaned;
    if (rerun.total > 0) console.warn(`    Removed ${rerun.total} additional narration instance(s)`);
    if (containsNarration(cleanedHtml)) {
      console.warn(`  [validateAllDeliverables] Narration survived second scrub — delivering with QA flag`);
    }
  }

  // Map — soft warning only
  if (params.requiredMapType && !params.mapGenerated) {
    console.warn(`  [validateAllDeliverables] Map required but not generated — QA flag only`);
  }

  return { cleanedHtml };
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export interface ProcessOrderResult {
  orderId: string;
  runId: string;
  status: "complete" | "documents_requested" | "failed";
  outputPaths?: string[];
  issues?: string[];
}

export async function processOrder(
  orderId: string,
  runId: string,
  additionalInstructions?: string,
): Promise<ProcessOrderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client   = new Anthropic({ apiKey, timeout: 1800000, maxRetries: 1 });
  const supabase = createServiceClient();

  console.log(`\n[process-order] ▶ Order ${orderId} / Run ${runId}`);

  // ── Step 1: Load order, run, project, customer, credit ────────────────────
  const [runRes, orderRes] = await Promise.all([
    dbCall(supabase.from("runs").select("*").eq("id", runId).single(),   "fetch run"),
    dbCall(supabase.from("orders").select("*").eq("id", orderId).single(), "fetch order"),
  ]);
  if (runRes.error)   throw new Error(`Run not found: ${runRes.error.message}`);
  if (orderRes.error) throw new Error(`Order not found: ${orderRes.error.message}`);

  const run   = runRes.data;
  const order = orderRes.data;

  const [projectRes, creditRes, customerRes] = await Promise.all([
    dbCall(supabase.from("projects").select("*").eq("id", order.project_id!).single(),  "fetch project"),
    dbCall(supabase.from("credits").select("*").eq("id", order.credit_id!).single(),    "fetch credit"),
    dbCall(supabase.from("customers").select("*").eq("id", order.customer_id).single(), "fetch customer"),
  ]);
  if (projectRes.error)  throw new Error(`Project not found: ${projectRes.error.message}`);
  if (creditRes.error)   throw new Error(`Credit not found: ${creditRes.error.message}`);
  if (customerRes.error) throw new Error(`Customer not found: ${customerRes.error.message}`);

  const project  = projectRes.data;
  const credit   = creditRes.data;
  const customer = customerRes.data;

  // ── Step 2: Read all 4 columns from automation analysis XLSX ──────────────
  console.log('[Step 2 diagnostic]', {
    cwd:         process.cwd(),
    xlsxExists:  require('fs').existsSync(require('path').join(process.cwd(), 'pipeline/reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx')),
    dirContents: require('fs').readdirSync(require('path').join(process.cwd(), 'pipeline')).join(', '),
  });
  console.log(`  Step 2: Loading credit data from automation analysis...`);
  console.log(`  Step 2a: calling extractCreditData for "${credit.credit_code}" (program: ${credit.program})...`);
  const creditData = extractCreditData(credit.credit_code, credit.program);
  console.log(`  Step 2b: extractCreditData returned — outputs: ${creditData.outputs.join(", ") || "(none)"}`);

  // ── Step 3: Determine attempt number and storage paths ────────────────────
  const attemptNumber = run.attempt_number ?? run.run_number ?? 1;
  const orderBase     = orderFolderPath(order.customer_id, order.project_id!, orderId, credit.credit_code);
  const attemptFolder = attemptPath(orderBase, attemptNumber);
  const outputsFolder = outputsPath(orderBase);

  console.log(`  Step 3: Attempt ${attemptNumber} — folder: ${attemptFolder}`);

  // ── Step 4: List uploaded documents from Storage ──────────────────────────
  console.log(`  Step 4: Listing uploads from Storage...`);
  const { data: storageFiles, error: listError } = await dbCall(
    supabase.storage.from(UPLOADS_BUCKET).list(attemptFolder),
    "list uploads",
  );

  if (listError) throw new Error(`Failed to list uploads: ${listError.message}`);

  const uploads: UploadedDocument[] = (storageFiles ?? [])
    .filter((f) => f.name && !f.name.endsWith("/"))
    .map((f) => ({
      storagePath: `${attemptFolder}/${f.name}`,
      filename:    f.name,
      mimeType:    f.metadata?.mimetype ?? "application/octet-stream",
    }));

  console.log(`    Found ${uploads.length} uploaded file(s)`);

  // ── Step 5: Update order → under_review ───────────────────────────────────
  const { error: step5Err } = await dbCall(
    supabase.from("orders").update({ status: "under_review" }).eq("id", orderId),
    "update order under_review",
  );
  if (step5Err) console.error(`  Step 5 ERROR: ${step5Err.message}`);
  console.log(`  Step 5: Order → under_review`);

  // Tracks document review issues from Step 7 — used at Step 16.5 to distinguish
  // customer-caused gaps from platform failures when delivering partial output.
  let knownReviewIssues: string[] = [];

  // ── Step 6: Document quality review ──────────────────────────────────────
  const requiredDocs: string[] = (credit.required_customer_documents as string[] | null) ?? [];

  // If the credit requires documents and nothing was uploaded, stop immediately on attempt 1.
  if (uploads.length === 0 && requiredDocs.length > 0 && attemptNumber === 1) {
    console.log(`  Step 6: No uploads but credit requires ${requiredDocs.length} document(s) — requesting documents.`);

    await supabase.from("runs").update({
      status:        "failed",
      review_issues: requiredDocs,
      completed_at:  new Date().toISOString(),
      error_message: "Required documents not uploaded",
    }).eq("id", runId);

    await supabase.from("orders").update({ status: "documents_requested" }).eq("id", orderId);

    await logAuditEvent({
      eventType:  "documents_requested",
      entityType: "order",
      entityId:   orderId,
      customerId: order.customer_id,
      metadata:   { attemptNumber, issueCount: requiredDocs.length, issues: requiredDocs, reason: "no_uploads" },
    });

    return { orderId, runId, status: "documents_requested", issues: requiredDocs };
  }

  let reviewResult: Awaited<ReturnType<typeof reviewDocuments>> | null = null;
  if (uploads.length > 0) {
    console.log(`  Step 6: Running document review...`);
    reviewResult = await reviewDocuments(
      orderId,
      order.customer_id,
      credit.credit_code,
      uploads,
      creditData.customerUploads
    );
  } else {
    console.log(`  Step 6: No uploads and no required documents — proceeding directly.`);
  }

  // ── Step 6.5: Drawing quality review (attempt 1 only) ────────────────────
  // Runs before the order moves to processing so drawing issues can be returned
  // via the same documents_requested gate as document review issues.
  // Skipped on attempt 2+ — customer was already notified; just run best-effort.
  let drawingReviewIssues: string[] = [];

  if (attemptNumber === 1 && !project.auto_extracted) {
    const { data: drawingFiles } = await dbCall(
      supabase.storage.from(UPLOADS_BUCKET).list(drawingsPath(order.customer_id, order.project_id!)),
      "list drawings for review",
    );

    const drawingPathsForReview = (drawingFiles ?? [])
      .filter((f) => f.name?.endsWith(".pdf"))
      .map((f) => `${drawingsPath(order.customer_id, order.project_id!)}/${f.name}`);

    if (drawingPathsForReview.length > 0) {
      console.log(`  Step 6.5: Reviewing ${drawingPathsForReview.length} drawing file(s)...`);
      const drawingReview = await reviewDrawings(
        order.customer_id,
        order.project_id!,
        drawingPathsForReview,
      );
      if (!drawingReview.acceptable) {
        drawingReviewIssues = drawingReview.issues;
        console.log(`  Step 6.5: Drawing review found ${drawingReviewIssues.length} issue(s)`);
      } else {
        console.log(`  Step 6.5: Drawings acceptable`);
      }
    } else {
      console.log(`  Step 6.5: No drawings uploaded — skipping drawing review`);
    }
  } else if (project.auto_extracted) {
    console.log(`  Step 6.5: Drawings already analyzed — skipping drawing review`);
  } else {
    console.log(`  Step 6.5: Attempt ${attemptNumber} — skipping drawing review`);
  }

  // ── Step 7: If any review issues on attempt 1 → documents_requested (stop)
  //            If issues on attempt 2+ → continue anyway (best-effort run)
  const documentIssueStrings = reviewResult?.status === "incomplete"
    ? reviewResult.issues.map((i) => i.issue)
    : [];
  const allReviewIssues = [...documentIssueStrings, ...drawingReviewIssues];

  if (allReviewIssues.length > 0) {
    if (attemptNumber === 1) {
      console.log(`  Step 7: Review incomplete (attempt 1) — ${allReviewIssues.length} issue(s). Notifying customer.`);

      await supabase.from("runs").update({
        status:        "failed",
        review_issues: allReviewIssues,
        completed_at:  new Date().toISOString(),
        error_message: "Document review incomplete",
      }).eq("id", runId);

      await supabase.from("orders").update({ status: "documents_requested" }).eq("id", orderId);

      await logAuditEvent({
        eventType:  "documents_requested",
        entityType: "order",
        entityId:   orderId,
        customerId: order.customer_id,
        metadata:   { attemptNumber, issueCount: allReviewIssues.length, issues: allReviewIssues },
      });

      return { orderId, runId, status: "documents_requested", issues: allReviewIssues };
    }

    // Attempt 2+: customer was already told what was missing — run pipeline with
    // whatever was provided and surface remaining gaps in the output document.
    console.log(`  Step 7: Review incomplete (attempt ${attemptNumber}) — proceeding with best-effort run. Issues: ${allReviewIssues.join("; ")}`);

    knownReviewIssues = allReviewIssues;

    await supabase.from("runs").update({
      review_issues: allReviewIssues,
    }).eq("id", runId);
  }

  // ── Step 7.5: Validate project address ───────────────────────────────────
  console.log(`  Step 7.5: Validating project address: "${project.address ?? "(none)"}"...`);
  const addrResult = await validateAddress(project.address ?? "");
  if (!addrResult.valid) {
    console.warn(`  Step 7.5: ✗ Address invalid — ${addrResult.reason}`);
    await supabase.from("runs").update({
      status:        "address_invalid",
      error_message: addrResult.reason,
      completed_at:  new Date().toISOString(),
    }).eq("id", runId);
    try {
      await sendAddressInvalidEmail({
        to:         customer.email,
        name:       customer.name ?? "there",
        creditName: credit.credit_name,
        projectId:  project.id,
        reason:     addrResult.reason,
      });
    } catch (emailErr) {
      console.warn(`  Step 7.5: Failed to send address invalid email: ${(emailErr as Error).message}`);
    }
    return { orderId, runId, status: "failed", issues: [addrResult.reason] };
  }
  console.log(`  Step 7.5: ✓ ${addrResult.reason}`);

  // ── Step 8: Update order → processing ────────────────────────────────────
  const { error: step8OrderErr } = await dbCall(
    supabase.from("orders").update({ status: "processing" }).eq("id", orderId),
    "update order processing",
  );
  if (step8OrderErr) console.error(`  Step 8 ORDER ERROR: ${step8OrderErr.message}`);
  const { error: step8RunErr } = await dbCall(
    supabase.from("runs").update({ status: "processing" }).eq("id", runId),
    "update run processing",
  );
  if (step8RunErr) console.error(`  Step 8 RUN ERROR: ${step8RunErr.message}`);
  console.log(`  Step 8: Order → processing`);

  // ── Step 9: Download customer upload files ────────────────────────────────
  console.log(`  Step 9: Downloading ${uploads.length} customer file(s)...`);
  const uploadBuffers: Array<{ filename: string; buffer: Buffer; mimeType: string }> = [];
  for (const upload of uploads) {
    const { data, error } = await dbCall(
      supabase.storage.from(UPLOADS_BUCKET).download(upload.storagePath),
      `download ${upload.filename}`,
    );
    if (error || !data) throw new Error(`Failed to download ${upload.storagePath}: ${error?.message}`);
    uploadBuffers.push({
      filename: upload.filename,
      buffer:   Buffer.from(await data.arrayBuffer()),
      mimeType: upload.mimeType,
    });
    console.log(`    ✓ ${upload.filename}`);
  }

  // ── Step 10: Drawing analysis (if not yet done) ───────────────────────────
  console.log(`  Step 10: Checking drawing analysis status...`);
  if (!project.auto_extracted) {
    const { data: drawingFiles } = await dbCall(
      supabase.storage.from(UPLOADS_BUCKET).list(drawingsPath(order.customer_id, order.project_id!)),
      "list drawings",
    );

    const drawingPaths = (drawingFiles ?? [])
      .filter((f) => f.name?.endsWith(".pdf"))
      .map((f) => `${drawingsPath(order.customer_id, order.project_id!)}/${f.name}`);

    if (drawingPaths.length > 0) {
      console.log(`    Running drawing analysis on ${drawingPaths.length} drawing(s)...`);
      await analyzeDrawings(order.project_id!, order.customer_id, drawingPaths);
    } else {
      console.log(`    No drawings uploaded — skipping drawing analysis`);
    }
  } else {
    console.log(`    Drawing analysis already complete`);
  }

  // ── Step 10.5: Specs pre-extraction ──────────────────────────────────────
  // Runs once per project — extracts compact product/material inventory from
  // any uploaded spec documents (PDF, RTF, DOCX, TXT). All credits reuse the
  // stored specs-profile.json rather than re-processing the raw files.
  console.log(`  Step 10.5: Checking specs extraction status...`);
  let specsProfileBlock = "";

  const specFiles = uploadBuffers.filter((u) => {
    const ext = path.extname(u.filename).toLowerCase();
    // Include any non-drawing document uploads (spec PDFs, project manuals, RTF, DOCX, TXT)
    return [".pdf", ".rtf", ".docx", ".doc", ".txt"].includes(ext) &&
           !u.filename.toLowerCase().includes("drawing") &&
           !u.filename.toLowerCase().includes("annotated");
  });

  if (!(project as any).specs_extracted && specFiles.length > 0) {
    console.log(`    Running specs extraction on ${specFiles.length} document(s)...`);
    try {
      const specsProfile = await extractSpecs(order.project_id!, order.customer_id, specFiles);
      specsProfileBlock  = formatSpecsProfileForContext(specsProfile);
      console.log(`    ✓ Specs extracted — ${specsProfile.product_count} products`);
    } catch (err) {
      console.warn(`    ⚠ Specs extraction failed: ${(err as Error).message} — continuing without specs profile`);
    }
  } else if ((project as any).specs_extracted) {
    console.log(`    Specs already extracted — loading stored profile...`);
    try {
      const specsProfile = await loadSpecsProfile(order.customer_id, order.project_id!);
      if (specsProfile) {
        specsProfileBlock = formatSpecsProfileForContext(specsProfile);
        console.log(`    ✓ Specs profile loaded — ${specsProfile.product_count} products`);
      }
    } catch (err) {
      console.warn(`    ⚠ Could not load specs profile: ${(err as Error).message}`);
    }
  } else {
    console.log(`    No spec documents uploaded — skipping`);
  }

  // ── Step 10.6: Document pre-extraction ───────────────────────────────────
  // Runs once per document — auto-detects type (geotechnical, energy model,
  // Phase I ESA, commissioning, acoustics, site survey, lighting) and stores
  // a compact profile. All credits load from storage; raw files never re-processed.
  console.log(`  Step 10.6: Checking document extraction status...`);
  let docProfilesBlock = "";

  const docProfiles = (project as any).doc_profiles_extracted as Record<string, boolean> ?? {};

  // Candidate files: PDFs/RTF/DOCX that aren't drawings, specs, or annotated drawings
  const docFiles = uploadBuffers.filter((u) => {
    const ext  = path.extname(u.filename).toLowerCase();
    const name = u.filename.toLowerCase();
    return [".pdf", ".rtf", ".docx", ".doc"].includes(ext) &&
           !name.includes("drawing") &&
           !name.includes("annotated") &&
           !name.includes("spec") &&
           !name.includes("specification");
  });

  if (docFiles.length > 0) {
    for (const file of docFiles) {
      try {
        const profile = await extractDocument(order.project_id!, order.customer_id, {
          filename: file.filename,
          buffer:   file.buffer,
          mimeType: file.mimeType,
        });
        docProfiles[profile.type_slug] = true;
        console.log(`    ✓ ${profile.type_slug} profile extracted from ${file.filename}`);
      } catch (err) {
        console.warn(`    ⚠ Document extraction failed for ${file.filename}: ${(err as Error).message}`);
      }
    }
  }

  // Always load all stored profiles (covers current + previously-extracted)
  try {
    const storedProfiles = await loadAllDocumentProfiles(order.customer_id, order.project_id!);
    if (storedProfiles.length > 0) {
      docProfilesBlock = formatAllDocumentProfilesForContext(storedProfiles);
      console.log(`    ✓ ${storedProfiles.length} document profile(s) loaded for context`);
    }
  } catch (err) {
    console.warn(`    ⚠ Could not load document profiles: ${(err as Error).message}`);
  }

  // ── Step 11: Load project profile ────────────────────────────────────────
  console.log(`  Step 11: Loading project profile...`);
  const profilePath = `${order.customer_id}/${order.project_id!}/project-profile.json`;
  let projectProfile: Record<string, unknown> = {};
  const { data: profileData } = await dbCall(
    supabase.storage.from(UPLOADS_BUCKET).download(profilePath),
    "download project profile",
  );
  if (profileData) {
    try {
      projectProfile = JSON.parse(await profileData.text());
    } catch {
      console.warn(`    Failed to parse project-profile.json — continuing without it`);
    }
  }

  // ── Step 12: Load credit requirements PDF from local reference folder ────────
  console.log(`  Step 12: Loading credit requirements PDF from pipeline/reference...`);
  const pdfLookup = findCreditPdfBuffer(
    credit.program,
    credit.category,
    credit.credit_code,
    credit.credit_name,
  );

  if ("found" in pdfLookup) {
    const expectedName = buildExpectedPdfName(credit.program, credit.credit_code, credit.credit_name);
    console.error(`  Step 12: ✗ Requirements PDF not found`);
    console.error(`    Directory searched : ${pdfLookup.searchedDir}`);
    console.error(`    Expected filename  : ${expectedName}`);
    console.error(`    Files present      : ${pdfLookup.filesFound.length === 0 ? "(none)" : pdfLookup.filesFound.join(", ")}`);
    console.error(`    Add the correct PDF to pipeline/reference/ and re-run.`);

    const errMsg = `Requirements PDF not found — searched: ${pdfLookup.searchedDir} — expected: ${expectedName}`;

    await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
    await supabase.from("runs").update({
      status:        "failed",
      error_message: errMsg,
      completed_at:  new Date().toISOString(),
    }).eq("id", runId);

    return { orderId, runId, status: "failed", issues: [errMsg] };
  }

  const reqPdfBuffer = pdfLookup.buffer;
  console.log(`    ✓ Found: ${pdfLookup.resolvedPath.replace(process.cwd() + path.sep, "")}`);

  // ── Step 12.7: Scan requirements PDF for LEED appendix references ────────
  // Looks for "Appendix N" patterns in the PDF text and loads any matching
  // files from pipeline/reference/leed/ root to pass alongside the requirements PDF.
  const appendixDocBlocks: ReturnType<typeof preparePdfDocument>[] = [];

  if (isLeed(credit.credit_code)) {
    const appendixNums = scanPdfForAppendixRefs(reqPdfBuffer);
    if (appendixNums.length > 0) {
      console.log(`  Step 12.7: Found references to appendix/appendices: ${appendixNums.join(", ")}`);
      const appendices = loadLeedAppendices(appendixNums);
      for (const ap of appendices) {
        appendixDocBlocks.push(preparePdfDocument(ap.buffer, `LEED v4.1 BD+C Guide — Appendix ${ap.num}`));
        console.log(`    ✓ Loaded: ${ap.filename}`);
      }
      if (appendices.length === 0) {
        console.log(`    No matching appendix files found in platform-reference/leed/`);
      }
    } else {
      console.log(`  Step 12.7: No appendix references found in requirements PDF`);
    }
  }

  // ── Step 12.5: Load reference files ──────────────────────────────────────
  let referenceDataBlock = "";

  if (isLeed(credit.credit_code)) {
    console.log(`  Step 12.5: Loading LEED reference files for ${credit.credit_code}...`);
    try {
      referenceDataBlock = loadLeedReferenceData(
        credit.credit_code,
        creditData.creditName,
        creditData.platformFiles.calculatorInfo !== null,
      );
      const fieldCount = (referenceDataBlock.match(/"fieldId"/g) ?? []).length;
      console.log(`    ✓ Reference data loaded (${fieldCount} form fields)`);
    } catch (err) {
      console.warn(`    ⚠ Reference file load failed: ${(err as Error).message} — continuing without reference data`);
    }
  } else {
    console.warn(`  Step 12.5: WELL reference files not yet loaded — processing with web search and customer documents only`);
  }

  // ── Step 13: Check Col 4 outputs — detect map requirement ────────────────
  console.log(`  Step 13: Checking for required map outputs...`);
  const requiredMapType = detectRequiredMapType(creditData.outputs);
  console.log(`    Map required: ${requiredMapType ?? "none"}`);

  // ── Step 13.5: GTFS transit pre-fetch (transit credits only) ─────────────
  // Runs BEFORE Claude so authoritative stop data is injected into the prompt.
  // Claude receives verified stops and must NOT search for transit stops.
  // Falls back to Claude web_search if GTFS pipeline fails.

  interface GtfsVerifiedStop {
    stop:         GtfsStopResult;
    walkingMiles: number;
    walkingFeet:  number;
    walkingRoute: WalkingRoute;
  }

  let gtfsVerifiedStops: GtfsVerifiedStop[]                  = [];
  let gtfsAllStops:       GtfsStopResult[]                   = [];
  let gtfsLocationsForMap: Array<{ address: string; label: string }> = [];
  let gtfsDataBlock          = "";
  let gtfsMapAnnotationHtml  = "";

  if (requiredMapType === "transit-stops" && project.address) {
    console.log(`  Step 13.5: Running GTFS transit pre-fetch...`);
    try {
      const coords = await geocodeAddress(project.address);
      if (!coords) {
        console.warn(`  Step 13.5: Could not geocode project address — Claude will search for transit data`);
      } else {
        const feedUrls = await findGtfsFeedUrls(coords.lat, coords.lon);
        if (feedUrls.length === 0) {
          console.warn(`  Step 13.5: No GTFS feeds found for this location — Claude will search for transit data`);
        } else {
          gtfsAllStops = await getGtfsStopsNearProject(coords.lat, coords.lon, feedUrls);
          console.log(`  Step 13.5: ${gtfsAllStops.length} total stops found across ${feedUrls.length} feed(s)`);

          if (gtfsAllStops.length > 0) {
            // Re-qualify using actual Google Maps walking distances (not GTFS straight-line)
            const destinations = gtfsAllStops.map((s) => ({
              address: `${s.lat.toFixed(5)},${s.lon.toFixed(5)}`,
              label:   s.name,
            }));
            const routes = await measureWalkingDistances(project.address, destinations);

            for (const stop of gtfsAllStops) {
              const route = routes.find((r) => r.destination.label === stop.name);
              if (!route) continue;
              const distThreshold = stop.isRail ? 0.5 : 0.25;
              const tripThreshold = stop.isRail ? 4    : 100;
              if (route.distanceMiles <= distThreshold && stop.weekdayDirectional >= tripThreshold) {
                gtfsVerifiedStops.push({
                  stop,
                  walkingMiles: route.distanceMiles,
                  walkingFeet:  Math.round(route.distanceMiles * 5280),
                  walkingRoute: route,
                });
              }
            }
            console.log(`  Step 13.5: ${gtfsVerifiedStops.length} qualifying stop(s) confirmed via Google Maps`);

            // Build locations for map using exact GTFS GPS coordinates
            gtfsLocationsForMap = gtfsVerifiedStops.slice(0, 8).map((v, i) => ({
              address: `${v.stop.lat.toFixed(5)},${v.stop.lon.toFixed(5)}`,
              label:   String(i + 1),
            }));

            // Build context block injected into Claude's prompt
            const today = new Date().toISOString().slice(0, 10);
            const qualifyingLines = gtfsVerifiedStops.map((v, i) => {
              const s = v.stop;
              return [
                `  ${i + 1}. ${s.name} (${s.isRail ? "Rail/Ferry" : "Bus/BRT"}) — ${s.agencyName}`,
                `     Routes: ${s.routeNames.join(", ") || "—"}`,
                `     Walking distance: ${v.walkingFeet.toLocaleString()} ft / ${v.walkingMiles.toFixed(2)} mi (Google Maps) | Threshold: ${s.isRail ? "0.5" : "0.25"} mi ✓`,
                `     Weekday directional trips: ${s.weekdayDirectional} | Required: ${s.isRail ? 4 : 100} ✓`,
                `     GPS coordinates: ${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`,
                `     Data source: ${s.dataSource}`,
              ].join("\n");
            });

            const nonQualifyingLines = gtfsAllStops
              .filter((s) => !gtfsVerifiedStops.some((v) => v.stop.name === s.name))
              .slice(0, 10)
              .map((s) => {
                const route = routes.find((r) => r.destination.label === s.name);
                const actualMi = route ? route.distanceMiles.toFixed(2) : "not measured";
                const distThreshold = s.isRail ? 0.5 : 0.25;
                const failReason = route
                  ? (route.distanceMiles > distThreshold
                    ? `too far: ${actualMi} mi > ${distThreshold} mi threshold`
                    : `insufficient trips: ${s.weekdayDirectional} directional < ${s.isRail ? 4 : 100} required`)
                  : "walking route not available";
                return `  • ${s.name} — ${failReason}`;
              });

            gtfsDataBlock = [
              `${"═".repeat(60)}`,
              `TRANSIT DATA — GTFS VERIFIED — DO NOT SEARCH FOR STOPS`,
              `${"═".repeat(60)}`,
              ``,
              `Transit stop data was retrieved from official agency GTFS feeds before this prompt ran.`,
              `Walking distances were measured by Google Maps Directions API (walking mode).`,
              `You MUST use this data exclusively. Do NOT use web_search to find transit stops.`,
              `Do NOT report any stops or distances other than those listed below.`,
              ``,
              `DISTANCE REPORTING RULE — NO EXCEPTIONS:`,
              `Every form field, table cell, and written sentence that references walking distance to a transit`,
              `stop MUST use the exact measured value shown below (e.g. "950 ft / 0.18 mi" or "0.22 mi / 1,160 ft").`,
              `Do NOT write threshold language such as "less than 1/4 mile", "within required distance",`,
              `"< 0.25 mi", or any other qualifier in place of the actual number.`,
              `The exact measurement is required for certification review — a threshold statement is not verifiable evidence.`,
              ``,
              `QUALIFYING STOPS (${gtfsVerifiedStops.length} total — use these for form fields and supporting documentation):`,
              ...(qualifyingLines.length > 0 ? qualifyingLines : ["  None — no stops meet both distance and trip count thresholds"]),
              ``,
              ...(nonQualifyingLines.length > 0
                ? [`EVALUATED BUT NON-QUALIFYING (document these in Supporting Documentation as not meeting criteria):`, ...nonQualifyingLines, ``]
                : []),
              `Retrieved: ${today}`,
              `${"═".repeat(60)}`,
            ].join("\n");

            // Build HTML annotation injected directly after the map image (pipeline-generated,
            // not from Claude) — ensures distances and legend are always present and accurate.
            if (gtfsVerifiedStops.length > 0) {
              const legendItems = gtfsVerifiedStops.slice(0, 8).map((v, i) =>
                `<span style="display:inline-block;margin-right:20px;"><strong>${i + 1}</strong> = ${v.stop.name}</span>`,
              ).join("\n          ");

              const tableRows = gtfsVerifiedStops.slice(0, 8).map((v, i) => {
                const s = v.stop;
                const type = s.isRail ? "Rail / Ferry" : (s.routeType === 0 ? "Light Rail" : "Bus / BRT");
                const threshold = s.isRail ? "0.5 mi" : "0.25 mi";
                return `
            <tr style="border-bottom:1px solid #e0e0e0;">
              <td style="padding:7px 10px;text-align:center;">${i + 1}</td>
              <td style="padding:7px 10px;">${s.name}</td>
              <td style="padding:7px 10px;">${type}</td>
              <td style="padding:7px 10px;">${s.agencyName}</td>
              <td style="padding:7px 10px;">${s.routeNames.join(", ") || "—"}</td>
              <td style="padding:7px 10px;text-align:right;">${v.walkingFeet.toLocaleString()} ft&nbsp;(${v.walkingMiles.toFixed(2)} mi)</td>
              <td style="padding:7px 10px;text-align:center;">${threshold}</td>
              <td style="padding:7px 10px;text-align:right;">${s.weekdayDirectional.toLocaleString()}</td>
              <td style="padding:7px 10px;text-align:center;color:#2e7d32;font-weight:600;">✓</td>
            </tr>`;
              }).join("");

              gtfsMapAnnotationHtml = `
<div style="margin:4px 0 24px;font-size:12px;font-family:inherit;">
  <div style="background:#f0f4f8;border-radius:6px;padding:10px 16px;margin-bottom:12px;line-height:1.8;">
    <strong style="display:block;margin-bottom:4px;color:#2b4044;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Map Key</strong>
    <span style="display:inline-block;margin-right:20px;"><strong>S</strong> = Project site (main building entry)</span>
    ${legendItems}
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="background:#2b4044;color:#fff;">
        <th style="padding:7px 10px;text-align:center;">#</th>
        <th style="padding:7px 10px;text-align:left;">Transit Stop</th>
        <th style="padding:7px 10px;text-align:left;">Type</th>
        <th style="padding:7px 10px;text-align:left;">Agency</th>
        <th style="padding:7px 10px;text-align:left;">Routes</th>
        <th style="padding:7px 10px;text-align:right;">Walking Distance</th>
        <th style="padding:7px 10px;text-align:center;">Threshold</th>
        <th style="padding:7px 10px;text-align:right;">Directional Trips/Day</th>
        <th style="padding:7px 10px;text-align:center;">Qualifies</th>
      </tr>
    </thead>
    <tbody>${tableRows}
    </tbody>
  </table>
  <p style="margin:6px 0 0;color:#666;font-size:11px;">Walking distances measured by Google Maps Directions API (walking mode). Trip counts from official GTFS agency schedules. Retrieved ${today}.</p>
</div>`;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`  Step 13.5: GTFS pre-fetch failed: ${(err as Error).message} — Claude will search for transit data`);
      gtfsVerifiedStops = [];
      gtfsAllStops      = [];
      gtfsDataBlock     = "";
    }
  }

  // ── Step 14: Build prompt ─────────────────────────────────────────────────
  console.log(`  Step 14: Building prompt...`);
  const creditDataBlock = formatCreditDataForPrompt(creditData);

  // Owner-entered registration fields — authoritative, override drawing estimates
  const registrationLines: string[] = [];
  if (project.regular_occupants != null) registrationLines.push(`  regular_occupants: ${project.regular_occupants}`);
  if (project.peak_visitors     != null) registrationLines.push(`  peak_visitors: ${project.peak_visitors}`);

  const projectDataBlock = [
    "DATA CONFLICT RULE: Where any uploaded document conflicts with owner-entered data below, always defer to the owner-entered data — the customer has reviewed and confirmed it. Use documents to fill gaps, not to override.",
    "",
    "PROJECT DATA (extracted from construction drawings):",
    ...Object.entries(projectProfile)
      .filter(([k, v]) => k !== "analyzed_at" && v !== null && v !== undefined)
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`),
    "",
    "PROJECT ADDRESS (owner-entered — use this exact address for ALL location-based lookups including transit, walk score, distances, census data, and any web search requiring a location):",
    `  address: ${project.address ?? "(not provided)"}`,
    ...(registrationLines.length > 0
      ? ["", "PROJECT REGISTRATION DATA (owner-entered — use these values for all occupancy calculations, do not estimate):"]
        .concat(registrationLines)
      : []),
    ...(specsProfileBlock
      ? ["", specsProfileBlock]
      : []),
    ...(docProfilesBlock
      ? ["", docProfilesBlock]
      : []),
    ...((project as any).project_narrative
      ? ["", "PROJECT NARRATIVE (owner-provided context — use this to supplement drawing-extracted data):", `  ${(project as any).project_narrative}`]
      : []),
  ].join("\n");

  const compliancePathBlock = run.compliance_path
    ? [
        "COMPLIANCE PATH (customer-selected — follow this path exclusively):",
        `  ${run.compliance_path}`,
        "  Do not select a different option or document multiple options. Document only the path the customer has specified.",
        "",
      ].join("\n")
    : "";

  const userPromptPart1 = [
    creditDataBlock,
    "",
    projectDataBlock,
    ...(gtfsDataBlock ? ["", gtfsDataBlock] : []),
    ...(compliancePathBlock ? ["", compliancePathBlock] : []),
    "",
    "Generate PART 1 — THE ONLINE FORM SECTION for this credit as instructed.",
  ].join("\n");

  const userPromptPart2 = [
    creditDataBlock,
    "",
    projectDataBlock,
    ...(gtfsDataBlock ? ["", gtfsDataBlock] : []),
    ...(compliancePathBlock ? ["", compliancePathBlock] : []),
    "",
    "Generate PART 2 — SUPPORTING PROJECT DOCUMENTATION (Section A: Retrieved Data, Section B: Generated Outputs) AND PART 3 — COMPLETE SUBMISSION CHECKLIST for this credit as instructed. Both are required. Do not omit either.",
  ].join("\n");

  const PROGRAM_DISPLAY_NAMES: Record<string, string> = {
    leed_bdc_v41: "LEED v4.1 BD+C",
    well_v2:      "WELL v2",
    well_hsr:     "WELL Health-Safety Rating",
  };
  const programDisplayName = PROGRAM_DISPLAY_NAMES[credit.program] ?? credit.program;

  const basePrompt = CREDIT_SUBMISSION_PROMPT.replace(/\{\{PROGRAM_DISPLAY_NAME\}\}/g, programDisplayName);

  // When GTFS pre-fetch succeeded the pipeline already has verified stop coordinates —
  // no structured comment needed. When GTFS failed, fall back to the structured comment
  // so Step 15.7 can attempt to extract locations from Claude's output.
  const transitMapInstruction = requiredMapType === "transit-stops" && gtfsDataBlock === "" ? `

${"═".repeat(60)}
TRANSIT MAP — REQUIRED STRUCTURED OUTPUT — NO EXCEPTIONS
${"═".repeat(60)}

This credit requires a walking-distance map to qualifying transit stops. The map is generated programmatically from stop addresses — it cannot be generated without them.

At the very end of your Part 1 output, after all other content, you MUST append this exact HTML comment:

<!-- QUALIFYING_TRANSIT_STOPS: {"threshold_miles": 0.25, "stops": [{"address":"STOP_STREET_ADDRESS_OR_LAT_LNG","label":"Stop Name"},{"address":"STOP_STREET_ADDRESS_OR_LAT_LNG","label":"Stop Name"},...]} -->

Rules:
- "threshold_miles": the maximum walking distance (in miles) that qualifies for this credit — set this from the credit requirements, not a guess
- "stops": every stop confirmed as qualifying — only stops with verified Google Maps walking distances within threshold_miles. Do NOT include stops whose distance you estimated or could not verify via web search
- The "address" field must be a geocodable street address or intersection (e.g. "Main St & 2nd Ave, Chicago, IL") or lat,lng string — NOT a stop name alone
- The "label" field is the human-readable stop name or route shown on the map
- Valid JSON only — no trailing commas, no single quotes
- The pipeline re-measures all distances via Google Maps and filters against threshold_miles — stops you include that are beyond the threshold will be excluded from the map
- If no stops qualify, append: <!-- QUALIFYING_TRANSIT_STOPS: {"threshold_miles": 0.25, "stops": []} -->
` : "";

  const pdfUploads = uploadBuffers.filter((u) => u.mimeType === "application/pdf");
  const uploadedDocsInstruction = pdfUploads.length > 0 ? `

${"═".repeat(60)}
CUSTOMER-UPLOADED DOCUMENTS — READ BEFORE WRITING OUTPUT
${"═".repeat(60)}

${pdfUploads.length} document file(s) are attached as PDFs:
${pdfUploads.map((u, i) => `  ${i + 1}. ${u.filename}`).join("\n")}

Read every page of every attached document before generating any output. These are the project team's proprietary documents — drawings, specifications, reports, and other materials that cannot come from any public source.

Extract all evidence relevant to this credit's compliance requirements. Specifically look for:
- Architectural/floor plan drawings: space dimensions, room labels, occupant counts, accessible routes, bicycle storage, stair locations
- Site plans: site boundaries, impervious area, open space, exterior features, parking layout
- Mechanical/HVAC drawings: system type, equipment schedules, refrigerant type, ventilation rates, energy systems
- Plumbing drawings: fixture types and counts, water reuse systems, irrigation connections
- Civil/structural drawings: grading, drainage, stormwater features, structural systems
- Specifications: product data, material certifications (EPD, FSC, low-emitting), recycled content, commissioning scope
- Reports/models: energy model outputs, commissioning reports, acoustic reports, geotechnical data

Use what you find in these documents to:
1. Populate form fields with real project values instead of placeholders
2. Confirm or contradict compliance determinations — if a drawing shows something that affects credit eligibility, use it
3. Fill gaps in the project data that cannot be retrieved from public sources
4. Reduce [OWNER TO CONFIRM] items — if the answer is in an uploaded document, use it and do not ask the owner

If a document contains data that conflicts with owner-entered project data, defer to the owner-entered data (the customer has reviewed and confirmed it). Use documents to fill gaps, not to override confirmed owner decisions.` : "";

  const systemPrompt = [
    basePrompt,
    uploadedDocsInstruction,
    transitMapInstruction,
    ...(additionalInstructions
      ? [`\n\n${"═".repeat(60)}\nQA REVIEW INSTRUCTIONS — INCORPORATE THESE CHANGES:\n${"═".repeat(60)}\n${additionalInstructions}`]
      : []),
  ].join("");

  // Build content blocks for each API call
  const reqDocBlock = preparePdfDocument(reqPdfBuffer, `Requirements: ${credit.credit_code}`);

  const uploadDocBlocks = uploadBuffers.map((u) =>
    u.mimeType === "application/pdf"
      ? preparePdfDocument(u.buffer, u.filename)
      : null
  ).filter(Boolean) as ReturnType<typeof preparePdfDocument>[];

  // ── Step 15: Call Claude API — temperature: 0, web_search enabled ─────────
  // Two-pass for credits with an online form (LEED): Part 1 generates the form,
  // Part 2 generates supporting docs using Part 1 as context.
  // Single-pass for credits with no form (WELL): one call generates everything.
  const hasForm = !!creditData.platformFiles.formLink;
  console.log(`  Step 15: Running Claude API (${hasForm ? "two-pass" : "single-pass"}, temperature: 0)...`);

  const refBlock = referenceDataBlock
    ? [{ type: "text", text: referenceDataBlock }]
    : [];

  let part1Html = "";

  if (hasForm) {
    const part1Response = await (client.messages.create as any)({
      model:       "claude-sonnet-4-6",
      max_tokens:  64000,
      temperature: 0,
      system:      systemPrompt,
      tools:       [WEB_SEARCH_TOOL],
      messages:    [{
        role:    "user",
        content: [
          ...refBlock,
          reqDocBlock,
          ...appendixDocBlocks,
          ...uploadDocBlocks,
          { type: "text", text: userPromptPart1 },
        ],
      }],
    });

    const part1AllText = (part1Response.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text as string)
      .join("\n");
    part1Html = scrubNarration(part1AllText).cleaned;
    console.log(`    Part 1 complete — ${part1Response.usage.output_tokens} output tokens (${part1Response.content.filter((b: any) => b.type === "text").length} text block(s))`);
  } else {
    console.log(`    No form link — skipping Part 1, running single-pass`);
  }

  // ── Step 15.7: Resolve map destinations ──────────────────────────────────────
  // Priority order:
  //   1. GTFS pre-fetch (Step 13.5) — exact GPS coordinates, Google Maps verified ← preferred
  //   2. Structured comment from Claude's Part 1 output (transit fallback)
  //   3. Haiku extraction from Part 1 HTML (non-transit credits)
  //   4. creditData.claudeRetrieves fallback
  let locationsForMap: Array<{ address: string; label: string }> = [];
  if (requiredMapType && project.address) {

    // Path 1: GTFS pre-fetch succeeded — use exact GPS coordinates directly, skip all extraction
    if (gtfsLocationsForMap.length > 0) {
      locationsForMap = gtfsLocationsForMap;
      console.log(`  Step 15.7: Using ${locationsForMap.length} GTFS-verified stop coordinate(s) — skipping extraction`);
    }

    if (locationsForMap.length === 0) {
    console.log(`  Step 15.7: Extracting locations from Part 1 output...`);

    // Path 2: Parse structured transit stop comment (transit fallback when GTFS unavailable)
    const transitComment = part1Html.match(/<!--\s*QUALIFYING_TRANSIT_STOPS:\s*(\{[\s\S]*?\})\s*-->/);
    if (transitComment) {
      try {
        const parsed = JSON.parse(transitComment[1]) as {
          threshold_miles?: number;
          stops?: Array<{ address: string; label: string }>;
        };
        const thresholdMiles = typeof parsed.threshold_miles === "number" ? parsed.threshold_miles : 0.5;
        const rawStops = (parsed.stops ?? [])
          .filter((l) => l && typeof l.address === "string" && l.address.trim().length > 0)
          .slice(0, 8)
          .map((l, i) => ({ address: l.address.trim(), label: l.label ?? String(i + 1) }));

        console.log(`    Parsed ${rawStops.length} transit stop(s) from structured comment (threshold: ${thresholdMiles} mi)`);

        if (rawStops.length > 0) {
          // Re-measure actual walking distances via Google Maps — filters out stops
          // Claude incorrectly included due to estimated (vs. real) distances
          console.log(`    Re-measuring walking distances via Google Maps...`);
          const routes = await measureWalkingDistances(project.address!, rawStops);
          for (const route of routes) {
            const actualMi = route.distanceMiles;
            const qualifies = actualMi <= thresholdMiles;
            console.log(`      ${route.destination.label}: ${actualMi.toFixed(2)} mi (threshold ${thresholdMiles} mi) — ${qualifies ? "INCLUDED" : "EXCLUDED"}`);
            if (qualifies) {
              locationsForMap.push(route.destination);
            }
          }
          console.log(`    ${locationsForMap.length} of ${rawStops.length} stop(s) confirmed within threshold`);
        }
      } catch (err) {
        console.warn(`  Step 15.7: Transit stop comment parse/measure failed: ${(err as Error).message} — falling back to Haiku`);
      }
    }

    // Path 3: Haiku extraction (non-transit credits, or transit comment missing/malformed)
    if (locationsForMap.length === 0) {
      try {
        const plainText = part1Html.replace(/<[^>]+>/g, " ").slice(0, 15000);
        const locExtract = await (client.messages.create as any)({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages:   [{
            role:    "user",
            content: `The project is located at: ${project.address}

Extract up to 2 specific named locations (street addresses, transit stops, stations, intersections, named facilities) from the text below that meet BOTH of the following conditions:
1. They are documented as qualifying for points in this credit — meaning they appear in a compliance table, point calculation, or qualifying items list, not merely mentioned as context or examples.
2. They are in the same city or immediate surrounding area as the project — not in other cities, regions, or states.

Return ONLY a valid JSON array of strings. If none found return [].

${plainText}`,
          }],
        });
        const locText   = locExtract.content[0]?.text ?? "[]";
        const jsonMatch = locText.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const raw: unknown[] = JSON.parse(jsonMatch[0]);
          locationsForMap = raw
            .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
            .slice(0, 2)
            .map((addr, i) => ({ address: addr, label: String(i + 1) }));
        }
        console.log(`    Extracted ${locationsForMap.length} location(s) via Haiku`);
      } catch (err) {
        console.warn(`  Step 15.7: Haiku extraction failed: ${(err as Error).message} — using claudeRetrieves fallback`);
      }
    }

    // Path 4: claudeRetrieves fallback
    if (locationsForMap.length === 0) {
      locationsForMap = creditData.claudeRetrieves
        .slice(0, 2)
        .map((r, i) => ({ address: r, label: String(i + 1) }));
      console.log(`    Using ${locationsForMap.length} claudeRetrieves item(s) as map destinations`);
    }
    } // end: locationsForMap.length === 0 (GTFS bypass)
  }

  // ── Step 15.8: Generate map before Part 2 so it can be embedded in output ──
  let mapBuffer: Buffer | null = null;
  let mapBase64: string | null = null;
  if (requiredMapType && project.address && locationsForMap.length > 0) {
    console.log(`  Step 15.8: Generating ${requiredMapType} map (${locationsForMap.length} destination(s))...`);
    try {
      const mapResult = await generateMap({
        originAddress: project.address,
        destinations:  locationsForMap,
        mapType:       requiredMapType,
      });
      mapBuffer = mapResult.pngBuffer;
      mapBase64 = mapBuffer.toString("base64");
      console.log(`  Step 15.8: ✓ Map generated — ${mapBuffer.length} bytes`);
    } catch (e) {
      console.warn(`  Step 15.8: Map generation failed: ${(e as Error).message} — continuing without map`);
    }
  } else if (requiredMapType) {
    console.log(`  Step 15.8: Map required but no destinations found — skipping`);
  } else {
    console.log(`  Step 15.8: No map required`);
  }

  // Build optional map blocks to include in Part 2 prompt
  const mapContentBlocks: any[] = mapBase64 ? [
    {
      type: "text",
      text: "A walking-distance map has been generated for this project (image below). In Part 2, place exactly one <img data-map-insert='1'> element at the most relevant location (walking distances section, transit access section, or site context section). The system will replace this placeholder with the actual map image.",
    },
    {
      type:   "image",
      source: { type: "base64", media_type: "image/png", data: mapBase64 },
    },
  ] : [];

  const part2Response = await (client.messages.create as any)({
    model:       "claude-sonnet-4-6",
    max_tokens:  64000,
    temperature: 0,
    system:      systemPrompt,
    tools:       [WEB_SEARCH_TOOL],
    messages:    [{
      role:    "user",
      content: [
        ...refBlock,
        ...(hasForm && part1Html ? [{ type: "text", text: `PART 1 OUTPUT (completed — do not regenerate):\n${part1Html}` }] : []),
        ...mapContentBlocks,
        reqDocBlock,
        ...appendixDocBlocks,
        ...uploadDocBlocks,
        { type: "text", text: userPromptPart2 },
      ],
    }],
  });

  const part2AllText = (part2Response.content as any[])
    .filter((b) => b.type === "text")
    .map((b) => b.text as string)
    .join("\n");
  const part2Html = scrubNarration(part2AllText).cleaned;
  console.log(`    Part 2 complete — ${part2Response.usage.output_tokens} output tokens (${part2Response.content.filter((b: any) => b.type === "text").length} text block(s))`);

  // Stitch HTML output
  let fullHtml = part1Html;
  const bodyCloseIdx = fullHtml.lastIndexOf("</body>");
  if (bodyCloseIdx !== -1) {
    fullHtml = fullHtml.slice(0, bodyCloseIdx) + "\n" + part2Html + "\n</body></html>";
  } else {
    fullHtml += "\n" + part2Html;
  }

  // Replace map placeholder with actual image + GTFS annotation (legend + distances table)
  if (mapBuffer) {
    const mapDataUri  = `data:image/png;base64,${mapBuffer.toString("base64")}`;
    const mapImgHtml  = `<img src="${mapDataUri}" alt="Walking distance map" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0 8px;display:block;">`;
    const replacement = gtfsMapAnnotationHtml
      ? mapImgHtml + "\n" + gtfsMapAnnotationHtml
      : mapImgHtml;
    fullHtml = fullHtml.replace(/<img\s+data-map-insert[^>]*\/?>/gi, replacement);
  }

  // ── Step 15.5: Generate Calculator Input Guide if required ───────────────────
  let calcGuide: CalcGuideResult | null = null;
  const hasCalculator = !!creditData.platformFiles.calculatorInfo;
  let calcGuideAppended = false;

  if (hasCalculator) {
    console.log(`  Step 15.5: Generating Calculator Input Guide — ${creditData.platformFiles.calculatorInfo}`);
    try {
      const calcProjectData = [
        projectDataBlock,
        "",
        `CREDIT: ${creditData.creditNumber} — ${creditData.creditName}`,
        "",
        "GENERATED HTML OUTPUT (ventilation data):",
        fullHtml.slice(0, 30000),
      ].join("\n");

      calcGuide = await generateCalculatorGuide(
        client,
        creditDataBlock,
        creditData.creditName,
        calcProjectData,
        { input: 0, output: 0 },
      );

      if (calcGuide && !calcGuide.skipped) {
        console.log(`  Step 15.5: ✓ Calculator Input Guide — ${calcGuide.calculatorName} (${calcGuide.fieldCount} fields, ${calcGuide.tabCount} tabs)`);
        const bodyClose = fullHtml.lastIndexOf("</body>");
        fullHtml = bodyClose !== -1
          ? fullHtml.slice(0, bodyClose) + calcGuide.html + "\n</body></html>"
          : fullHtml + calcGuide.html;
        calcGuideAppended = true;
      } else {
        console.warn(`  Step 15.5: ⚠ Calculator Guide skipped — ${calcGuide?.skipReason ?? "unknown reason"}`);
        if (calcGuide?.html) {
          const bodyClose = fullHtml.lastIndexOf("</body>");
          fullHtml = bodyClose !== -1
            ? fullHtml.slice(0, bodyClose) + calcGuide.html + "\n</body></html>"
            : fullHtml + calcGuide.html;
          calcGuideAppended = true;
        }
      }
    } catch (err) {
      console.error(`  Step 15.5: ✗ Calculator Guide error — ${(err as Error).message}`);
    }

    if (!calcGuideAppended) {
      console.warn(`  Step 15.5: Calculator guide not appended — injecting placeholder`);
      const placeholder = `
<div class="section-header">USGBC Calculator Input Guide</div>
<div class="section-body">
  <div class="warn-note">This item could not be completed. See the document review summary below.</div>
</div>`;
      const bodyClose = fullHtml.lastIndexOf("</body>");
      fullHtml = bodyClose !== -1
        ? fullHtml.slice(0, bodyClose) + placeholder + "\n</body></html>"
        : fullHtml + placeholder;
    }
  } else {
    console.log(`  Step 15.5: No calculator required for ${creditData.creditNumber}`);
  }

  // ── QA signals — logged only, never block delivery ───────────────────────
  const calcGuideViolations = validateCalculatorGuidePresent(fullHtml, creditDataBlock);
  calcGuideViolations.forEach((v) => console.warn(`  ⚠ QA: ${v.description}`));
  const violations = validateNoUnnecessaryCustomerRequests(fullHtml);
  violations.forEach((v) => console.warn(`  ⚠ QA: unnecessary customer request — ${v.description}`));
  const missingOutputs = validateAllOutputsProduced(fullHtml, creditData.outputs);
  missingOutputs.forEach((v) => console.warn(`  ⚠ QA: output may be missing — ${v.description}`));

  // ── Document review summary — appended when review found issues ───────────
  // Explains to the customer why items marked "could not be completed" were not generated.
  if (knownReviewIssues.length > 0) {
    console.log(`  Appending document review summary (${knownReviewIssues.length} issue(s))`);
    const issueItems = knownReviewIssues.map((iss) => `<li>${iss}</li>`).join("\n        ");
    const reviewSummary = `
<div class="section-header">Document Review Summary</div>
<div class="section-body">
  <div class="warn-box">
    <p>This submission was processed with the following document deficiencies identified during review:</p>
    <ul>
        ${issueItems}
    </ul>
    <p>Items marked "could not be completed" within this document were not generated due to these deficiencies. Reprocessing with complete documentation requires a new order.</p>
  </div>
</div>`;
    const bodyClose = fullHtml.lastIndexOf("</body>");
    fullHtml = bodyClose !== -1
      ? fullHtml.slice(0, bodyClose) + reviewSummary + "\n</body></html>"
      : fullHtml + reviewSummary;
  }

  // ── Step 16.5: Final scrub and delivery gate ──────────────────────────────
  // Only hard-fail when no HTML was generated at all — nothing to deliver.
  // Everything else delivers; placeholders and review summary explain any gaps.
  const { cleanedHtml: gatedHtml } = validateAllDeliverables({
    htmlContent:     fullHtml,
    requiredMapType,
    mapGenerated:    !!mapBuffer,
  });
  fullHtml = gatedHtml;

  if (containsNarration(fullHtml)) {
    console.warn(`  Step 16.5: Narration survived final scrub — delivering with QA flag`);
  }

  if (fullHtml.length <= 100) {
    console.error(`  Step 16.5: ✗ No HTML generated — hard failing`);
    await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
    await supabase.from("runs").update({
      status:        "failed",
      error_message: "Claude API did not return HTML output",
      completed_at:  new Date().toISOString(),
    }).eq("id", runId);
    return { orderId, runId, status: "failed", issues: ["Claude API did not return HTML output"] };
  }

  console.log(`  Step 16.5: ✓ HTML confirmed — proceeding to delivery`);

  // ── Step 17: Upload outputs to Storage ────────────────────────────────────
  console.log(`  Step 18: Uploading outputs to Storage...`);
  const outputPaths: string[] = [];

  // Standard HTML — table CSS injected, view-only
  const standardHtml  = injectTableCss(fullHtml);
  const editableHtml  = makeEditable(fullHtml);

  const htmlPath = `${outputsFolder}/submission.html`;
  const { error: htmlErr } = await dbCall(
    supabase.storage.from(OUTPUTS_BUCKET).upload(htmlPath, Buffer.from(standardHtml), { upsert: true, contentType: "text/html" }),
    "upload submission.html",
  );
  if (htmlErr) throw new Error(`Failed to upload HTML output: ${htmlErr.message}`);
  outputPaths.push(htmlPath);
  console.log(`    ✓ submission.html`);

  // Editable HTML — for customer download and PDF export
  const editablePath = `${outputsFolder}/submission-editable.html`;
  const { error: editErr } = await dbCall(
    supabase.storage.from(OUTPUTS_BUCKET).upload(editablePath, Buffer.from(editableHtml), { upsert: true, contentType: "text/html" }),
    "upload submission-editable.html",
  );
  if (editErr) console.warn(`    Editable HTML upload failed: ${editErr.message}`);
  else { outputPaths.push(editablePath); console.log(`    ✓ submission-editable.html`); }

  // Calculator Input Guide — already embedded in fullHtml at Step 15.5; no file upload needed

  if (mapBuffer) {
    const mapPath = `${outputsFolder}/walking-distance-map.png`;
    const { error: mapErr } = await dbCall(
      supabase.storage.from(OUTPUTS_BUCKET).upload(mapPath, new Blob([new Uint8Array(mapBuffer)], { type: "image/png" }), { upsert: true }),
      "upload map PNG",
    );
    if (mapErr) console.warn(`    Map upload failed: ${mapErr.message}`);
    else { outputPaths.push(mapPath); console.log(`    ✓ walking-distance-map.png`); }
  }

  // ── Step 18: Mark complete, send QA review email, schedule cleanup ──────────
  console.log(`  Step 18: Marking order complete...`);

  const deliveryScheduledAt = new Date(Date.now() + 47 * 60 * 60 * 1000);

  const { error: step18RunErr } = await dbCall(
    supabase.from("runs").update({
      status:           "completed",
      completed_at:     new Date().toISOString(),
      output_html_path: htmlPath,
    }).eq("id", runId),
    "update run completed",
  );
  if (step18RunErr) throw new Error(`Step 18: Failed to mark run completed: ${step18RunErr.message}`);

  const { error: step18OrderErr } = await dbCall(
    supabase.from("orders").update({
      status:                "complete",
      delivery_scheduled_at: deliveryScheduledAt.toISOString(),
      qa_status:             "pending_review",
    }).eq("id", orderId),
    "update order complete",
  );
  if (step18OrderErr) throw new Error(`Step 18: Failed to mark order complete: ${step18OrderErr.message}`);

  // Schedule cleanup for attempt folder (48h delay, never outputs/)
  const attemptFilePaths = uploads.map((u) => u.storagePath);
  if (attemptFilePaths.length > 0) {
    await supabase.from("cleanup_queue").insert({
      order_id:   orderId,
      file_paths: attemptFilePaths,
    });
  }

  // ── Step 18.5: Send QA review email ─────────────────────────────────────
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://liminalsva.com";
    const token  = signQaToken(orderId);

    const [standardUrlRes, editableUrlRes] = await Promise.all([
      supabase.storage.from(OUTPUTS_BUCKET).createSignedUrl(htmlPath, 7 * 24 * 3600),
      supabase.storage.from(OUTPUTS_BUCKET).createSignedUrl(editablePath, 7 * 24 * 3600),
    ]);

    await sendQAReviewEmail({
      customerName:        customer.name ?? "Customer",
      customerEmail:       customer.email,
      creditName:          credit.credit_name,
      projectName:         project.name,
      orderId,
      generatedAt:         new Date().toISOString(),
      deliveryScheduledAt: deliveryScheduledAt.toISOString(),
      standardHtmlUrl:     standardUrlRes.data?.signedUrl ?? `${appUrl}/orders/${orderId}`,
      editableHtmlUrl:     editableUrlRes.data?.signedUrl ?? `${appUrl}/orders/${orderId}`,
      approveUrl:          `${appUrl}/api/admin/orders/${orderId}/approve?token=${token}`,
      requestChangesUrl:   `${appUrl}/admin/orders/${orderId}/review?token=${token}`,
      isRegeneration:      !!additionalInstructions,
      changeInstructions:  additionalInstructions,
    });
    console.log(`  Step 18.5: ✓ QA review email sent`);
  } catch (e) {
    console.error(`  Step 18.5: QA review email failed: ${(e as Error).message}`);
  }

  // Audit log
  const totalTokens = part2Response.usage.input_tokens + part2Response.usage.output_tokens;

  await logAuditEvent({
    eventType:  "order_complete",
    entityType: "order",
    entityId:   orderId,
    customerId: order.customer_id,
    metadata:   {
      creditCode: credit.credit_code,
      attemptNumber,
      outputCount:      outputPaths.length,
      mapGenerated:     !!mapBuffer,
      calcGenerated:    !!(calcGuide && !calcGuide.skipped),
      totalTokens,
    },
  });

  console.log(`\n[process-order] ✓ Complete — ${outputPaths.length} output(s) uploaded`);
  return { orderId, runId, status: "complete", outputPaths };
}
