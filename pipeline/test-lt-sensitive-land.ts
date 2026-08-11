/**
 * pipeline/test-lt-sensitive-land.ts
 *
 * Live test: LT Credit 2 — Sensitive Land Protection
 * Program: LEED v4.1 BD+C New Construction
 *
 * Pipeline:
 *   1. Load XLSX credit row + pre-extract credit PDF + civil drawing (Sonnet, cached)
 *   2. Pass 1a — Claude + web search → structured JSON (FEMA, NWI, USDA, NatureServe)
 *   3. Pass 1b — TEMPLATE RENDER → full form HTML. Zero AI tokens.
 *   4. Pass 2 — Claude receives compact JSON → supporting docs + checklist
 *   5. Assemble, validate, write both HTML files
 *   6. Calculator (if required)
 *   7. Write output files
 *
 * Run: npx ts-node pipeline/test-lt-sensitive-land.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { injectTableCss, makeEditable } from "./lib/make-editable";
import { CREDIT_SUBMISSION_PROMPT } from "./prompts/credit-submission";
import { validateNoUnnecessaryCustomerRequests, applyTargetedCorrections, stripProcessNarration } from "./lib/validate-output";
import { StepLogger } from "./lib/pipeline-utils";
import { extractPdfContent, EXTRACT_PROMPTS } from "./lib/pdf-extract";
import { generateCalculatorGuide } from "./lib/calculator-guide";
import { renderLTc2Form, type SensitiveLandFormData } from "./lib/lt-sensitive-land-template";
import { generatePolicyDrafts, policyChecklistHtml } from "./lib/policy-generator";

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
const XLSX_PATH     = path.join(DESKTOP, "automation analysis files/LEED_v41_BDC_Automation_Analysis_v6.xlsx");
const PDF_PATH      = path.join(DESKTOP, "leed credit files Nov 2025 Guide /LT files /leed bd+c v4.1 - LT Credit - Sensitive Land Protection.pdf");
const DRAWING_PATH  = path.join(DESKTOP, "example drawing set/Civil008.pdf");
const OUTPUT_DIR    = path.resolve(__dirname, "output");
const SLUG          = "lt-sensitive-land-protection";
const EDITABLE_SLUG = "lt-sensitive-land-protection-editable";

const PROGRAM_NAME  = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME   = "LT Credit 2 — Sensitive Land Protection";
const CREDIT_CODE   = "LT Credit 2";
const FORM_LINK     = "https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/LT102";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) => String(r[1] ?? "").toLowerCase().includes("sensitive land"));
  if (!row) throw new Error("LT Sensitive Land Protection row not found in XLSX");
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
  let text  = "";
  let ticks = 0;

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
    } else {
      throw err;
    }
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

  // [1/7] Load source files + pre-extract PDFs
  const k1 = step.start("[1/7] Loading source files + pre-extracting PDFs");
  const creditRow = extractCreditRow();
  let extractTokens = { input: 0, output: 0 };

  const creditPdfExtract = await extractPdfContent(client, PDF_PATH, EXTRACT_PROMPTS.CREDIT_REQUIREMENTS);
  extractTokens.input  += creditPdfExtract.inputTokens;
  extractTokens.output += creditPdfExtract.outputTokens;

  const drawingExtract = await extractPdfContent(client, DRAWING_PATH, EXTRACT_PROMPTS.CIVIL_DRAWING);
  extractTokens.input  += drawingExtract.inputTokens;
  extractTokens.output += drawingExtract.outputTokens;

  console.log(`  [pdf-extract] Total extract cost: ~$${((extractTokens.input / 1e6) * 3.00 + (extractTokens.output / 1e6) * 15.00).toFixed(3)}`);
  step.complete(k1);

  const systemPrompt = CREDIT_SUBMISSION_PROMPT;

  const sharedContext = `CREDIT AUTOMATION ANALYSIS:\n${creditRow}

CREDIT REQUIREMENTS (extracted from PDF):
${creditPdfExtract.text}

CIVIL DRAWING DATA (extracted from Civil008.pdf):
${drawingExtract.text}

PROJECT TEAM DECISIONS:
- Compliance path: Option 1 (project team is NOT pursuing Option 2)
- Wetlands delineation report: NOT conducted — do not include as a required upload`;

  // [2/7] Pass 1a — structured JSON (FEMA, NWI, USDA, NatureServe)
  const k2 = step.start("[2/7] Pass 1a — Sensitive land data (Claude + web search → JSON)");
  const pass1aSystem = `You are a LEED documentation specialist. Return ONLY a valid JSON object — no markdown, no preamble, no explanation.`;
  const pass1aRaw = await streamCall(
    client,
    "Pass 1a (JSON)",
    pass1aSystem,
    [{
      type: "text",
      text: `${sharedContext}

Return a JSON object with this exact structure:
{
  "projectAddress": "full address from civil drawing",
  "compliancePath": "Option 1",
  "femaFloodZone": "Zone designation",
  "femaFirmPanel": "panel number",
  "femaFirmDate": "effective date",
  "femaFirmUrl": "direct URL to MSC result",
  "onFloodplain": false,
  "wetlandsMapped": false,
  "wetlandsDescription": "description of NWI findings",
  "nwiUrl": "direct URL to NWI mapper result",
  "primeFarmland": false,
  "farmlandDescription": "description of USDA findings",
  "soilType": "soil type name",
  "usdaUrl": "direct URL to Web Soil Survey result",
  "endangeredHabitat": false,
  "speciesDescription": "description of NatureServe findings",
  "natureserveUrl": "direct URL to NatureServe result",
  "compliant": true,
  "pointsEarned": 1,
  "narrativeSummary": "one paragraph",
  "ownerConfirmItems": []
}

SEARCH INSTRUCTIONS:
1. Use civil drawing extract to identify the project address and location.
2. Search FEMA Flood Map Service Center (msc.fema.gov) for the project's flood zone and FIRM panel.
3. Search USFWS National Wetlands Inventory (fws.gov/program/national-wetlands-inventory) for mapped wetlands.
4. Search USDA Web Soil Survey (websoilsurvey.nrcs.usda.gov) for prime farmland designation.
5. Search NatureServe Explorer (explorer.natureserve.org) for threatened/endangered species habitat.
Set onFloodplain, wetlandsMapped, primeFarmland, and endangeredHabitat based on actual search results.
Set compliant: true only if ALL four factors are clear (no floodplain, no wetlands, no prime farmland, no habitat).`,
    }],
    usage,
  );
  step.complete(k2);

  // Parse Pass 1a JSON
  let pass1aData: any = {};
  try {
    const jsonStart = pass1aRaw.indexOf("{");
    const jsonEnd   = pass1aRaw.lastIndexOf("}");
    pass1aData = JSON.parse(pass1aRaw.slice(jsonStart, jsonEnd + 1));
    console.log(`  ✓ Compliant: ${pass1aData.compliant} | Points: ${pass1aData.pointsEarned} | Flood zone: ${pass1aData.femaFloodZone}`);
  } catch {
    console.warn("  ⚠ Pass 1a JSON parse failed — using empty data");
  }

  // [3/7] Pass 1b — template render (zero AI tokens)
  const k3 = step.start("[3/7] Pass 1b — Template render (0 AI tokens)");
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const formData: SensitiveLandFormData = {
    projectAddress:      pass1aData.projectAddress      ?? "[See civil drawing]",
    projectName:         pass1aData.projectAddress      ?? "[See civil drawing]",
    certProgram:         "LEED v4.1 BD+C New Construction",
    creditName:          CREDIT_NAME,
    submissionDate:      today,
    compliancePath:      "Option 1",
    femaFloodZone:       pass1aData.femaFloodZone        ?? "",
    femaFirmPanel:       pass1aData.femaFirmPanel        ?? "",
    femaFirmDate:        pass1aData.femaFirmDate         ?? "",
    femaFirmUrl:         pass1aData.femaFirmUrl          ?? "",
    onFloodplain:        pass1aData.onFloodplain         ?? false,
    wetlandsMapped:      pass1aData.wetlandsMapped       ?? false,
    wetlandsDescription: pass1aData.wetlandsDescription  ?? "",
    nwiUrl:              pass1aData.nwiUrl               ?? "",
    primeFarmland:       pass1aData.primeFarmland        ?? false,
    farmlandDescription: pass1aData.farmlandDescription  ?? "",
    soilType:            pass1aData.soilType             ?? "",
    usdaUrl:             pass1aData.usdaUrl              ?? "",
    endangeredHabitat:   pass1aData.endangeredHabitat    ?? false,
    speciesDescription:  pass1aData.speciesDescription   ?? "",
    natureserveUrl:      pass1aData.natureserveUrl       ?? "",
    compliant:           pass1aData.compliant            ?? false,
    pointsEarned:        pass1aData.pointsEarned         ?? 0,
    pointsAvailable:     1,
    narrativeSummary:    pass1aData.narrativeSummary     ?? "",
    ownerConfirmItems:   pass1aData.ownerConfirmItems    ?? [],
  };
  const mapNote = `<p style="color:#6b7e82;font-style:italic;font-size:12px;">[Site context map — attach FEMA FIRM panel excerpt and NWI mapper screenshot as supporting documentation]</p>`;
  const pass1Html = renderLTc2Form(formData, mapNote);
  console.log(`  ✓ Template rendered (${Math.round(pass1Html.length / 1024)} KB, 0 AI tokens)`);
  step.complete(k3);

  // [4/7] Pass 2 — Supporting documentation (compact JSON — NOT Pass 1b HTML)
  const k4 = step.start("[4/7] Pass 2 — Supporting documentation (Claude + web search)");
  const pass2Html = await streamCall(
    client,
    "Pass 2 (supporting docs)",
    systemPrompt,
    [{
      type: "text",
      text: `${sharedContext}

RETRIEVED DATA (compact JSON — use directly):
${JSON.stringify(pass1aData, null, 2)}

INSTRUCTIONS:
Generate PART 2 only — Supporting Project Documentation. Begin directly with the Part 2 heading.
Include Section A: full retrieved data from each source (FEMA, NWI, USDA, NatureServe) — complete data, not summaries.
Include Section B: all Column 4 outputs per the automation analysis.
Then generate the Complete Submission Checklist (Part 3) with GROUP A and GROUP B.
Do not repeat Part 1. Do not generate a map.`,
    }],
    usage,
    64000,
  );
  step.complete(k4);

  // [5/7] Assemble and validate
  const k5 = step.start("[5/7] Assembling and validating output");
  const combined   = `${pass1Html}\n\n${pass2Html}`;
  const violations = validateNoUnnecessaryCustomerRequests(combined);
  let validated    = stripProcessNarration(combined);
  if (violations.length > 0) {
    validated = applyTargetedCorrections(validated, violations);
    const remaining = validateNoUnnecessaryCustomerRequests(validated);
    if (remaining.length > 0) console.warn(`  ⚠ ${remaining.length} violation(s) remain after targeted correction`);
  }
  step.complete(k5);

  // [6/7] Calculator Input Guide (if required)
  const k6 = step.start("[6/7] Calculator Input Guide (if required)");
  const projectData = `Credit: ${CREDIT_NAME}\nProgram: ${PROGRAM_NAME}\n${drawingExtract.text}`;
  const calcGuide   = await generateCalculatorGuide(client, creditRow, CREDIT_NAME, projectData, usage);
  step.complete(k6);

  // [7/7] Policy drafts + write output files
  const k7 = step.start("[7/7] Policy drafts + writing output files");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const policyDrafts = await generatePolicyDrafts(client, creditRow, {
    creditName:             CREDIT_NAME,
    certProgram:            PROGRAM_NAME,
    projectAddress:         pass1aData.projectAddress ?? "[See civil drawing]",
    creditRequirementsText: creditPdfExtract.text,
    creditSlug:             SLUG,
    outputDir:              OUTPUT_DIR,
  }, usage);

  const calcHtml     = calcGuide ? calcGuide.html : "";
  const withCss      = injectTableCss(validated + calcHtml + policyChecklistHtml(policyDrafts));
  const standardHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${CREDIT_NAME}</title></head><body>${withCss}</body></html>`;
  const editableHtml = makeEditable(standardHtml);

  fs.writeFileSync(path.join(OUTPUT_DIR, `${SLUG}.html`),      standardHtml);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${EDITABLE_SLUG}.html`), editableHtml);
  step.complete(k7);

  // Summary
  const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
  const inputCost = (usage.input  / 1_000_000) * 3.00;
  const outCost   = (usage.output / 1_000_000) * 15.00;
  const totalCost = (inputCost + outCost).toFixed(3);

  console.log("\n" + "═".repeat(60));
  console.log(`  Credit:  ${CREDIT_NAME}`);
  console.log(`  Elapsed: ${elapsed}s`);
  console.log(`  Total cost: $${totalCost}`);
  console.log(`  Tokens in/out: ${usage.input.toLocaleString()} / ${usage.output.toLocaleString()}`);
  if (calcGuide && !calcGuide.skipped) console.log(`  Calculator Guide: ${calcGuide.calculatorName} — ${calcGuide.fieldCount} fields`);
  console.log("─".repeat(60));
  console.log(`  Output: ${OUTPUT_DIR}/`);
  console.log(`    ${SLUG}.html`);
  console.log(`    ${EDITABLE_SLUG}.html`);
  policyDrafts.forEach((d) => console.log(`    ${d.filename}  [policy draft]`));
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message ?? err);
  process.exit(1);
});
