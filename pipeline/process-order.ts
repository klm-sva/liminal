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
import { analyzeDrawings } from "./drawing-analysis";
import { generateMap, type MapType } from "./map-generation";
import { logAuditEvent } from "./lib/supabase-ops";
import { preparePdfDocument } from "./lib/pdf-to-images";
import { injectTableCss, makeEditable } from "./lib/make-editable";
import { generatePolicyDrafts, policyChecklistHtml, type UploadedPolicy } from "./lib/policy-generator";
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
  creditCode:       string;
  outputs:          string[];       // Column J from automation analysis
  hasCalculator:    boolean;        // whether calculator column is non-empty
  htmlGenerated:    boolean;
  htmlContent:      string;         // actual HTML — scanned for residual narration
  calcGuide:        CalcGuideResult | null;
  mapGenerated:     boolean;
  requiredMapType:  string | null;
  policyDraftCount: number;
}): { checks: DeliverableCheck[]; cleanedHtml: string } {
  const checks: DeliverableCheck[] = [];
  const outputsText = params.outputs.join(" ").toLowerCase();

  // HTML form output — always required
  checks.push({
    item: "Online Submittal Form HTML",
    present: params.htmlGenerated,
    reason: params.htmlGenerated ? undefined : "Claude API did not return HTML output",
  });

  // Narration scan — scrub again and flag if any survived the earlier passes
  let cleanedHtml = params.htmlContent;
  if (params.htmlGenerated && containsNarration(cleanedHtml)) {
    console.warn(`  [validateAllDeliverables] Narration detected in HTML — running second scrub`);
    const rerun = scrubNarration(cleanedHtml);
    cleanedHtml = rerun.cleaned;
    if (rerun.total > 0) console.warn(`    Removed ${rerun.total} additional narration instance(s) in deliverable gate`);
    if (containsNarration(cleanedHtml)) {
      checks.push({
        item: "HTML Narration-Free",
        present: false,
        reason: "Process narration survived two scrub passes — file flagged for admin review",
      });
      console.error(`  ✗ Narration still present after second scrub — marking needs_review`);
    } else {
      console.log(`    ✓ Narration cleared by second scrub`);
    }
  }

  // Calculator — required when calculatorInfo column is non-empty
  if (params.hasCalculator) {
    const calcPresent = !!(params.calcGuide && !params.calcGuide.skipped);
    checks.push({
      item: `USGBC Calculator Input Guide (${params.calcGuide?.calculatorName ?? "required"})`,
      present: calcPresent,
      reason: calcPresent ? undefined : (params.calcGuide?.skipReason ?? "Calculator Guide generation failed"),
    });
  }

  // Map — logged as a soft warning only; absence never blocks delivery
  const mapKeywords = ["map", "transit", "bicycle", "density", "walking"];
  const mapRequired = mapKeywords.some((kw) => outputsText.includes(kw)) || !!params.requiredMapType;
  if (mapRequired && !params.mapGenerated) {
    console.warn(`  [validateAllDeliverables] Map required but not generated — flagging for QA, not blocking delivery`);
  }

  // Policy drafts — required when outputs mention policy, plan, or commitment
  const policyRequired = ["policy", "plan", "commitment", "statement"].some((kw) => outputsText.includes(kw));
  if (policyRequired) {
    checks.push({
      item: "Policy/Plan Drafts",
      present: params.policyDraftCount > 0,
      reason: params.policyDraftCount > 0 ? undefined : "No policy drafts generated",
    });
  }

  return { checks, cleanedHtml };
}

// ─── Partial delivery notice ──────────────────────────────────────────────────
// Injected into the HTML output when attempt 2+ has known document issues and
// some secondary deliverables could not be generated because of those gaps.

