/**
 * pipeline/test-ss-credit-1.ts
 *
 * Live test: SS Credit 1 — Site Assessment
 * Program: LEED v4.1 BD+C New Construction
 *
 * Project: Proposed Residential Building — 3150 El Camino Real, Palo Alto, CA
 * Client: Acclaim Companies
 *
 * Uploads (as a project team would provide):
 *   1. Geotechnical investigation report (RTF) — Rockridge Geotechnical, Inc.
 *   2. LEED SS Credit Site Assessment requirements PDF
 *
 * Pipeline:
 *   1. Load XLSX credit row + form schema + convert geotech RTF
 *   2. Extract credit requirements from PDF
 *   3. Pass 1 — LEED Online Form SS104 + seven-section site assessment worksheet
 *              (web search: USGS topo, FEMA FIRM, EPA Level III ecoregion, NOAA, NRCS soils)
 *   4. Pass 2 — Supporting documentation + compliance narrative + checklist
 *   5. Assemble + validate + write output files
 *
 * Run: npx ts-node pipeline/test-ss-credit-1.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { extractDocumentContent, formatDocumentProfileForContext }     from "./lib/document-extract";
import { injectTableCss, makeEditable }                                from "./lib/make-editable";
import { CREDIT_SUBMISSION_PROMPT }                                    from "./prompts/credit-submission";
import { validateNoUnnecessaryCustomerRequests, applyTargetedCorrections, validateCalculatorGuidePresent } from "./lib/validate-output";
import { StepLogger }                                                  from "./lib/pipeline-utils";
import { extractPdfContent }                                           from "./lib/pdf-extract";
import { generateCalculatorGuide, type CalcGuideResult }               from "./lib/calculator-guide";
import { scrubNarration, writeCleanFile }                              from "./lib/output-cleaner";

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
const SS_DOCS_DIR      = path.join(DESKTOP, "example drawing set/test documents ss credit 1");
const GEO_RTF          = path.join(SS_DOCS_DIR, "geo.rtf");
const CREDIT_PDF       = path.join(DESKTOP, "leed credit files Nov 2025 Guide /SS files/leed bd+c v4.1 - SS Credit Site Assessment.pdf");
const XLSX_PATH        = path.resolve(__dirname, "reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");
const FORM_SCHEMA_PATH = path.resolve(__dirname, "reference/leed/leed_v41_form_schemas.json");
const OUTPUT_DIR       = path.resolve(__dirname, "output");
const SLUG             = "ss-credit-1-site-assessment";
const EDITABLE_SLUG    = "ss-credit-1-site-assessment-editable";

const PROJECT_NAME    = "3150 El Camino Real Residential";
const PROJECT_ADDRESS = "3150 El Camino Real, Palo Alto, CA 94306";
const PROJECT_OWNER   = "Acclaim Companies";
const PROGRAM_NAME    = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME     = "SS Credit 1 — Site Assessment";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) =>
    String(r[0] ?? "").trim() === "SS Credit 1" ||
    String(r[1] ?? "").toLowerCase().includes("site assessment") &&
    String(r[0] ?? "").toLowerCase().includes("ss credit 1")
  );
  if (!row) throw new Error("SS Credit 1 row not found in XLSX");
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
  const t0    = Date.now();
  const usage = { input: 0, output: 0 };
  const step  = new StepLogger();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`\nProject: ${PROJECT_NAME}`);
  console.log(`Address: ${PROJECT_ADDRESS}`);
  console.log(`Credit:  ${CREDIT_NAME}\n`);

  // ─── [1/4] Load source files ─────────────────────────────────────────────────
  const k1 = step.start("[1/4] Loading source files — XLSX + form schema + geotech report + credit PDF");

  const creditRow = extractCreditRow();
  console.log(`  ✓ Automation analysis row loaded`);

  let formSchemaBlock = "";
  try {
    const allSchemas = JSON.parse(fs.readFileSync(FORM_SCHEMA_PATH, "utf-8"));
    const ss1Schema  = allSchemas.credits?.["SS Credit 1"];
    if (ss1Schema?.fields?.all?.length) {
      formSchemaBlock = `\nLEED ONLINE FORM FIELD SCHEMA — SS Credit 1 / Form SS104 (use these exact field IDs):\n${JSON.stringify(ss1Schema.fields.all, null, 2)}`;
      console.log(`  ✓ Form schema loaded — ${ss1Schema.fields.all.length} fields`);
    }
  } catch (err) {
    console.warn(`  ⚠ Form schema load failed: ${(err as Error).message}`);
  }

  // Pre-extract geotechnical report into structured profile
  const geoBuffer  = fs.readFileSync(GEO_RTF);
  const geoProfile = await extractDocumentContent(
    { filename: path.basename(GEO_RTF), buffer: geoBuffer, mimeType: "application/rtf" },
    client,
    usage,
  );
  const geoBlock = formatDocumentProfileForContext(geoProfile);
  console.log(`  ✓ Geotech profile extracted — ${Math.round(geoBlock.length / 1024)} KB compact profile`);

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

CREDIT REQUIREMENTS (from LEED Credit PDF):
${creditPdfExtract.text}

CREDIT AUTOMATION ANALYSIS:
${creditRow}
${formSchemaBlock}

${geoBlock}`;

  // ─── [2/4] Pass 1 — Form SS104 + 7-section site assessment worksheet ──────────
  const k2 = step.start("[2/4] Pass 1 — LEED Online Form SS104 + site assessment worksheet (web research)");

  let pass1Html = await streamCall(
    client,
    "Pass 1 (Form SS104 + worksheet)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
Generate PART 1 ONLY — LEED Online Form SS104 and the complete seven-section site assessment worksheet for SS Credit 1 Site Assessment.

Use web search extensively to retrieve the following data for ${PROJECT_ADDRESS}:

1. USGS National Map / USGS TopoView — topographic elevation data, contour intervals, site slope/grade, surrounding terrain description
2. FEMA Map Service Center (msc.fema.gov) — FIRM panel number, flood zone designation (Zone X, AE, etc.), SFHA determination, BFE if applicable
3. USDA NRCS Web Soil Survey (websoilsurvey.nrcs.usda.gov) — soil map units, Hydrologic Soil Group, drainage class, prime farmland designation, expansion potential, soil series description
4. EPA Level III Ecoregion — ecoregion name and number for Palo Alto, CA; Level IV ecoregion if available; ecoregion description for vegetation context
5. NOAA Climate Data — annual precipitation, temperature range, prevailing winds, climate zone for Palo Alto, CA
6. California Department of Conservation / USGS — seismic hazard zone, Alquist-Priolo fault zone status
7. Existing conditions from geotech report — extract key findings about soils, groundwater, expansive soils, seismic hazards

Then produce:

SECTION A — LEED Online Form SS104 (field by field)
Use the exact field IDs from the form schema. For upload fields (siteSurvey, siteTopography, siteSPFHA), indicate the document title and reference. For siteAssesWorkSheet, reference the worksheet below. For siteEpaLevel3Details, provide the full EPA Level III ecoregion description text.

SECTION B — Site Assessment Worksheet (siteAssesWorkSheet)
Complete all seven required sections per LEED v4.1 requirements:

1. TOPOGRAPHY
   - Site elevation range and slope from USGS data
   - Topographic features: flat areas, slopes, drainage swales, ridges
   - Grading implications for stormwater and accessibility

2. HYDROLOGY
   - FEMA FIRM flood zone designation and panel reference
   - 100-year and 500-year floodplain status
   - Stormwater drainage pattern, existing impervious area, site drainage direction
   - Groundwater depth from geotech report

3. SOILS
   - NRCS Web Soil Survey map unit(s) and soil series
   - Hydrologic Soil Group (A/B/C/D)
   - Drainage class and permeability
   - Expansive soil potential (corroborate with geotech findings)
   - Prime farmland classification
   - Construction implications from geotech report

4. VEGETATION
   - Existing vegetation on site (from geotech report site description)
   - Native plant potential for EPA Level III ecoregion
   - Invasive species concerns
   - Tree preservation considerations

5. HUMAN USE
   - Current site use (from geotech report)
   - Surrounding land uses and zoning context
   - Transportation access, transit proximity
   - Pedestrian/bicycle infrastructure

6. HUMAN HEALTH EFFECTS
   - Environmental conditions from geotech report (contamination, hazardous materials)
   - Seismic hazards (liquefaction potential, fault proximity per geotech)
   - Any known environmental liabilities on or adjacent to site
   - Air quality context

7. CLIMATE
   - Climate zone (ASHRAE 169-2013 or CEC climate zone)
   - Annual precipitation and temperature range from NOAA data
   - Prevailing wind direction and speed
   - Heating and cooling degree days
   - Solar resource potential`,
    }],
    usage,
  );
  ({ cleaned: pass1Html } = scrubNarration(pass1Html));
  step.complete(k2);

  // ─── [3/4] Pass 2 — Supporting documentation + compliance narrative ───────────
  const k3 = step.start("[3/4] Pass 2 — Supporting documentation + compliance narrative + checklist");

  let pass2Html = await streamCall(
    client,
    "Pass 2 (supporting docs + compliance)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

PART 1 OUTPUT (Form SS104 + Site Assessment Worksheet from Pass 1):
${pass1Html.slice(0, 20000)}

INSTRUCTIONS:
Generate PART 2 and PART 3 ONLY. Begin directly with the Part 2 heading.

PART 2 — Supporting Documentation and Compliance Narrative

SECTION A — Referenced Documents Summary
Produce a table listing every document referenced in the form SS104 submission:
| Document | Field Reference | Source | Status |
Include: Geotechnical Investigation Report (uploaded by project team), USGS Topographic Map (auto-retrieved URL), FEMA FIRM Map Panel (auto-retrieved panel number), NRCS Web Soil Survey Map (auto-retrieved URL), EPA Level III Ecoregion Map (auto-retrieved URL).

SECTION B — Compliance Narrative
Write a professional 3–5 paragraph narrative confirming:
- The site has been assessed across all seven required categories per LEED v4.1 SS Credit 1
- Key findings from each section that demonstrate comprehensive site understanding
- How the assessment will inform sustainable design decisions (stormwater, vegetation, energy, materials)
- Point determination: 1 point (SS Credit 1 is a single-point credit)
- Any items requiring project team confirmation or licensed professional review

SECTION C — Auto-Retrieved Reference Data Verification
List each web source used in Pass 1, with:
- Source name and URL accessed
- Data retrieved (summary)
- Date retrieved
- Confidence level (Confirmed / Estimated / [OWNER TO VERIFY])

PART 3 — Complete Submission Checklist
Organize into:

GROUP A — PROVIDED BY CERTIFYAI (completed by this submission):
List every document, form field, and narrative section completed automatically.

GROUP B — REQUIRED FROM PROJECT TEAM:
- Geotechnical Investigation Report (Rockridge Geotechnical, Inc. — for siteSurvey upload field)
- Any biological or habitat surveys if conducted
- Project architect/engineer confirmation of site boundary and footprint area
For each item: explain exactly what is needed, which form field it satisfies, and why it cannot be auto-generated.`,
    }],
    usage,
  );
  ({ cleaned: pass2Html } = scrubNarration(pass2Html));
  step.complete(k3);

  // ─── [3.5/4] Calculator Input Guide (if applicable) ──────────────────────────
  const k35 = step.start("[3.5/4] Calculator Input Guide (if required)");
  let calcGuide: CalcGuideResult | null = null;
  try {
    const calcSourceContent = [
      `Project: ${PROJECT_NAME}`,
      `Address: ${PROJECT_ADDRESS}`,
      `Date: ${today}`,
      "",
      "SITE ASSESSMENT PASS 1 OUTPUT:",
      pass1Html.slice(0, 15000),
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
      console.log(`  ✓ No calculator required for this credit (${calcGuide.skipReason})`);
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
