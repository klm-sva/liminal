/**
 * pipeline/test-mr-credit-2.ts
 *
 * Live test: MR Credit 2 — Environmental Product Declarations
 * Program: LEED v4.1 BD+C New Construction
 *
 * Project: UCCS Cybersecurity and Space Ecosystem Expansion
 *
 * Uploads (as a project team would provide):
 *   1. Shortened drawing set (product/material schedules)
 *   2. Project manual / specifications (RTF → plain text)
 *   3. LEED credit requirements PDF
 *
 * Pipeline:
 *   1. Load XLSX credit row + form schema
 *   2. Extract drawings (document mode — schedule pages)
 *   3. Convert and load specs RTF
 *   4. Extract credit requirements PDF
 *   5. Pass 1 — LEED Online Form MR112 + product inventory from drawings + specs
 *   6. Pass 2 — EC3/EPD web research + BPDO calculator documentation
 *   7. Calculator Input Guide — BPDO EPD tab
 *   8. Assemble + validate + write output files
 *
 * Run: npx ts-node pipeline/test-mr-credit-2.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { extractSpecsContent, formatSpecsProfileForContext } from "./lib/specs-extract";
import { injectTableCss, makeEditable }                          from "./lib/make-editable";
import { CREDIT_SUBMISSION_PROMPT }                              from "./prompts/credit-submission";
import { validateNoUnnecessaryCustomerRequests, applyTargetedCorrections, validateCalculatorGuidePresent } from "./lib/validate-output";
import { StepLogger }                                            from "./lib/pipeline-utils";
import { extractPdfContent }                                     from "./lib/pdf-extract";
import { generateCalculatorGuide, type CalcGuideResult }        from "./lib/calculator-guide";
import { scrubNarration, writeCleanFile }                        from "./lib/output-cleaner";

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

const DESKTOP         = "/Users/kelsey/Desktop/program automation ";
const TEST_DOCS_DIR   = path.join(DESKTOP, "example drawing set/test docs mr credit 2");
const DRAWING_PDF     = path.join(TEST_DOCS_DIR, "shortened 2021-0525_UCCS BID SET - Drawings.pdf");
const SPECS_RTF       = path.join(TEST_DOCS_DIR, "test text.rtf");
const CREDIT_PDF      = path.join(DESKTOP, "leed credit files Nov 2025 Guide /MR files/leed bd+c v4.1 - MR Credit Environmental Product Declarations.pdf");
const XLSX_PATH       = path.resolve(__dirname, "reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");
const FORM_SCHEMA_PATH = path.resolve(__dirname, "reference/leed/leed_v41_form_schemas.json");
const OUTPUT_DIR      = path.resolve(__dirname, "output");
const SLUG            = "mr-credit-2-epd";
const EDITABLE_SLUG   = "mr-credit-2-epd-editable";

const PROJECT_NAME    = "UCCS Cybersecurity and Space Ecosystem Expansion";
const PROJECT_ADDRESS = "University of Colorado Colorado Springs, Colorado Springs, CO";
const PROJECT_OWNER   = "University of Colorado Colorado Springs";
const PROGRAM_NAME    = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME     = "MR Credit 2 — Environmental Product Declarations";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) => String(r[1] ?? "").toLowerCase().includes("environmental product"));
  if (!row) throw new Error("MR Credit 2 row not found in XLSX");
  const lines = [`Credit Automation Analysis — ${row[0]}: ${row[1]}`];
  for (let i = 2; i < hdrs.length; i++) {
    const v = row[i];
    if (v !== undefined && v !== "") lines.push(`  ${hdrs[i]}: ${String(v).replace(/\n/g, " | ").trim()}`);
  }
  return lines.join("\n");
}


// ─── Streaming call helper ────────────────────────────────────────────────────

async function streamCall(
  client:      Anthropic,
  label:       string,
  systemPrompt: string,
  userContent:  Anthropic.ContentBlockParam[],
  usage:       { input: number; output: number },
  maxTokens    = 64000,
): Promise<string> {
  const t0 = Date.now();
  process.stdout.write(`  ${label}: streaming`);
  let text = "", ticks = 0;

  const stream = client.messages.stream({
    model:      "claude-sonnet-4-6",
    max_tokens: maxTokens,
    temperature: 0,
    system:     systemPrompt,
    messages:   [{ role: "user", content: userContent }],
    tools:      [WEB_SEARCH_TOOL],
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
  const t0    = Date.now();
  const usage = { input: 0, output: 0 };
  const step  = new StepLogger();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`\nProject: ${PROJECT_NAME}`);
  console.log(`Address: ${PROJECT_ADDRESS}`);
  console.log(`Credit:  ${CREDIT_NAME}\n`);

  // ─── [1/4] Load source files ─────────────────────────────────────────────────
  const k1 = step.start("[1/4] Loading source files — XLSX + form schema + drawings + specs + credit PDF");

  const creditRow = extractCreditRow();
  console.log(`  ✓ Automation analysis row loaded`);

  let formSchemaBlock = "";
  try {
    const allSchemas = JSON.parse(fs.readFileSync(FORM_SCHEMA_PATH, "utf-8"));
    const mr2Schema  = allSchemas.credits?.["MR Credit 2"];
    if (mr2Schema?.fields?.all?.length) {
      formSchemaBlock = `\nLEED ONLINE FORM FIELD SCHEMA — MR Credit 2 (use these exact field IDs):\n${JSON.stringify(mr2Schema.fields.all, null, 2)}`;
      console.log(`  ✓ Form schema loaded — ${mr2Schema.fields.all.length} fields`);
    }
  } catch (err) {
    console.warn(`  ⚠ Form schema load failed: ${(err as Error).message}`);
  }

  // Drawing schedules — document mode (9 letter-size schedule pages)
  const drawingExtract = await extractPdfContent(
    client, DRAWING_PDF,
    `Extract all product schedules, material schedules, finish schedules, equipment schedules, and door/window/hardware schedules from these drawing pages.
For each schedule row extract: item tag/number, product name, manufacturer, model/series number, material description, finish, size, CSI division if noted, and any LEED or sustainability notes.
Also extract: project name, address, architect, project number, and date from the title block.
Output as structured plain text — include every row from every schedule table.`,
    "document",
  );
  usage.input  += drawingExtract.inputTokens;
  usage.output += drawingExtract.outputTokens;
  console.log(`  ✓ Drawing schedules extracted (${Math.round(drawingExtract.text.length / 1024)} KB)`);

  // Specs — pre-extract product inventory from RTF (simulates what upload webhook does)
  const specsBuffer  = fs.readFileSync(SPECS_RTF);
  const specsProfile = await extractSpecsContent(
    [{ filename: path.basename(SPECS_RTF), buffer: specsBuffer, mimeType: "application/rtf" }],
    client,
    usage,
  );
  const specsProfileBlock = formatSpecsProfileForContext(specsProfile);
  console.log(`  ✓ Specifications pre-extracted — ${specsProfile.product_count} products (${Math.round(specsProfileBlock.length / 1024)} KB compact profile)`);

  // Credit requirements PDF
  const creditPdfExtract = await extractPdfContent(
    client, CREDIT_PDF,
    `Extract all requirements, options, thresholds, documentation requirements, and LEED Online form field references from this LEED credit PDF. Include every requirement and threshold. Output as structured plain text.`,
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

CREDIT REQUIREMENTS (from PDF):
${creditPdfExtract.text}

CREDIT AUTOMATION ANALYSIS:
${creditRow}
${formSchemaBlock}

DRAWING SCHEDULES — EXTRACTED DATA:
${drawingExtract.text}

${specsProfileBlock}`;

  // ─── [2/4] Pass 1 — LEED Online Form MR112 ───────────────────────────────────
  const k2 = step.start("[2/4] Pass 1 — LEED Online Form MR112 + product inventory");

  let pass1Html = await streamCall(
    client,
    "Pass 1 (Form MR112)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
Generate PART 1 ONLY — LEED Online Submittal Form MR112 for MR Credit 2 Environmental Product Declarations.

Use web search to:
1. Verify current LEED v4.1 EPD requirements and thresholds on usgbc.org
2. Confirm the LEED v4.1 Building Products (BPDO) Calculator is the required tool

From the drawing schedules and project specifications, identify the permanently installed building products most likely to have EPDs. Focus on the major material categories that regularly carry EPDs: concrete, steel/metal framing, glazing, masonry, insulation, gypsum board, acoustic ceiling, flooring (carpet, tile, resilient), roofing, wood/lumber, and MEP equipment.

Select the best candidates — up to 30 products — prioritizing products from manufacturers known to publish EPDs (major national manufacturers) and products from CSI Divisions 03, 04, 05, 06, 07, 08, 09.

Then produce the LEED Online Form MR112 field by field using the exact field IDs from the form schema:
- op1 checkbox: Option 1 — Environmental Product Declaration (1 point)
- op2 checkbox: Option 2 — Embodied Carbon/LCA Optimization (1 point) — only if evidence supports it
- selectedOptions: list selected options
- envProductDeclaration.wtNumOfProduWithEPD: weighted product count with EPDs (target ≥ 20)
- envProductDeclaration.calcRepreMin5DiffManuf: confirmation of ≥ 5 manufacturers
- envProductDeclaration.inclExteCricReviOfLCA: external critical review of LCA confirmation
- bpdoCalcDocs: reference to attached completed BPDO Calculator EPD tab
- Special Circumstances: none unless applicable

After the form, produce a CANDIDATE PRODUCT TABLE listing only the up-to-30 selected products with: Product Name | Manufacturer | CSI Division | Material Category. Do NOT list every product from the specifications — only the EPD candidates that will be researched in Part 2.`,
    }],
    usage,
  );
  ({ cleaned: pass1Html } = scrubNarration(pass1Html));
  step.complete(k2);

  // ─── [3/4] Pass 2 — EPD research + supporting documentation ──────────────────
  const k3 = step.start("[3/4] Pass 2 — EPD web research + BPDO documentation + compliance analysis");

  let pass2Html = await streamCall(
    client,
    "Pass 2 (EPD research)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

PART 1 OUTPUT (product inventory from Pass 1):
${pass1Html.slice(0, 15000)}

INSTRUCTIONS:
Generate PART 2 and PART 3 ONLY. Begin directly with the Part 2 heading.

PART 2 — EPD Research and Supporting Documentation

For each product in the candidate table from Part 1, use web search to find its EPD on EC3 (buildingtransparency.org) or the manufacturer's website. Determine:
1. EPD type: product-specific Type III EPD (counts as 1.5×) or industry-wide EPD (counts as 1×)
2. EPD Program Operator (e.g., UL Environment, SCS Global, NSF, Environdec, Carbon Leadership Forum)
3. GBCI "Verified for LEED Documentation" ID if available
4. Expiration date if shown

SECTION A — EPD Research Results (Qualifying Products Only)
Produce a table of ONLY the products where an EPD was confirmed: Product Name | Manufacturer | CSI Division | EPD Type | Program Operator | EPD Source URL | GBCI ID (if any) | Weighting | Expiration
Do NOT include products where no EPD was found — those are not part of the submission.

SECTION B — Weighted Product Count Summary
- Product-specific Type III EPDs × 1.5
- Industry-wide EPDs × 1.0
- Total weighted count vs. threshold of 20
- Manufacturer count vs. threshold of 5
- Point determination: 1 point (≥20 products, ≥5 manufacturers) or 0 points
- If weighted count falls below 20: note how many additional products with EPDs the team needs to source, and recommend searching EC3 at buildingtransparency.org for remaining specification products.

SECTION C — Compliance Narrative
Professional paragraph confirming compliance path, EPD types found, manufacturer diversity, and any remaining gap for the team to close.

PART 3 — Complete Submission Checklist
Organize into GROUP A (PROVIDED BY CERTIFYAI) and GROUP B (REQUIRED FROM PROJECT TEAM).
For GROUP B items, explain exactly what is needed and why it cannot be auto-retrieved.`,
    }],
    usage,
  );
  ({ cleaned: pass2Html } = scrubNarration(pass2Html));
  step.complete(k3);

  // ─── [3.5/4] Calculator Input Guide — BPDO EPD tab ───────────────────────────
  const k35 = step.start("[3.5/4] Calculator Input Guide — BPDO Calculator");
  let calcGuide: CalcGuideResult | null = null;
  try {
    const calcSourceContent = [
      `Project: ${PROJECT_NAME}`,
      `Address: ${PROJECT_ADDRESS}`,
      `Date: ${today}`,
      "",
      "DRAWING SCHEDULES:",
      drawingExtract.text,
      "",
      "SPECIFICATIONS (compact product profile):",
      specsProfileBlock,
      "",
      "EPD RESEARCH OUTPUT:",
      pass2Html.slice(0, 20000),
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
      console.warn(`  ⚠ Calculator Guide skipped: ${calcGuide.skipReason}`);
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
    console.log(`    [Calculator Input Guide embedded — ${calcGuide.fieldCount} fields, ${calcGuide.tabCount} tab(s)]`);
  }
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message ?? err);
  process.exit(1);
});
