/**
 * pipeline/test-well-v2-v05.ts
 *
 * Live test: V05 — Active Commute Support
 * Program: WELL v2 (Q4 2020 + addenda through Q3–Q4 2024)
 *
 * Project: 600 West Broadway — 600 W Broadway, San Diego, CA 92101
 *
 * Uploads (as a project team would provide):
 *   1. WELL v2 V05 feature requirements PDF
 *
 * Pipeline:
 *   1. Load XLSX feature row
 *   2. Extract feature requirements PDF
 *   3. Pass 1 — Walk Score + Transit Score + pedestrian infrastructure data
 *              (web search: walkscore.com, OpenStreetMap, WELL v2 thresholds)
 *   4. Pass 2 — Supporting narrative + submission checklist
 *   5. Assemble + validate + write output files
 *
 * Run: npx ts-node pipeline/test-well-v2-v05.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { injectTableCss, makeEditable }     from "./lib/make-editable";
import { CREDIT_SUBMISSION_PROMPT }         from "./prompts/credit-submission";
import { validateNoUnnecessaryCustomerRequests } from "./lib/validate-output";
import { StepLogger }                       from "./lib/pipeline-utils";
import { extractPdfContent }                from "./lib/pdf-extract";
import { scrubNarration, writeCleanFile }   from "./lib/output-cleaner";

// ─── Env ──────────────────────────────────────────────────────────────────────

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

// ─── Config ───────────────────────────────────────────────────────────────────

const DESKTOP      = "/Users/kelsey/Desktop/program automation ";
const FEATURE_PDF  = path.join(DESKTOP, "well feature files v2/movement/well v2- optimization V05 site planning and selection.pdf");
const XLSX_PATH    = path.resolve(__dirname, "reference/well-v2/WELL_v2_Automation_Analysis_v4.xlsx");
const OUTPUT_DIR   = path.resolve(__dirname, "output");
const SLUG         = "well-v2-v05-active-commute-support";
const EDITABLE_SLUG = "well-v2-v05-active-commute-support-editable";

const PROJECT_NAME    = "600 West Broadway";
const PROJECT_ADDRESS = "600 W Broadway, San Diego, CA 92101";
const PROJECT_OWNER   = "[Owner to Confirm]";
const PROGRAM_NAME    = "WELL v2 — Movement Concept";
const FEATURE_NAME    = "V05 — Active Commute Support";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractFeatureRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[3] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(4).find((r: any[]) => String(r[0] ?? "").trim() === "V05");
  if (!row) throw new Error("V05 row not found in XLSX");
  const lines = [`Feature Automation Analysis — ${row[0]}: ${row[1]}`];
  for (let i = 2; i < hdrs.length; i++) {
    const v = row[i];
    if (v !== undefined && v !== "") lines.push(`  ${hdrs[i]}: ${String(v).replace(/\n/g, " | ").trim()}`);
  }
  return lines.join("\n");
}

// ─── Streaming call helper ────────────────────────────────────────────────────

async function streamCall(
  client:       Anthropic,
  label:        string,
  systemPrompt: string,
  userContent:  Anthropic.ContentBlockParam[],
  usage:        { input: number; output: number },
  maxTokens     = 32000,
): Promise<string> {
  const t0 = Date.now();
  process.stdout.write(`  ${label}: streaming`);
  let text = "", ticks = 0;

  const stream = client.messages.stream({
    model:       "claude-sonnet-4-6",
    max_tokens:  maxTokens,
    temperature: 0,
    system:      systemPrompt,
    messages:    [{ role: "user", content: userContent }],
    tools:       [WEB_SEARCH_TOOL],
  } as any);

  stream.on("text", (chunk: string) => {
    text += chunk;
    if (++ticks % 200 === 0) process.stdout.write(".");
  });

  let final: Awaited<ReturnType<typeof stream.finalMessage>>;
  try {
    final = await stream.finalMessage();
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    if (e.status === 429) {
      console.warn("\n  ⚠ Rate-limited — waiting 60 s...");
      await new Promise((r) => setTimeout(r, 60000));
      final = await stream.finalMessage();
    } else throw err;
  }

  usage.input  += final.usage.input_tokens;
  usage.output += final.usage.output_tokens;
  console.log(`\n  [${((Date.now() - t0) / 1000).toFixed(1)}s  in:${final.usage.input_tokens.toLocaleString()} out:${final.usage.output_tokens.toLocaleString()}]`);
  return text;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const t0     = Date.now();
  const usage  = { input: 0, output: 0 };
  const step   = new StepLogger();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`\nProject: ${PROJECT_NAME}`);
  console.log(`Address: ${PROJECT_ADDRESS}`);
  console.log(`Feature: ${FEATURE_NAME}\n`);

  // ─── [1/3] Load source documents ─────────────────────────────────────────────
  const k1 = step.start("[1/3] Loading source files — XLSX + feature requirements PDF");

  const featureRow = extractFeatureRow();
  console.log(`  ✓ Automation analysis row loaded`);

  const featurePdfExtract = await extractPdfContent(
    client, FEATURE_PDF,
    `Extract all requirements, parts, options, thresholds, scoring criteria, and IWBI/GBCI accepted verification methods from this WELL v2 feature PDF. Include every sub-part (Part 1, Part 2, etc.), all point values, all compliance thresholds (Walk Score minimums, distance requirements, transit frequency requirements), and the full list of accepted verification document types. Output as structured plain text.`,
  );
  usage.input  += featurePdfExtract.inputTokens;
  usage.output += featurePdfExtract.outputTokens;
  console.log(`  ✓ Feature requirements extracted (${Math.round(featurePdfExtract.text.length / 1024)} KB)`);

  step.complete(k1);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const sharedContext = `FEATURE: ${FEATURE_NAME}
PROGRAM: ${PROGRAM_NAME}
PROJECT NAME: ${PROJECT_NAME}
PROJECT ADDRESS: ${PROJECT_ADDRESS}
PROJECT OWNER: ${PROJECT_OWNER}
SUBMISSION DATE: ${today}

FEATURE REQUIREMENTS (from WELL v2 Feature PDF):
${featurePdfExtract.text}

FEATURE AUTOMATION ANALYSIS:
${featureRow}`;

  // ─── [2/3] Pass 1 — Walk Score + Transit Score + pedestrian data ──────────────
  const k2 = step.start("[2/3] Pass 1 — Walk Score + Transit Score + pedestrian infrastructure");

  let pass1Html = await streamCall(
    client,
    "Pass 1 (data retrieval)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
Generate PART 1 ONLY — the complete data retrieval and verification documentation for WELL v2 V05 Active Commute Support.

This feature is address-based. Use web search extensively to retrieve and document the following:

STEP 1 — Walk Score (Part 1, Option 1)
Search walkscore.com or api.walkscore.com for the Walk Score at 600 W Broadway, San Diego, CA 92101.
Document:
- Walk Score value (0–100)
- Walk Score category (e.g., Walker's Paradise, Very Walkable, Walkable, Car-Dependent)
- Source URL and retrieval date
- Whether the score meets the WELL v2 V05 Part 1 threshold (confirm from feature requirements)
If Walk Score is not directly retrievable, search for pedestrian infrastructure data from OpenStreetMap, the City of San Diego GIS, or similar authoritative sources.

STEP 2 — Pedestrian-Friendly Streets (Part 1)
Search OpenStreetMap (openstreetmap.org), San Diego city GIS, or Google Maps to identify and document:
- Continuous sidewalk coverage along the building frontage on W Broadway
- Signalized crossings within the required radius
- Traffic calming features, pedestrian plazas, or streetscape improvements
- Any specific pedestrian-friendly street designations in the area
Produce a written description suitable as a Technical Document (Audited) for IWBI review.

STEP 3 — Transit Score (Part 2)
Search walkscore.com for the Transit Score at 600 W Broadway, San Diego, CA 92101.
Document:
- Transit Score value (0–100)
- Transit Score category
- Transit lines and stops within the required distance (search San Diego MTS, SDMTS.com, and San Diego Trolley schedule)
- Frequency of service (trips per hour for each route)
- Whether the score and/or transit access meets the WELL v2 V05 Part 2 threshold
List every nearby transit stop with:
  Stop name | Route(s) | Mode (bus/rail/ferry) | Distance from building (ft or mi) | Service frequency

STEP 4 — Point Determination
Based on retrieved data:
- Part 1 compliance status and basis
- Part 2 compliance status and basis
- Total points earned (0 or 1) and justification

Format all data as clean HTML with proper tables. Include source URLs and retrieval dates for every data item.`,
    }],
    usage,
  );
  ({ cleaned: pass1Html } = scrubNarration(pass1Html));
  step.complete(k2);

  // ─── [3/3] Pass 2 — Narrative + checklist ─────────────────────────────────────
  const k3 = step.start("[3/3] Pass 2 — Supporting narrative + submission checklist");

  let pass2Html = await streamCall(
    client,
    "Pass 2 (narrative + checklist)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

PART 1 OUTPUT (data retrieval from Pass 1):
${pass1Html.slice(0, 24000)}

INSTRUCTIONS:
Generate PART 2 and PART 3 ONLY. Begin directly with the Part 2 heading.

PART 2 — Supporting Documentation

SECTION A — Project Location Context
Write a brief narrative (1–2 paragraphs) describing the project's urban context — downtown San Diego, the W Broadway corridor, proximity to Embarcadero, Petco Park, and the broader Gaslamp Quarter — establishing why this location supports active commuting.

SECTION B — Walk Score Technical Document
Produce a complete Technical Document (Audited) for IWBI submission covering Part 1:
- Project address confirmation
- Walk Score value, category, and source
- Pedestrian street network description with specific street names and features within the required radius
- Pedestrian-friendly entry feature requirements: note that architectural drawings confirming benches, covered entry, lighting at building entrance are required from the project team (flag as [PROJECT TEAM TO PROVIDE])
- Compliance determination for Part 1

SECTION C — Transit Score Technical Document
Produce a complete Technical Document (Audited) for IWBI submission covering Part 2:
- Transit Score value, category, and source
- Complete transit stop inventory table (from Pass 1) with route, mode, distance, and frequency
- Compliance determination for Part 2

PART 3 — Complete Submission Checklist

Organize into:

GROUP A — PROVIDED BY CERTIFYAI:
List every retrieved and generated item (Walk Score documentation, Transit Score documentation, pedestrian infrastructure description, transit stop inventory, project context narrative).

GROUP B — REQUIRED FROM PROJECT TEAM:
- Architectural drawings confirming pedestrian-friendly entry features at the building entrance (benches, lighting, weather protection/covered entry)
- Owner or architect to confirm building entry design meets WELL v2 V05 Part 1 pedestrian environment requirements
For each item: state exactly what document or photograph is needed, which part of V05 it satisfies, and why it cannot be auto-generated.`,
    }],
    usage,
  );
  ({ cleaned: pass2Html } = scrubNarration(pass2Html));
  step.complete(k3);

  // ─── Assemble + validate + write ──────────────────────────────────────────────
  const kOut = step.start("[output] Assembling, validating, and writing output files");

  const combined = `${pass1Html}\n\n${pass2Html}`;
  const { cleaned: scrubbed } = scrubNarration(combined);

  const violations = validateNoUnnecessaryCustomerRequests(scrubbed);
  if (violations.length > 0) console.warn(`  ⚠ ${violations.length} validation flag(s)`);
  else console.log(`  ✓ No violations found`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const withCss      = injectTableCss(scrubbed);
  const standardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${FEATURE_NAME} — ${PROJECT_NAME}</title>
</head>
<body>
${withCss}
</body>
</html>`;
  const editableHtml = makeEditable(standardHtml);

  writeCleanFile(path.join(OUTPUT_DIR, `${SLUG}.html`),          standardHtml, SLUG);
  writeCleanFile(path.join(OUTPUT_DIR, `${EDITABLE_SLUG}.html`), editableHtml, EDITABLE_SLUG);
  console.log(`  ✓ Files written`);

  step.complete(kOut);

  const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
  const totalCost = ((usage.input / 1e6) * 3.00 + (usage.output / 1e6) * 15.00).toFixed(3);

  console.log("\n" + "═".repeat(60));
  console.log(`  Feature:  ${FEATURE_NAME}`);
  console.log(`  Project:  ${PROJECT_NAME}`);
  console.log(`  Address:  ${PROJECT_ADDRESS}`);
  console.log(`  Elapsed:  ${elapsed}s`);
  console.log(`  Cost:     $${totalCost}`);
  console.log(`  Tokens:   in:${usage.input.toLocaleString()} / out:${usage.output.toLocaleString()}`);
  console.log("─".repeat(60));
  console.log(`  Output: ${OUTPUT_DIR}/`);
  console.log(`    ${SLUG}.html`);
  console.log(`    ${EDITABLE_SLUG}.html`);
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message ?? err);
  process.exit(1);
});
