/**
 * pipeline/test-eq-prereq-1.ts
 *
 * Live test: EQ Prerequisite 1 — Minimum Indoor Air Quality Performance
 * Program: LEED v4.1 BD+C New Construction
 *
 * Project: 3rd and Spruce Recreation Center — 320 S 3rd St, Reading PA 19602
 *
 * Pipeline:
 *   1. Load XLSX credit row + form schema + pre-extract mechanical plan PDF + credit req PDF
 *   2. Pass 1 — Claude reads mechanical drawings → LEED Online Form EQ101
 *   3. Pass 2 — Claude produces supporting docs + ASHRAE 62.1 compliance analysis + checklist
 *   4. Assemble + validate → write output files
 *
 * Run: npx ts-node pipeline/test-eq-prereq-1.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { injectTableCss, makeEditable } from "./lib/make-editable";
import { CREDIT_SUBMISSION_PROMPT } from "./prompts/credit-submission";
import {
  validateNoUnnecessaryCustomerRequests,
  applyTargetedCorrections,
} from "./lib/validate-output";
import { StepLogger } from "./lib/pipeline-utils";
import { extractPdfContent } from "./lib/pdf-extract";
import { generateCalculatorGuide, type CalcGuideResult } from "./lib/calculator-guide";
import { validateCalculatorGuidePresent } from "./lib/validate-output";
import { scrubNarration, writeCleanFile } from "./lib/output-cleaner";

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

const DESKTOP       = "/Users/kelsey/Desktop/program automation ";
const XLSX_PATH     = path.resolve(__dirname, "reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");
const FORM_SCHEMA_PATH = path.resolve(__dirname, "reference/leed/leed_v41_form_schemas.json");
const MECH_PDF_PATH = path.join(DESKTOP, "example drawing set/3rd__Spruce_Rec_Center-Mech SAMPLE MECH PLAN.pdf");
const CREDIT_PDF_PATH = path.join(DESKTOP, "leed credit files Nov 2025 Guide /EQ files/leed bd+c v4.1 - EQ Prerequisite Minimum Indoor Air Quality Performance.pdf");
const OUTPUT_DIR    = path.resolve(__dirname, "output");
const SLUG          = "eq-prereq-1-minimum-iaq";
const EDITABLE_SLUG = "eq-prereq-1-minimum-iaq-editable";

const PROJECT_NAME    = "3rd and Spruce Recreation Center";
const PROJECT_ADDRESS = "320 S 3rd St, Reading PA 19602";
const PROJECT_OWNER   = "City of Reading Department of Public Works";
const PROGRAM_NAME    = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME     = "EQ Prerequisite 1 — Minimum Indoor Air Quality Performance";
const CREDIT_CODE     = "EQ Prereq 1";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) => String(r[1] ?? "").toLowerCase().includes("indoor air quality"));
  if (!row) throw new Error("EQ Prereq 1 row not found in XLSX");
  const lines = [`Credit Automation Analysis — ${row[0]}: ${row[1]}`];
  for (let i = 2; i < hdrs.length; i++) {
    const v = row[i];
    if (v !== undefined && v !== "") lines.push(`  ${hdrs[i]}: ${String(v).replace(/\n/g, " | ").trim()}`);
  }
  return lines.join("\n");
}

// ─── Streaming call helper ────────────────────────────────────────────────────

async function streamCall(
  client: Anthropic,
  label: string,
  systemPrompt: string,
  userContent: Anthropic.ContentBlockParam[],
  usage: { input: number; output: number },
  maxTokens = 64000,
): Promise<string> {
  const t0 = Date.now();
  process.stdout.write(`  ${label}: streaming`);
  let text = "", ticks = 0;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
    tools: [WEB_SEARCH_TOOL],
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

// ─── Mechanical drawing extract prompt ────────────────────────────────────────

const MECHANICAL_DRAWING_PROMPT = `Extract all of the following from this mechanical drawing set:
- Project name, address, owner, engineer, project number, date
- All applicable codes listed
- Design conditions (indoor/outdoor temperature and humidity targets)
- All air handling units: tag, supply CFM, outdoor air CFM, OA percentage, filter type/MERV rating, fan type (VAV/CAV), HP, cooling capacity (MBH), heating capacity (MBH/efficiency), refrigerant, manufacturer and model
- Complete ventilation calculation tables for each AHU: space number, space name, floor area (SF), occupancy category, design occupants, OA CFM/person (Rp), OA CFM/SF (Ra), breathing zone OA (Vbz), zone effectiveness (Ez), required OA (CFM), supply air (CFM), actual OA provided (CFM), OA%, exhaust CFM required, exhaust CFM provided
- Exhaust fans: tag, serving area, CFM, static pressure, HP, manufacturer/model
- Motor operated dampers: tag, location, size, control method
- Any CO2 sensors or outdoor air monitoring devices shown on plans
- Naturally ventilated spaces: room numbers, areas, and code section cited
- Energy recovery notes (required or not required, and why)
- All equipment schedules (AHU, VAV terminals, diffusers/registers, exhaust fans)
- Any ASHRAE 62.1 compliance notes or references
Output as structured plain text. Be thorough — include every number from every schedule table.`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const t0    = Date.now();
  const usage = { input: 0, output: 0 };
  const step  = new StepLogger();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`\nProject: ${PROJECT_NAME}`);
  console.log(`Address: ${PROJECT_ADDRESS}`);
  console.log(`Credit:  ${CREDIT_NAME}\n`);

  // ─── [1/4] Load source files ─────────────────────────────────────────────────
  const k1 = step.start("[1/4] Loading source files — XLSX + form schema + PDFs");

  const creditRow = extractCreditRow();
  console.log(`  ✓ Automation analysis row loaded`);

  let formSchemaBlock = "";
  try {
    const allSchemas = JSON.parse(fs.readFileSync(FORM_SCHEMA_PATH, "utf-8"));
    const eqSchema   = allSchemas.credits?.["EQ Prereq 1"];
    if (eqSchema?.fields?.all?.length) {
      formSchemaBlock = `\nLEED ONLINE FORM FIELD SCHEMA — EQ Prereq 1 (use these exact field IDs and labels, never training data):\n${JSON.stringify(eqSchema.fields.all, null, 2)}`;
      console.log(`  ✓ Form schema loaded — ${eqSchema.fields.all.length} fields`);
    }
  } catch (err) {
    console.warn(`  ⚠ Form schema load failed: ${(err as Error).message}`);
  }

  const mechExtract = await extractPdfContent(client, MECH_PDF_PATH, MECHANICAL_DRAWING_PROMPT);
  usage.input  += mechExtract.inputTokens;
  usage.output += mechExtract.outputTokens;
  console.log(`  ✓ Mechanical drawings extracted (${Math.round(mechExtract.text.length / 1024)} KB text)`);

  const creditPdfExtract = await extractPdfContent(client, CREDIT_PDF_PATH,
    `Extract all requirements, options, documentation requirements, and guidance from this LEED credit PDF. Include every requirement, threshold, and field reference. Output as structured plain text.`);
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

CREDIT REQUIREMENTS (from PDF):
${creditPdfExtract.text}

CREDIT AUTOMATION ANALYSIS:
${creditRow}
${formSchemaBlock}

MECHANICAL DRAWINGS — EXTRACTED DATA:
${mechExtract.text}`;

  // ─── [2/4] Pass 1 — LEED Online Form EQ101 ───────────────────────────────────
  const k2 = step.start("[2/4] Pass 1 — LEED Online Form EQ101 (mechanical drawings + web search)");

  let pass1Html = await streamCall(
    client,
    "Pass 1 (Form EQ101)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
Generate PART 1 ONLY — LEED Online Submittal Form EQ101.

The mechanical drawings for this project show mechanically ventilated spaces served by four air handling units (AHU-3, AHU-4, AHU-5, AHU-6) and two naturally ventilated vestibule spaces (Rooms 010 and 019, noted as naturally ventilated per IMC Section 402).

Use web search to:
1. Confirm EPA outdoor air quality non-attainment status for Reading, PA (Berks County) — check current EPA Green Book for PM2.5, PM10, and ozone designations at https://www.epa.gov/green-book
2. Note: Reading, PA is located in Climate Zone 5A

Reproduce the LEED Online Form EQ101 field-by-field using the form schema field IDs provided. Populate every field from the mechanical drawings. For any field requiring a project team upload, show the upload field with a clear label and [OWNER TO CONFIRM] only where genuinely site-specific.

The form must include:
- Unit type selection (IP)
- Project includes checkboxes: ☑ Mechanically Ventilated Spaces, ☑ Naturally Ventilated Spaces
- Total Ventilation Area field: sum of all ventilated floor areas from M300 schedule
- Mechanically Ventilated Spaces section: ASHRAE 62.1-2016 compliance confirmation, exhaust ventilation confirmation, outdoor air quality details (include EPA non-attainment status from web search), PM10/PM25/Ozone non-attainment flags, filtration documentation note, ventilation system compliance documentation note, mechanical ventilation controls documentation note
- Naturally Ventilated Spaces section: Option 1 (ASHRAE prescriptive path per 62.1-2016 Section 6.4.1), exhaust ventilation, outdoor air openings documentation, monitoring strategy
- No residential section (not a residential project)
- Special circumstances: none`,
    }],
    usage,
  );
  ({ cleaned: pass1Html } = scrubNarration(pass1Html));

  step.complete(k2);

  // ─── [3/4] Pass 2 — Supporting documentation ─────────────────────────────────
  const k3 = step.start("[3/4] Pass 2 — Supporting documentation + ASHRAE 62.1 analysis + checklist");

  let pass2Html = await streamCall(
    client,
    "Pass 2 (supporting docs)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
Generate PART 2 and PART 3 ONLY. Begin directly with the Part 2 heading.

PART 2 — Supporting Project Documentation

SECTION A — Retrieved Data
Include the following auto-retrieved items in full:
1. EPA Outdoor Air Quality Status — search and retrieve current EPA non-attainment designations for Berks County, PA (Reading) for PM2.5, PM10, and ozone. Show the full EPA data table. If any non-attainment designation exists, explain what filtration MERV rating is required per ASHRAE 62.1-2016 Section 6.2.1.
2. ASHRAE 62.1-2016 Table 6-1 ventilation rates — reproduce the applicable Table 6-1 values (Rp and Ra) for each occupancy category present in this project: Corridor, Lobby, Reception/Office, Computer Lab, Office, Classroom, Laundry, Dining Room, Storage, Restroom, Kitchen.
3. ASHRAE 62.1-2016 Table 6-2 Zone Air Distribution Effectiveness (Ez) values for each system type used.

SECTION B — Generated Outputs
Produce all of the following:

1. ASHRAE 62.1-2016 Multiple Zone Procedure Compliance Worksheet — a complete HTML table for each AHU showing:
   For each zone served: Zone name, Floor area (SF), Occupancy category (Table 6-1), Design occupants, Rp (cfm/person), Ra (cfm/SF), Breathing zone OA Vbz = Rp×Pz + Ra×Az (CFM), Zone supply airflow Vps (CFM), Zone OA fraction Zpz = Vbz/Vps, Zone air distribution effectiveness Ez (Table 6-2), Corrected zone OA Vcz = Vbz/Ez (CFM), OA provided by system (CFM), Compliance (Pass/Fail)
   AHU system-level summary: Total design OA provided, Total required OA, Compliance determination

2. Outdoor Air Monitoring Compliance Table — for each AHU, show: AHU tag, OA intake flow (CFM), Threshold (>1,000 CFM requires monitor), Monitoring device type required, Compliance status as shown in drawings

3. Exhaust Ventilation Compliance Table — for each exhaust-required space, show: Space, Area (SF), Occupancy type, Required exhaust rate (CFM/SF or CFM/fixture), Required exhaust (CFM), Provided exhaust (CFM), Compliance

4. Naturally Ventilated Spaces Summary — for each naturally ventilated space (Rooms 010 and 019), confirm compliance path (ASHRAE 62.1-2016 Section 6.4, prescriptive option, per IMC Section 402 of 2018 IMC/2015 IMC), monitoring strategy selected

5. Compliance Narrative — a professional paragraph-format narrative confirming:
   - All mechanically ventilated spaces comply with ASHRAE 62.1-2016 Sections 4, 5, 6.2, 6.5, and 7
   - Outdoor air quantities meet or exceed required minimums for all AHUs
   - Exhaust ventilation provided as required
   - Outdoor air monitoring provided for systems > 1,000 CFM OA
   - Filter MERV ratings meet requirements for ambient air quality
   - Naturally ventilated spaces comply with Section 6.4.1
   - No residential units; no healthcare occupancy

PART 3 — Complete Submission Checklist
Organize into GROUP A (PROVIDED BY CERTIFYAI) and GROUP B (REQUIRED FROM PROJECT TEAM).
For every GROUP A item include a source link URL.
For every GROUP B item explain exactly what the document is, why it must come from the project team, and the required format.`,
    }],
    usage,
  );
  ({ cleaned: pass2Html } = scrubNarration(pass2Html));

  step.complete(k3);

  // ─── [3.5/4] Calculator Input Guide ──────────────────────────────────────────
  const k35 = step.start("[3.5/4] Calculator Input Guide — EQ Prereq 1 Minimum IAQ Performance");
  let calcGuide: CalcGuideResult | null = null;
  try {
    const calcSourceContent = [
      `Project: ${PROJECT_NAME}`,
      `Address: ${PROJECT_ADDRESS}`,
      `Date: ${today}`,
      "",
      "MECHANICAL DRAWINGS — VENTILATION DATA:",
      mechExtract.text,
    ].join("\n");

    calcGuide = await generateCalculatorGuide(
      client,
      creditRow,
      CREDIT_NAME,
      calcSourceContent,
      usage,
    );

    if (calcGuide && !calcGuide.skipped) {
      console.log(`  ✓ Calculator Guide: ${calcGuide.calculatorName} — ${calcGuide.fieldCount} fields across ${calcGuide.tabCount} tab(s), ${calcGuide.ownerConfirmCount} owner-confirm`);
    } else if (calcGuide?.skipped) {
      console.warn(`  ⚠ Calculator Guide skipped: ${calcGuide.skipReason}`);
    }
  } catch (err) {
    console.warn(`  ⚠ Calculator Guide error: ${(err as Error).message}`);
  }
  step.complete(k35);

  // ─── [4/4] Assemble + validate + write files ──────────────────────────────────
  const k4 = step.start("[4/4] Assembling, validating, and writing output files");

  // Stitch + final scrub before any writes
  const calcGuideHtml = calcGuide ? calcGuide.html : "";
  const combined   = `${pass1Html}\n\n${pass2Html}\n\n${calcGuideHtml}`;
  const { cleaned: scrubbed } = scrubNarration(combined);
  const violations = [
    ...validateNoUnnecessaryCustomerRequests(scrubbed),
    ...validateCalculatorGuidePresent(scrubbed, creditRow),
  ];
  let validated    = scrubbed;
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

  // Final narration gate — runs scrubNarration() at write time as assertion
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
    console.log(`    [Calculator Input Guide embedded — ${calcGuide.fieldCount} fields, ${calcGuide.tabCount} tab(s)]`);
  }
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message ?? err);
  process.exit(1);
});