function buildPartialDeliveryNotice(
  missing:     DeliverableCheck[],
  priorIssues: string[],
): string {
  const issueItems   = priorIssues.map((iss) => `<li>${iss}</li>`).join("\n        ");
  const missingItems = missing.map((m) =>
    `<li><strong>${m.item}</strong>${m.reason ? ` — ${m.reason}` : ""}</li>`
  ).join("\n        ");

  return `
<div style="margin:32px 0;padding:20px 24px;background:#fff8f0;border-left:4px solid #e07000;border-radius:8px;font-family:sans-serif;">
  <h3 style="margin:0 0 12px;font-size:16px;color:#7a3c00;">Partial Delivery — Incomplete Submission</h3>
  <p style="margin:0 0 12px;font-size:14px;color:#555;">
    The deliverables above represent the maximum that could be completed with the documentation provided.
    The following items could not be generated due to the document issues identified during review:
  </p>
  <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#555;">
        ${missingItems}
  </ul>
  <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#555;">Document issues identified during review:</p>
  <ul style="margin:0 0 12px;padding-left:20px;font-size:13px;color:#555;">
        ${issueItems}
  </ul>
  <p style="margin:0;font-size:13px;color:#888;font-style:italic;">
    To complete the remaining deliverables, please resubmit with the documentation listed above.
  </p>
</div>`;
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
  console.log(`  Step 2a: calling extractCreditData for "${credit.credit_code}"...`);
  const creditData = extractCreditData(credit.credit_code);
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
  // Skip review entirely when customer submitted with no files — they chose to proceed without uploads.
  let reviewResult: Awaited<ReturnType<typeof reviewDocuments>> | null = null;
  if (uploads.length > 0) {
    console.log(`  Step 6: Running document review...`);
    reviewResult = await reviewDocuments(
      orderId,
      order.customer_id,
      credit.credit_code,
      uploads
    );
  } else {
    console.log(`  Step 6: No uploads — skipping document review, proceeding directly.`);
  }

  // ── Step 7: If incomplete on attempt 1 → documents_requested (notify, stop)
  //            If incomplete on attempt 2+ → continue anyway (best-effort run)
  if (reviewResult && reviewResult.status === "incomplete") {
    const issueStrings = reviewResult.issues.map((i) => i.issue);

    if (attemptNumber === 1) {
      console.log(`  Step 7: Review incomplete (attempt 1) — ${issueStrings.length} issue(s). Notifying customer.`);

      await supabase.from("runs").update({
        status:        "failed",
        review_issues: issueStrings,
        completed_at:  new Date().toISOString(),
        error_message: "Document review incomplete",
      }).eq("id", runId);

      await supabase.from("orders").update({ status: "documents_requested" }).eq("id", orderId);

      await logAuditEvent({
        eventType:  "documents_requested",
        entityType: "order",
        entityId:   orderId,
        customerId: order.customer_id,
        metadata:   { attemptNumber, issueCount: issueStrings.length, issues: issueStrings },
      });

      return { orderId, runId, status: "documents_requested", issues: issueStrings };
    }

    // Attempt 2+: customer was already told what was missing — run pipeline with
    // whatever was provided and surface remaining gaps in the output document.
    console.log(`  Step 7: Review incomplete (attempt ${attemptNumber}) — proceeding with best-effort run. Issues: ${issueStrings.join("; ")}`);

    knownReviewIssues = issueStrings;

    await supabase.from("runs").update({
      review_issues: issueStrings,
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

  // ── Step 14: Build prompt ─────────────────────────────────────────────────
  console.log(`  Step 14: Building prompt...`);
  const creditDataBlock = formatCreditDataForPrompt(creditData);

  // Owner-entered registration fields — authoritative, override drawing estimates
  const registrationLines: string[] = [];
  if (project.regular_occupants != null) registrationLines.push(`  regular_occupants: ${project.regular_occupants}`);
  if (project.peak_visitors     != null) registrationLines.push(`  peak_visitors: ${project.peak_visitors}`);

  const projectDataBlock = [
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
    ...(compliancePathBlock ? ["", compliancePathBlock] : []),
    "",
    "Generate PART 1 — THE ONLINE FORM SECTION for this credit as instructed.",
  ].join("\n");

  const userPromptPart2 = [
    creditDataBlock,
    "",
    projectDataBlock,
    ...(compliancePathBlock ? ["", compliancePathBlock] : []),
    "",
    "Generate PART 2 — SUPPORTING PROJECT DOCUMENTATION (Section A: Retrieved Data, Section B: Generated Outputs) AND PART 3 — COMPLETE SUBMISSION CHECKLIST for this credit as instructed. Both are required. Do not omit either.",
  ].join("\n");

  // Dynamic system prompt — append QA instructions when regenerating after review
  const systemPrompt = additionalInstructions
    ? `${CREDIT_SUBMISSION_PROMPT}\n\n${"═".repeat(60)}\nQA REVIEW INSTRUCTIONS — INCORPORATE THESE CHANGES:\n${"═".repeat(60)}\n${additionalInstructions}`
    : CREDIT_SUBMISSION_PROMPT;

  // Build content blocks for each API call
  const reqDocBlock = preparePdfDocument(reqPdfBuffer, `Requirements: ${credit.credit_code}`);

  const uploadDocBlocks = uploadBuffers.map((u) =>
    u.mimeType === "application/pdf"
      ? preparePdfDocument(u.buffer, u.filename)
      : null
  ).filter(Boolean) as ReturnType<typeof preparePdfDocument>[];

  // ── Step 15: Call Claude API (two-pass) — temperature: 0, web_search enabled ─
  console.log(`  Step 15: Running Claude API (two-pass, temperature: 0)...`);

  const refBlock = referenceDataBlock
    ? [{ type: "text", text: referenceDataBlock }]
    : [];

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
  const part1Html = scrubNarration(part1AllText).cleaned;
  console.log(`    Part 1 complete — ${part1Response.usage.output_tokens} output tokens (${part1Response.content.filter((b: any) => b.type === "text").length} text block(s))`);

  // ── Step 15.7: Extract locations from Part 1 output for map generation ──────
  // Uses Claude Haiku (fast/cheap) to pull named locations from the HTML text.
  // Locations are filtered to the project city (string match, no geocoding).
  // Falls back to creditData.claudeRetrieves if extraction fails or returns empty.
  let locationsForMap: Array<{ address: string; label: string }> = [];
  if (requiredMapType && project.address) {
    console.log(`  Step 15.7: Extracting locations from Part 1 output...`);
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
      console.log(`    Extracted ${locationsForMap.length} location(s) from Part 1`);
    } catch (err) {
      console.warn(`  Step 15.7: Location extraction failed: ${(err as Error).message} — using claudeRetrieves fallback`);
    }

    // Fallback: use claudeRetrieves from XLSX, capped at 2
    if (locationsForMap.length === 0) {
      locationsForMap = creditData.claudeRetrieves
        .slice(0, 2)
        .map((r, i) => ({ address: r, label: String(i + 1) }));
      console.log(`    Using ${locationsForMap.length} claudeRetrieves item(s) as map destinations`);
    }
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
        { type: "text", text: `PART 1 OUTPUT (completed — do not regenerate):\n${part1Html}` },
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

  // Replace map placeholder injected by Part 2 with actual base64 data URI
  if (mapBuffer) {
    const mapDataUri = `data:image/png;base64,${mapBuffer.toString("base64")}`;
    fullHtml = fullHtml.replace(
      /<img\s+data-map-insert[^>]*\/?>/gi,
      `<img src="${mapDataUri}" alt="Walking distance map" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;display:block;">`,
    );
  }

  // ── Step 15.5: Generate Calculator Input Guide if required ───────────────────
  // Replaces all Excel population attempts. HTML guide is appended to fullHtml.
  let calcGuide: CalcGuideResult | null = null;
  const hasCalculator = !!creditData.platformFiles.calculatorInfo;

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
        // Append guide HTML inline — no Excel file produced or uploaded
        const bodyClose = fullHtml.lastIndexOf("</body>");
        fullHtml = bodyClose !== -1
          ? fullHtml.slice(0, bodyClose) + calcGuide.html + "\n</body></html>"
          : fullHtml + calcGuide.html;
      } else {
        console.warn(`  Step 15.5: ⚠ Calculator Guide skipped — ${calcGuide?.skipReason ?? "unknown reason"}`);
        if (calcGuide?.html) {
          const bodyClose = fullHtml.lastIndexOf("</body>");
          fullHtml = bodyClose !== -1
            ? fullHtml.slice(0, bodyClose) + calcGuide.html + "\n</body></html>"
            : fullHtml + calcGuide.html;
        }
      }
    } catch (err) {
      console.error(`  Step 15.5: ✗ Calculator Guide error — ${(err as Error).message}`);
    }
  } else {
    console.log(`  Step 15.5: No calculator required for ${creditData.creditNumber}`);
  }

  // ── FIX 1 — validateNoUnnecessaryCustomerRequests() ──────────────────────
  // Block delivery if output asks customer for auto-retrievable data.
  // One correction pass is attempted automatically.
  const calcGuideViolations = validateCalculatorGuidePresent(fullHtml, creditDataBlock);
  if (calcGuideViolations.length > 0) {
    calcGuideViolations.forEach((v) => console.warn(`  ⚠ ${v.description}`));
  }

  const violations = validateNoUnnecessaryCustomerRequests(fullHtml);
  if (violations.length > 0) {
    console.warn(`  ⚠ FIX 1: ${violations.length} validation violation(s) detected — running correction pass`);
    violations.forEach((v) => console.warn(`    • ${v.description}`));

    const correctionResponse = await (client.messages.create as any)({
      model:       "claude-sonnet-4-6",
      max_tokens:  64000,
      temperature: 0,
      system:      systemPrompt,
      tools:       [WEB_SEARCH_TOOL],
      messages:    [{
        role:    "user",
        content: [
          {
            type: "text",
            text: [
              `The HTML document below has ${violations.length} violation(s) where the customer is asked to provide data that can be found via web search.`,
              `Fix ONLY these violations. Use web search to retrieve the correct values and replace each request with the found data.`,
              `Return the complete corrected HTML document.`,
              ``,
              `VIOLATIONS:`,
              violations.map((v, i) => `${i + 1}. ${v.description}\n   Found: "${v.context}"`).join("\n\n"),
              ``,
              `HTML TO CORRECT:`,
              fullHtml,
            ].join("\n"),
          },
        ],
      }],
    });

    const correctedRaw = (correctionResponse.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text as string)
      .join("\n");
    const correctedCleaned = scrubNarration(correctedRaw).cleaned;
    if (correctedCleaned.length >= fullHtml.length * 0.5) {
      fullHtml = correctedCleaned;
    } else {
      console.warn(`    ⚠ FIX 1 correction response too short (${correctedCleaned.length} chars vs ${fullHtml.length} original) — keeping original`);
    }

    const remainingViolations = validateNoUnnecessaryCustomerRequests(fullHtml);
    if (remainingViolations.length === 0) {
      console.log(`    ✓ Correction successful — all violations resolved`);
    } else {
      console.warn(`    ⚠ ${remainingViolations.length} violation(s) remain after correction — delivering with warnings`);
    }
  } else {
    console.log(`  ✓ FIX 1 validation passed — no unnecessary customer requests`);
  }

  // ── FIX 2 — validateAllOutputsProduced() ─────────────────────────────────
  // Block delivery if any Column 4 required output is absent from the document.
  // One correction pass is attempted automatically.
  const missingOutputs = validateAllOutputsProduced(fullHtml, creditData.outputs);
  if (missingOutputs.length > 0) {
    console.warn(`  ⚠ FIX 2: ${missingOutputs.length} Column 4 output(s) missing — running correction pass`);
    missingOutputs.forEach((v) => console.warn(`    • ${v.description}\n      ${v.context}`));

    const missingCorrectionResponse = await (client.messages.create as any)({
      model:       "claude-sonnet-4-6",
      max_tokens:  64000,
      temperature: 0,
      system:      systemPrompt,
      tools:       [WEB_SEARCH_TOOL],
      messages:    [{
        role:    "user",
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
              fullHtml,
            ].join("\n"),
          },
        ],
      }],
    });

    const missingCorrectedRaw = (missingCorrectionResponse.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text as string)
      .join("\n");
    const missingCorrectedCleaned = scrubNarration(missingCorrectedRaw).cleaned;
    if (missingCorrectedCleaned.length >= fullHtml.length * 0.5) {
      fullHtml = missingCorrectedCleaned;
    } else {
      console.warn(`    ⚠ FIX 2 correction response too short (${missingCorrectedCleaned.length} chars vs ${fullHtml.length} original) — keeping original`);
    }

    const remainingMissing = validateAllOutputsProduced(fullHtml, creditData.outputs);
    if (remainingMissing.length === 0) {
      console.log(`    ✓ Correction successful — all Column 4 outputs now present`);
    } else {
      console.warn(`    ⚠ ${remainingMissing.length} output(s) still missing after correction — delivering with warnings`);
      remainingMissing.forEach((v) => console.warn(`      • ${v.description}`));
    }
  } else {
    console.log(`  ✓ FIX 2 validation passed — all Column 4 outputs present`);
  }

  // ── Policy drafts ─────────────────────────────────────────────────────────
  // Only runs when Claude placed <!-- POLICY_REQUIRED --> in the output.
  // This marker is set when a policy is a required deliverable for the chosen
  // compliance path — not merely mentioned as one option among several.
  const policyRequired = fullHtml.includes("<!-- POLICY_REQUIRED -->");
  console.log(`  [policy] POLICY_REQUIRED marker: ${policyRequired ? "FOUND — generating drafts" : "absent — skipping policy generation"}`);

  const policyTokens = { input: 0, output: 0 };
  const uploadedPolicies: UploadedPolicy[] = [];
  let policyDrafts: Awaited<ReturnType<typeof generatePolicyDrafts>> = [];

  if (policyRequired) {
    // Extract text from any customer-uploaded PDFs that look like policy documents
    const POLICY_FILE_PATTERNS = /policy|plan|commitment|statement|guide|agreement|addendum|lease|protocol/i;

    for (const u of uploadBuffers) {
      if (u.mimeType === "application/pdf" && POLICY_FILE_PATTERNS.test(u.filename)) {
        try {
          const extract = await extractPdfContentFromBuffer(
            client, u.buffer, u.filename,
            "Extract the full text content of this policy or plan document. Preserve all section headings, policy statements, procedures, and signature blocks.",
          );
          policyTokens.input  += extract.inputTokens;
          policyTokens.output += extract.outputTokens;
          uploadedPolicies.push({ filename: u.filename, text: extract.text });
        } catch (err) {
          console.warn(`    [policy] Could not extract text from ${u.filename}: ${(err as Error).message}`);
        }
      }
    }

    const reqPdfExtract = await extractPdfContentFromBuffer(
      client, reqPdfBuffer, credit.requirements_pdf_path,
      "Extract all credit requirements, required uploads, and documentation requirements.",
    );
    policyTokens.input  += reqPdfExtract.inputTokens;
    policyTokens.output += reqPdfExtract.outputTokens;

    const tempOutputDir = `/tmp/liminal-policy-${orderId}`;
    policyDrafts = await generatePolicyDrafts(client, creditData.customerUploads.join("\n"), {
      creditName:             credit.credit_code,
      certProgram:            credit.credit_code.startsWith("W") ? "WELL v2" : "LEED v4.1",
      projectAddress:         project.address ?? "",
      creditRequirementsText: reqPdfExtract.text,
      creditSlug:             credit.credit_code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      outputDir:              tempOutputDir,
      uploadedDocuments:      uploadedPolicies,
    }, policyTokens);
  }

  // Append policy checklist to HTML output and upload each draft to storage
  if (policyDrafts.length > 0) {
    const policySection = policyChecklistHtml(policyDrafts);
    const bodyClose = fullHtml.lastIndexOf("</body>");
    fullHtml = bodyClose !== -1
      ? fullHtml.slice(0, bodyClose) + policySection + "\n</body></html>"
      : fullHtml + policySection;
  }

  // Step 16: Map already generated at Step 15.8 — no action needed here.

  // ── Step 16.5: Validate all deliverables before delivery ─────────────────
  // Hard gate — nothing is delivered if required outputs are missing.
  // Narration scan runs here as a second gate; narration is re-scrubbed or flagged.
  fullHtml = scrubNarration(fullHtml).cleaned; // final pre-gate scrub
  const { checks: deliverableChecks, cleanedHtml: gatedHtml } = validateAllDeliverables({
    creditCode:       credit.credit_code,
    outputs:          creditData.outputs,
    hasCalculator,
    htmlGenerated:    fullHtml.length > 100,
    htmlContent:      fullHtml,
    calcGuide,
    mapGenerated:     !!mapBuffer,
    requiredMapType,
    policyDraftCount: policyDrafts.length,
  });
  fullHtml = gatedHtml; // use version that may have been re-scrubbed in gate

  const missing = deliverableChecks.filter((c) => !c.present);
  const found   = deliverableChecks.filter((c) =>  c.present);

  console.log(`  Step 16.5: Deliverables check for ${credit.credit_code}:`);
  found.forEach((c)   => console.log(`    ✓ ${c.item}`));
  missing.forEach((c) => console.warn(`    ✗ MISSING: ${c.item}${c.reason ? " — " + c.reason : ""}`));

  if (missing.length > 0) {
    // HTML itself not generated = true platform failure, always hard-fail regardless of attempt.
    const htmlMissing    = missing.some((c) => c.item === "Online Submittal Form HTML");
    const canDeliverPartial = attemptNumber >= 2 && knownReviewIssues.length > 0 && !htmlMissing;

    if (canDeliverPartial) {
      // Customer was told their documents were insufficient and chose to proceed anyway.
      // Deliver everything that was generated; inject a notice for what couldn't be completed.
      console.warn(`  Step 16.5: ⚠ ${missing.length} deliverable(s) missing — attempt ${attemptNumber}, customer-acknowledged gaps — injecting partial delivery notice`);
      missing.forEach((c) => console.warn(`    ✗ ${c.item}${c.reason ? " — " + c.reason : ""}`));

      const noticeHtml = buildPartialDeliveryNotice(missing, knownReviewIssues);
      const bodyClose  = fullHtml.lastIndexOf("</body>");
      fullHtml = bodyClose !== -1
        ? fullHtml.slice(0, bodyClose) + noticeHtml + "\n</body></html>"
        : fullHtml + noticeHtml;

      await logAuditEvent({
        eventType:  "partial_delivery",
        entityType: "order",
        entityId:   orderId,
        customerId: order.customer_id,
        metadata:   { creditCode: credit.credit_code, missing: missing.map((c) => c.item), priorIssues: knownReviewIssues },
      });
      // Fall through to delivery — no return.
    } else {
      console.warn(`  Step 16.5: ⚠ ${missing.length} missing deliverable(s) — marking order failed`);
      await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
      await supabase.from("runs").update({
        status:        "failed",
        error_message: `Missing deliverables: ${missing.map((c) => c.item).join(", ")}`,
        completed_at:  new Date().toISOString(),
      }).eq("id", runId);
      await logAuditEvent({
        eventType:  "deliverables_incomplete",
        entityType: "order",
        entityId:   orderId,
        customerId: order.customer_id,
        metadata:   { creditCode: credit.credit_code, missing: missing.map((c) => c.item) },
      });
      return { orderId, runId, status: "failed", issues: missing.map((c) => `${c.item}: ${c.reason}`) };
    }
  }

  console.log(`  Step 16.5: ✓ Deliverables check passed — proceeding to delivery`);

  // ── Step 17: Upload outputs to Storage ────────────────────────────────────
  console.log(`  Step 18: Uploading outputs to Storage...`);
  const outputPaths: string[] = [];

  // Standard HTML — table CSS injected, view-only
  const standardHtml  = injectTableCss(fullHtml);
  const editableHtml  = makeEditable(fullHtml);

  const htmlPath = `${outputsFolder}/submission.html`;
  const { error: htmlErr } = await dbCall(
    supabase.storage.from(OUTPUTS_BUCKET).upload(htmlPath, new Blob([standardHtml], { type: "text/html" }), { upsert: true }),
    "upload submission.html",
  );
  if (htmlErr) throw new Error(`Failed to upload HTML output: ${htmlErr.message}`);
  outputPaths.push(htmlPath);
  console.log(`    ✓ submission.html`);

  // Editable HTML — for customer download and PDF export
  const editablePath = `${outputsFolder}/submission-editable.html`;
  const { error: editErr } = await dbCall(
    supabase.storage.from(OUTPUTS_BUCKET).upload(editablePath, new Blob([editableHtml], { type: "text/html" }), { upsert: true }),
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

  // Upload policy draft HTML files
  for (const draft of policyDrafts) {
    try {
      const draftPath = `${outputsFolder}/${draft.filename}`;
      const { error: draftErr } = await dbCall(
        supabase.storage.from(OUTPUTS_BUCKET).upload(draftPath, new Blob([draft.html], { type: "text/html" }), { upsert: true }),
        `upload policy draft ${draft.filename}`,
      );
      if (draftErr) console.warn(`    Policy draft upload failed (${draft.filename}): ${draftErr.message}`);
      else {
        outputPaths.push(draftPath);
        console.log(`    ✓ ${draft.filename}  [policy ${draft.mode}]`);
      }
    } catch (err) {
      console.warn(`    Policy draft upload error (${draft.filename}): ${(err as Error).message}`);
    }
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
  const totalTokens = part1Response.usage.input_tokens + part1Response.usage.output_tokens
    + part2Response.usage.input_tokens + part2Response.usage.output_tokens;

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
