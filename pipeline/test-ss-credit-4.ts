/**
 * pipeline/test-ss-credit-4.ts
 *
 * Live test: SS Credit 4 — Rainwater Management
 * Program: LEED v4.1 BD+C New Construction
 *
 * Project: Paseo Montril, San Diego, CA — Pardee Homes
 *
 * Uploads (as a project team would provide):
 *   1. Bioretention BMP fact sheet (RTF)
 *   2. Geotechnical investigation report (RTF)
 *   3. Stormwater Quality Management Plan / SWQMP (RTF)
 *   4. LEED SS Credit Rainwater Management requirements PDF
 *
 * Pipeline:
 *   1. Load XLSX credit row + form schema
 *   2. Pre-extract all three RTF documents via universal document extractor
 *   3. Extract credit requirements PDF
 *   4. Pass 1 — LEED Online Form SS109 + Rainfall Events Calculator
 *              (NOAA historical precipitation data via web search)
 *   5. Pass 2 — Calculator Input Guide + supporting documentation + checklist
 *   6. Assemble + validate + write output files
 *
 * Run: npx ts-node pipeline/test-ss-credit-4.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { extractDocumentContent, formatDocumentProfileForContext } from "./lib/document-extract";
import { injectTableCss, makeEditable }                           from "./lib/make-editable";
import { CREDIT_SUBMISSION_PROMPT }                               from "./prompts/credit-submission";
import { validateNoUnnecessaryCustomerRequests, applyTargetedCorrections, validateCalculatorGuidePresent } from "./lib/validate-output";
import { StepLogger }                                             from "./lib/pipeline-utils";
import { extractPdfContent }                                      from "./lib/pdf-extract";
import { generateCalculatorGuide, type CalcGuideResult }          from "./lib/calculator-guide";
import { scrubNarration, writeCleanFile }                         from "./lib/output-cleaner";

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

const DESKTOP          = "/Users/kelsey/Desktop/program automation ";
const DOCS_DIR         = path.join(DESKTOP, "example drawing set/test docs ss credit 4");
const BIORETENTION_RTF = path.join(DOCS_DIR, "biorenention.rtf");
const GEOTECH_RTF      = path.join(DOCS_DIR, "geotech.rtf");
const SWQMP_RTF        = path.join(DOCS_DIR, "stormwater plan.rtf");
const CREDIT_PDF       = path.join(DESKTOP, "leed credit files Nov 2025 Guide /SS files/leed bd+c v4.1 - SS Credit Rainwater Management.pdf");
const XLSX_PATH        = path.resolve(__dirname, "reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");
const FORM_SCHEMA_PATH = path.resolve(__dirname, "reference/leed/leed_v41_form_schemas.json");
const OUTPUT_DIR       = path.resolve(__dirname, "output");
const SLUG             = "ss-credit-4-rainwater-management";
const EDITABLE_SLUG    = "ss-credit-4-rainwater-management-editable";

const PROJECT_NAME    = "Paseo Montril";
const PROJECT_ADDRESS = "San Diego, California";
const PROJECT_OWNER   = "Pardee Homes";
const PROGRAM_NAME    = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME     = "SS Credit 4 — Rainwater Management";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) => String(r[1] ?? "").toLowerCase().includes("rainwater"));
  if (!row) throw new Error("SS Credit 4 row not found in XLSX");
  const lines = [`Credit Automation Analysis — ${row[0]}: ${row[1]}`];
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
  maxTokens     = 64000,
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
  console.log(`Credit:  ${CREDIT_NAME}\n`);

  // ─── [1/4] Load + pre-extract all source documents ───────────────────────────
  const k1 = step.start("[1/4] Loading source files — XLSX + form schema + 3 project docs + credit PDF");

  const creditRow = extractCreditRow();
  console.log(`  ✓ Automation analysis row loaded`);

  let formSchemaBlock = "";
  try {
    const allSchemas = JSON.parse(fs.readFileSync(FORM_SCHEMA_PATH, "utf-8"));
    const ss4Schema  = allSchemas.credits?.["SS Credit 4"];
    if (ss4Schema?.fields?.all?.length) {
      formSchemaBlock = `\nLEED ONLINE FORM FIELD SCHEMA — SS Credit 4 / Form SS109:\n${JSON.stringify(ss4Schema.fields.all, null, 2)}`;
      console.log(`  ✓ Form schema loaded — ${ss4Schema.fields.all.length} fields`);
    }
  } catch (err) {
    console.warn(`  ⚠ Form schema load failed: ${(err as Error).message}`);
  }

  // Pre-extract all three project documents via universal extractor
  const docFiles = [
    { filename: "biorenention.rtf",    buffer: fs.readFileSync(BIORETENTION_RTF), mimeType: "application/rtf" },
    { filename: "geotech.rtf",         buffer: fs.readFileSync(GEOTECH_RTF),      mimeType: "application/rtf" },
    { filename: "stormwater plan.rtf", buffer: fs.readFileSync(SWQMP_RTF),        mimeType: "application/rtf" },
  ];

  const docBlocks: string[] = [];
  for (const file of docFiles) {
    const profile = await extractDocumentContent(file, client, usage);
    docBlocks.push(formatDocumentProfileForContext(profile));
  }
  console.log(`  ✓ ${docFiles.length} project documents extracted`);

  // Credit requirements PDF
  const creditPdfExtract = await extractPdfContent(
    client, CREDIT_PDF,
    `Extract all requirements, options, thresholds, point schedules, documentation requirements, and LEED Online form field references from this LEED credit PDF. Include all percentile thresholds, calculator instructions, and BMP requirements. Output as structured plain text.`,
  );
  usage.input  += creditPdfExtract.inputTokens;
  usage.output += creditPdfExtract.outputTokens;
  console.log(`  ✓ Credit requirements extracted`);

  step.complete(k1);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const sharedContext = `CREDIT: ${CREDIT_NAME}
PROGRAM: ${PROGRAM_NAME}
PROJECT NAME: ${PROJECT_NAME}
PROJECT ADDRESS: ${PROJECT_ADDRESS}
PROJECT OWNER: ${PROJECT_OWNER}
SUBMISSION DATE: ${today}

CREDIT REQUIREMENTS (from LEED Credit PDF):
${creditPdfExtract.text}

CREDIT AUTOMATION ANALYSIS:
${creditRow}
${formSchemaBlock}

PROJECT DOCUMENTS:
${docBlocks.join("\n\n")}`;

  // ─── [2/4] Pass 1 — Form SS109 + Rainfall Events Calculator ─────────────────
  const k2 = step.start("[2/4] Pass 1 — LEED Online Form SS109 + Rainfall Events Calculator (NOAA data)");

  let pass1Html = await streamCall(
    client,
    "Pass 1 (Form SS109 + Calculator)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
Generate PART 1 ONLY — LEED Online Form SS109 and the completed Rainfall Events Calculator for SS Credit 4 Rainwater Management.

STEP 1 — NOAA Precipitation Data (web search required)
Use web search to retrieve daily precipitation records for San Diego, CA:
1. Find the nearest NOAA COOP weather station to San Diego, CA via NOAA Climate Data Online (ncdc.noaa.gov or similar)
2. Retrieve at minimum 10 years of daily precipitation data (30 years preferred per LEED guidance)
3. Record: station name, NOAA station ID, period of record, data source URL
4. Filter out events ≤ 0.1 inches (per LEED v4.1 updated guidance)
5. Calculate the 70th, 75th, 80th, 85th, 90th, 95th, and 98th percentile storm depths from the filtered dataset

STEP 2 — Stormwater Strategy Analysis
From the project documents, extract:
- Total site area and impervious area (pre- and post-development)
- All LID/GI stormwater management practices designed (bioretention cells, infiltration, detention, etc.)
- Retention volumes for each practice (cubic feet or gallons)
- Total runoff volume retained by proposed BMP system
- Hydrologic soil group from geotechnical report
- Design storm depth the system is sized to manage

STEP 3 — Percentile Determination and Point Calculation
Based on the retention volume from Step 2 and storm depth from Step 1:
- Determine which percentile storm the project manages (80th = 1 pt, 85th = 2 pts, 90th = 3 pts for non-zero lot line)
- Note: San Diego is not a zero lot line project per the stormwater plan; use standard 80th/85th/90th thresholds
- State the point determination clearly

STEP 4 — LEED Online Form SS109 (field by field)
Complete every field using exact field IDs from the form schema:
- radio1opt: Option 1 (Percentile of Rainfall Events)
- selectedOption1: percentile achieved
- rainfallEvents.nonZeroLLP.threshold: percentile threshold value
- rainfallEvents.rainFallEventsCalc: reference to completed calculator below
- rainfallEvents.runOffCalcDocs: reference to hydrology/SWQMP document upload
- rainfallEvents.lidDocs: reference to BMP cut sheets (bioretention fact sheet)
- rainfallEvents.practToImpleDetails: complete narrative of LID/GI strategies, volumes, and compliance path
- unitTypeSelected: IP (inch-pound)

STEP 5 — Rainfall Events Calculator — Historical Data Table
Produce a complete HTML table of the NOAA precipitation data with columns:
Date | Station | Precipitation (inches)
Include all non-zero, non-trace events > 0.1 inches from the retrieved dataset (minimum 10 years).
After the table, show the percentile calculations:
Percentile | Storm Depth (inches) | Events at or below this depth | Total qualifying events
Show 70th, 75th, 80th, 85th, 90th, 95th, 98th percentiles.`,
    }],
    usage,
  );
  ({ cleaned: pass1Html } = scrubNarration(pass1Html));
  step.complete(k2);

  // ─── [3/4] Pass 2 — Supporting documentation + compliance narrative ───────────
  const k3 = step.start("[3/4] Pass 2 — Supporting documentation + BMP analysis + checklist");

  let pass2Html = await streamCall(
    client,
    "Pass 2 (supporting docs)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

PART 1 OUTPUT (Form SS109 + Rainfall Events Calculator from Pass 1):
${pass1Html.slice(0, 20000)}

INSTRUCTIONS:
Generate PART 2 and PART 3 ONLY. Begin directly with the Part 2 heading.

PART 2 — Supporting Documentation

SECTION A — BMP Design Summary
Summarize the complete stormwater management system from the project documents:
- Site description and total drainage area
- Pre-development vs. post-development impervious area and runoff characteristics
- Each BMP/LID practice: type, sizing, location, retention volume
- Bioretention cell design parameters from the bioretention document
- Soil infiltration rate from the geotechnical report
- Total managed runoff volume and percentile storm achieved
- How the system meets LEED v4.1 SS Credit 4 requirements

SECTION B — Compliance Narrative
Professional paragraph confirming:
- Option selected (Option 1 — Percentile of Rainfall Events)
- Percentile threshold achieved and corresponding point total
- NOAA data source, station, and period of record
- LID/GI practices implemented and total retention volume
- Point determination: X points out of 3 possible

SECTION C — NOAA Data Source Documentation
- Weather station name and NOAA ID
- Period of record used
- URL/source for data retrieval
- Number of qualifying precipitation events analyzed
- Note any data gaps or limitations

PART 3 — Complete Submission Checklist
Organize into:

GROUP A — PROVIDED BY CERTIFYAI:
List every item completed in this submission (form fields, NOAA data table, percentile calculations, BMP summary, compliance narrative).

GROUP B — REQUIRED FROM PROJECT TEAM:
- Hydrology report with stamped pre/post runoff calculations (rainfallEvents.runOffCalcDocs) — must be signed/stamped by licensed civil engineer
- Completed LEED v4.1 Rainfall Events Calculator Excel file populated with NOAA data from this report (rainfallEvents.rainFallEventsCalc upload) — data provided in Part 1 table; team must enter into the official USGBC Excel calculator
- BMP cut sheets for all proprietary products (rainfallEvents.lidDocs)
For each item: explain what is needed, which field it satisfies, and why it cannot be auto-generated.`,
    }],
    usage,
  );
  ({ cleaned: pass2Html } = scrubNarration(pass2Html));
  step.complete(k3);

  // ─── [3.5/4] Calculator Input Guide ──────────────────────────────────────────
  const k35 = step.start("[3.5/4] Calculator Input Guide — Rainfall Events Calculator");
  let calcGuide: CalcGuideResult | null = null;
  try {
    const calcSourceContent = [
      `Project: ${PROJECT_NAME}`,
      `Address: ${PROJECT_ADDRESS}`,
      `Date: ${today}`,
      "",
      "PROJECT DOCUMENTS:",
      docBlocks.join("\n\n"),
      "",
      "PASS 1 OUTPUT (form + calculator data):",
      pass1Html.slice(0, 20000),
    ].join("\n");

    calcGuide = await generateCalculatorGuide(
      client,
      creditRow,
      CREDIT_NAME,
      calcSourceContent,
      usage,
    );

    if (calcGuide && !calcGuide.skipped) {
      console.log(`  ✓ Calculator Guide: ${calcGuide.calculatorName} — ${calcGuide.fieldCount} fields across ${calcGuide.tabCount} tab(s)`);
    } else if (calcGuide?.skipped) {
      console.log(`  ✓ Calculator guide: ${calcGuide.skipReason}`);
    }
  } catch (err) {
    console.warn(`  ⚠ Calculator Guide error: ${(err as Error).message}`);
  }
  step.complete(k35);

  // ─── [4/4] Assemble + validate + write ───────────────────────────────────────
  const k4 = step.start("[4/4] Assembling, validating, and writing output files");

  const calcGuideHtml = calcGuide ? calcGuide.html : "";
  const combined      = `${pass1Html}\n\n${pass2Html}\n\n${calcGuideHtml}`;
  const { cleaned: scrubbed } = scrubNarration(combined);

  const violations = [
    ...validateNoUnnecessaryCustomerRequests(scrubbed),
    ...validateCalculatorGuidePresent(scrubbed, creditRow),
  ];

  let validated = scrubbed;
  if (violations.length > 0) {
    validated = applyTargetedCorrections(validated, violations);
    const remaining = [
      ...validateNoUnnecessaryCustomerRequests(validated),
      ...validateCalculatorGuidePresent(validated, creditRow),
    ];
    if (remaining.length > 0) console.warn(`  ⚠ ${remaining.length} violation(s) remain after correction`);
    else console.log(`  ✓ All violations corrected`);
  } else {
    console.log(`  ✓ No violations found`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const withCss      = injectTableCss(validated);
  const standardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${CREDIT_NAME} — ${PROJECT_NAME}</title>
</head>
<body>
${withCss}
</body>
</html>`;
  const editableHtml = makeEditable(standardHtml);

  writeCleanFile(path.join(OUTPUT_DIR, `${SLUG}.html`),          standardHtml, SLUG);
  writeCleanFile(path.join(OUTPUT_DIR, `${EDITABLE_SLUG}.html`), editableHtml, EDITABLE_SLUG);
  console.log(`  ✓ Files written`);

  step.complete(k4);

  const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
  const totalCost = ((usage.input / 1e6) * 3.00 + (usage.output / 1e6) * 15.00).toFixed(3);

  console.log("\n" + "═".repeat(60));
  console.log(`  Credit:   ${CREDIT_NAME}`);
  console.log(`  Project:  ${PROJECT_NAME}`);
  console.log(`  Address:  ${PROJECT_ADDRESS}`);
  console.log(`  Elapsed:  ${elapsed}s`);
  console.log(`  Cost:     $${totalCost}`);
  console.log(`  Tokens:   in:${usage.input.toLocaleString()} / out:${usage.output.toLocaleString()}`);
  console.log("─".repeat(60));
  console.log(`  Output: ${OUTPUT_DIR}/`);
  console.log(`    ${SLUG}.html`);
  console.log(`    ${EDITABLE_SLUG}.html`);
  if (calcGuide && !calcGuide.skipped) {
    console.log(`    [Calculator Input Guide — ${calcGuide.fieldCount} fields, ${calcGuide.tabCount} tab(s)]`);
  }
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message ?? err);
  process.exit(1);
});
