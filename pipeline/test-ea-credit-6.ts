/**
 * pipeline/test-ea-credit-6.ts
 *
 * Live test: EA Credit 6 — Enhanced Refrigerant Management
 * Program: LEED v4.1 BD+C New Construction
 *
 * Project: 3rd and Spruce Recreation Center — 320 S 3rd St, Reading PA 19602
 *
 * Uploads (as a project team would provide):
 *   1. YORK ZH/ZJ/ZR packaged unit technical guide / cut sheet (RTF)
 *   2. Mechanical drawings / equipment schedule (PDF)
 *   3. LEED EA Credit Enhanced Refrigerant Management requirements PDF
 *
 * Pipeline:
 *   1. Load XLSX credit row + form schema
 *   2. Pre-extract equipment cut sheet via universal document extractor
 *   3. Extract mechanical drawings for equipment schedule
 *   4. Extract credit requirements PDF
 *   5. Pass 1 — LEED Online Form EA127 + LCGWP/LCODP calculations
 *              (EPA SNAP database lookup via web search)
 *   6. Pass 2 — Supporting documentation + refrigerant management plan + checklist
 *   7. Calculator Input Guide
 *   8. Assemble + validate + write output files
 *
 * Run: npx ts-node pipeline/test-ea-credit-6.ts
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
const DOCS_DIR         = path.join(DESKTOP, "example drawing set/test docs ea credit 6");
const CUT_SHEET_RTF    = path.join(DOCS_DIR, "Untitled.rtf");
const MECH_PDF         = path.join(DOCS_DIR, "3rd__Spruce_Rec_Center-Mech.pdf");
const CREDIT_PDF       = path.join(DESKTOP, "leed credit files Nov 2025 Guide /EA files/leed bd+c v4.1 - EA Credit Enhanced Refrigerant Management.pdf");
const XLSX_PATH        = path.resolve(__dirname, "reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");
const FORM_SCHEMA_PATH = path.resolve(__dirname, "reference/leed/leed_v41_form_schemas.json");
const CALC_SCHEMA_PATH = path.resolve(__dirname, "reference/leed/leed_v41_calculator_schemas.json");
const OUTPUT_DIR       = path.resolve(__dirname, "output");
const SLUG             = "ea-credit-6-enhanced-refrigerant";
const EDITABLE_SLUG    = "ea-credit-6-enhanced-refrigerant-editable";

const PROJECT_NAME    = "3rd and Spruce Recreation Center";
const PROJECT_ADDRESS = "320 S 3rd St, Reading, PA 19602";
const PROJECT_OWNER   = "City of Reading Department of Public Works";
const PROGRAM_NAME    = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME     = "EA Credit 6 — Enhanced Refrigerant Management";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) => String(r[0] ?? "").trim() === "EA Credit 6");
  if (!row) throw new Error("EA Credit 6 row not found in XLSX");
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

  // ─── [1/4] Load all source documents ─────────────────────────────────────────
  const k1 = step.start("[1/4] Loading source files — XLSX + form schema + cut sheet + mech drawings + credit PDF");

  const creditRow = extractCreditRow();
  console.log(`  ✓ Automation analysis row loaded`);

  let formSchemaBlock = "";
  try {
    const allSchemas = JSON.parse(fs.readFileSync(FORM_SCHEMA_PATH, "utf-8"));
    const ea6Schema  = allSchemas.credits?.["EA Credit 6"];
    if (ea6Schema?.fields?.all?.length) {
      formSchemaBlock = `\nLEED ONLINE FORM FIELD SCHEMA — EA Credit 6 / Form EA127:\n${JSON.stringify(ea6Schema.fields.all, null, 2)}`;
      console.log(`  ✓ Form schema loaded — ${ea6Schema.fields.all.length} fields`);
    }
  } catch (err) {
    console.warn(`  ⚠ Form schema load failed: ${(err as Error).message}`);
  }

  // Pre-extract equipment cut sheet via universal document extractor
  const cutSheetBuffer = fs.readFileSync(CUT_SHEET_RTF);
  const cutSheetProfile = await extractDocumentContent(
    { filename: "Untitled.rtf", buffer: cutSheetBuffer, mimeType: "application/rtf" },
    client,
    usage,
  );
  const cutSheetBlock = formatDocumentProfileForContext(cutSheetProfile);
  console.log(`  ✓ Equipment cut sheet extracted — ${cutSheetProfile.type_name}`);

  // Mechanical drawings — document mode to extract equipment schedule
  const mechExtract = await extractPdfContent(
    client, MECH_PDF,
    `Extract the complete mechanical equipment schedule from these drawings. For every piece of HVAC/refrigeration equipment, extract:
- Equipment tag/number
- Equipment type (packaged unit, split system, chiller, heat pump, etc.)
- Manufacturer and model number
- Refrigerant type (R-410A, R-32, R-454B, etc.)
- Cooling capacity (tons or MBH)
- Refrigerant charge weight (lbs) — if shown
- Equipment life (years) — if shown
- COP or EER — if shown
- Quantity
Also extract: project name, address, mechanical engineer, and drawing date from the title block.
Output as structured plain text with every row from every equipment schedule.`,
    "document",
  );
  usage.input  += mechExtract.inputTokens;
  usage.output += mechExtract.outputTokens;
  console.log(`  ✓ Mechanical equipment schedule extracted (${Math.round(mechExtract.text.length / 1024)} KB)`);

  // Credit requirements PDF
  const creditPdfExtract = await extractPdfContent(
    client, CREDIT_PDF,
    `Extract all requirements, options, calculation formulas, thresholds, and LEED Online form field references from this LEED credit PDF. Include the complete LCGWP and LCODP formulas, all GWP and ODP values referenced, and all compliance thresholds. Output as structured plain text.`,
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

MECHANICAL EQUIPMENT SCHEDULE (from drawings):
${mechExtract.text}

EQUIPMENT CUT SHEET:
${cutSheetBlock}`;

  // ─── [2/4] Pass 1 — Form EA127 + refrigerant impact calculations ─────────────
  const k2 = step.start("[2/4] Pass 1 — LEED Online Form EA127 + LCGWP/LCODP calculations");

  let pass1Html = await streamCall(
    client,
    "Pass 1 (Form EA127 + calculations)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
Generate PART 1 ONLY — LEED Online Form EA127 and the complete refrigerant impact calculations for EA Credit 6 Enhanced Refrigerant Management.

STEP 1 — Refrigerant Identification and EPA SNAP Data (web search required)
From the mechanical equipment schedule and cut sheet, identify every refrigerant-containing piece of equipment. For each refrigerant type identified, use web search to confirm from EPA SNAP Program (epa.gov/snap) or ASHRAE Standard 34:
- GWP (Global Warming Potential) — kg CO2 equivalent
- ODP (Ozone Depletion Potential) — relative to R-11
- SNAP approval status
- Classification (HFC, HFO, natural refrigerant, etc.)

STEP 2 — Equipment Inventory Table
Produce a complete HTML table of all refrigerant-containing equipment:
Equipment Tag | Equipment Type | Manufacturer | Model | Refrigerant | GWP | ODP | Charge (lbs) | Rated Capacity (tons) | Equipment Life (years) | COP/EER

If charge weight is not shown on the equipment schedule, estimate from the cut sheet data and note as estimated.
If equipment life is not specified, use LEED default values: packaged units = 15 years, chillers = 23 years, split systems = 15 years.

STEP 3 — LCGWP and LCODP Calculations (Option 2 — Calculation of Refrigerant Impact)
Using the LEED v4.1 formula for each piece of equipment:
  LCGWP = [GWPr × Mr × (Lr × Life + End_of_Life)] / (Life × Qdesign)
  LCODP = [ODPr × Mr × (Lr × Life + End_of_Life)] / (Life × Qdesign)

Where:
  GWPr = refrigerant GWP (kg CO2/kg refrigerant)
  ODPr = refrigerant ODP (kg CFC-11/kg refrigerant)
  Mr = initial refrigerant charge (lbs converted to kg: × 0.4536)
  Lr = annual refrigerant leakage rate (%) — use 2% default per LEED guidance
  Life = equipment life (years)
  End_of_Life = 10% (LEED default refrigerant loss at end of life)
  Qdesign = equipment cooling capacity (tons × 3.517 = kW)
  Rc = refrigerant charge per unit capacity (lbs/ton)

Show all calculations step by step for each piece of equipment. Then:
  refiImpactTotal per unit = LCGWP + (LCODP × 100,000)
  refiImpactAvg = Σ(refiImpactTotal × Qdesign) / Σ(Qdesign) — capacity-weighted average
  Compliance threshold: refiImpactAvg ≤ 100

STEP 4 — LEED Online Form EA127 (field by field)
Complete every field using exact field IDs from the form schema:
- radio1: Option 2 (Calculation of Refrigerant Impact) — unless all equipment uses natural refrigerants or no refrigerants
- selectedOption: option selected
- calcRefrigerantImpact.prjRefComplyASHRAE: ASHRAE Standard 15 compliance confirmation
- calcRefrigerantImpact.refriEquipments.row: one row per equipment unit with all calculated values
- calcRefrigerantImpact.refriEquipments.qTotal: total capacity-tons
- calcRefrigerantImpact.refriEquipments.refiImpactTotal: per-unit impact values
- calcRefrigerantImpact.refriEquipments.refiImpactAvg: weighted average (must be ≤ 100)
- calcRefrigerantImpact.refrigMangPlanDocs: reference to refrigerant management plan
- calcRefrigerantImpact.vrfDocuments: reference to VRF documentation (if applicable)
- Point determination: 1 point if refiImpactAvg ≤ 100`,
    }],
    usage,
  );
  ({ cleaned: pass1Html } = scrubNarration(pass1Html));
  step.complete(k2);

  // ─── [3/4] Pass 2 — Supporting documentation + compliance narrative ───────────
  const k3 = step.start("[3/4] Pass 2 — Supporting documentation + compliance narrative + checklist");

  let pass2Html = await streamCall(
    client,
    "Pass 2 (supporting docs)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

PART 1 OUTPUT (Form EA127 + calculations from Pass 1):
${pass1Html.slice(0, 20000)}

INSTRUCTIONS:
Generate PART 2 and PART 3 ONLY. Begin directly with the Part 2 heading.

PART 2 — Supporting Documentation

SECTION A — Refrigerant Management Plan
Draft a complete project-specific Refrigerant Management Plan meeting LEED v4.1 EA Credit 6 requirements. Include:
1. Project identification (name, address, owner, mechanical contractor placeholder)
2. HVAC&R equipment inventory (all refrigerant-containing equipment from Pass 1)
3. Refrigerant types used and SNAP approval status
4. Annual leak inspection protocol (equipment, frequency, method, documentation)
5. Leak detection system requirements (per ASHRAE Standard 15)
6. Refrigerant tracking log (template table: date, technician, equipment tag, refrigerant added/removed, running total charge)
7. Emergency response procedures for refrigerant release
8. End-of-life refrigerant recovery and disposal procedures
9. Responsible party designations (owner representative, service contractor)
Note: This plan template requires owner signature and mechanical contractor information to be complete. Flag those fields clearly as [OWNER/CONTRACTOR TO COMPLETE].

SECTION B — ASHRAE Standard 15 Compliance Narrative
Confirm compliance with ASHRAE Standard 15-2019 (Safety Standard for Refrigeration Systems):
- Refrigerant classification (A1, A2L, B1, B2L, etc.) for each refrigerant used
- Machinery room requirements (if applicable)
- Detector/alarm requirements
- Access and service provisions
- Compliance statement

SECTION C — Compliance Summary
- Option selected: Option 2 — Calculation of Refrigerant Impact
- Weighted average refrigerant impact (refiImpactAvg) vs. threshold of 100
- Point determination: 1 point (credit earned) or 0 points
- Summary of refrigerants used, equipment count, and overall system characterization

PART 3 — Complete Submission Checklist
Organize into:

GROUP A — PROVIDED BY CERTIFYAI:
List every completed item (form fields, calculations, refrigerant management plan template, ASHRAE 15 narrative).

GROUP B — REQUIRED FROM PROJECT TEAM:
- Mechanical engineer to confirm refrigerant charge weights for each unit (if not on equipment schedule)
- Signed refrigerant management plan with owner and contractor information completed
- VRF system documentation if any VRF equipment is installed
For each item: explain exactly what is needed, which field it satisfies, and why it cannot be auto-generated.`,
    }],
    usage,
  );
  ({ cleaned: pass2Html } = scrubNarration(pass2Html));
  step.complete(k3);

  // ─── [3.5/4] Calculator Input Guide ──────────────────────────────────────────
  const k35 = step.start("[3.5/4] Calculator Input Guide");
  let calcGuide: CalcGuideResult | null = null;
  try {
    const calcSourceContent = [
      `Project: ${PROJECT_NAME}`,
      `Address: ${PROJECT_ADDRESS}`,
      `Date: ${today}`,
      "",
      "EQUIPMENT SCHEDULE:",
      mechExtract.text,
      "",
      "EQUIPMENT CUT SHEET:",
      cutSheetBlock,
      "",
      "PASS 1 CALCULATIONS:",
      pass1Html.slice(0, 20000),
    ].join("\n");

    const calcSchemasJson = fs.existsSync(CALC_SCHEMA_PATH)
      ? JSON.parse(fs.readFileSync(CALC_SCHEMA_PATH, "utf-8"))
      : { calculators: {} };

    calcGuide = await generateCalculatorGuide(
      client,
      creditRow,
      CREDIT_NAME,
      calcSourceContent,
      usage,
      calcSchemasJson,
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
