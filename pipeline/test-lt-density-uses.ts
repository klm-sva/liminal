/**
 * pipeline/test-lt-density-uses.ts
 *
 * Live test: LT Credit 4 — Surrounding Density and Diverse Uses
 * Program: LEED v4.1 BD+C New Construction
 *
 * Pipeline:
 *   1. Load XLSX credit row + geocode + pre-extract credit PDF (Sonnet, cached)
 *   2. Pass 1a — Claude + web search → structured JSON only
 *   3. Map generation — walking routes to all diverse uses (Google Maps Static API)
 *   4. Pass 1b — TEMPLATE RENDER → full form HTML. Zero AI tokens.
 *   5. Pass 2 — Claude receives compact JSON → supporting docs + checklist
 *   6. Assemble, validate, embed map
 *   7. Write output files
 *
 * Run: npx ts-node pipeline/test-lt-density-uses.ts [address]
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
import { axiosGetWithRetry } from "./lib/pipeline-utils";
import { generateMap, type MapResult } from "./map-generation";
import { renderLTc4Form, type LTc4FormData } from "./lib/lt-density-uses-template";
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
const XLSX_PATH     = path.resolve(__dirname, "reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");
const FORM_SCHEMA_PATH = path.resolve(__dirname, "reference/leed/leed_v41_form_schemas.json");
const PDF_PATH      = path.join(DESKTOP, "leed credit files Nov 2025 Guide /LT files /leed bd+c v4.1 - LT Credit - Surrounding Density and Diverse Uses.pdf");
const OUTPUT_DIR    = path.resolve(__dirname, "output");
const SLUG          = "lt-surrounding-density-diverse-uses";
const EDITABLE_SLUG = "lt-surrounding-density-diverse-uses-editable";

const PROJECT_ADDRESS = process.argv[2] ?? "1701 Wynkoop Street, Denver CO 80202";
const PROGRAM_NAME    = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME     = "LT Credit 4 — Surrounding Density and Diverse Uses";
const CREDIT_CODE     = "LT Credit 4";
const FORM_LINK       = "https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/LT104";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) => String(r[1] ?? "").toLowerCase().includes("surrounding density"));
  if (!row) throw new Error("LT Surrounding Density row not found in XLSX");
  const lines = [`Credit Automation Analysis — ${row[0]}: ${row[1]}`];
  for (let i = 2; i < hdrs.length; i++) {
    const v = row[i];
    if (v !== undefined && v !== "") lines.push(`  ${hdrs[i]}: ${String(v).replace(/\n/g, " | ").trim()}`);
  }
  return lines.join("\n");
}

// ─── Geocode ──────────────────────────────────────────────────────────────────

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const res = await axiosGetWithRetry(
        "https://maps.googleapis.com/maps/api/geocode/json",
        { params: { address, key } },
        10000, `Geocoding (Google): ${address}`,
      );
      if (res.data.status === "OK" && res.data.results?.length) {
        const loc = res.data.results[0].geometry.location;
        console.log(`  ✓ Geocoded via Google Maps`);
        return { lat: loc.lat, lon: loc.lng };
      }
    } catch { /* fall through */ }
  }
  const res = await axiosGetWithRetry(
    "https://nominatim.openstreetmap.org/search",
    { params: { q: address, format: "json", limit: 1 }, headers: { "User-Agent": "Liminal/1.0 (klmullen@hotmail.com)" } },
    10000, `Geocoding (Nominatim): ${address}`,
  );
  const results = res.data as Array<{ lat: string; lon: string }>;
  if (!results?.length) throw new Error(`Geocoding failed for "${address}"`);
  console.log(`  ✓ Geocoded via Nominatim (OSM)`);
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const t0     = Date.now();
  const usage  = { input: 0, output: 0 };
  const step   = new StepLogger();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`\nProject address: ${PROJECT_ADDRESS}`);

  // [1/6] Load + geocode + pre-extract PDF
  const k1 = step.start("[1/7] Loading source files + geocoding + pre-extracting credit PDF");
  const creditRow = extractCreditRow();

  const coords = await geocodeAddress(PROJECT_ADDRESS);
  console.log(`  ✓ Coordinates: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);

  const creditPdfExtract = await extractPdfContent(client, PDF_PATH, EXTRACT_PROMPTS.CREDIT_REQUIREMENTS);
  usage.input  += creditPdfExtract.inputTokens;
  usage.output += creditPdfExtract.outputTokens;
  step.complete(k1);

  const systemPrompt = CREDIT_SUBMISSION_PROMPT;

  // Note on missing civil drawing — what would normally be provided
  const missingDrawingNote = `CIVIL SITE PLAN STATUS:
No civil drawing was provided for this run. The following information would normally come from the customer's civil site plan:
  - Site boundary polygon and total site area (acres)
  - Building footprint area (sq ft / gross floor area)
  - Main entrance location and address
  - Project use type (office, residential, mixed-use, etc.)
  - Number of dwelling units (if residential component)

For this test, use the project address (${PROJECT_ADDRESS}) and web search to estimate:
  - Parcel boundary and area from county assessor records or Google Maps
  - Building type and gross floor area from public permit records or assessor data
  - These values should be flagged as [OWNER TO CONFIRM: verify from civil drawings] in the output`;

  // GBCI Accepted Verification spec — overrides whatever is in the XLSX column.
  // Update this when the v8 spreadsheet is uploaded; for now the exact spec is hardcoded.
  const GBCI_VERIFICATION_SPEC = `GBCI Accepted Verification — Exact Deliverable Specification:
LEED Online Form LT104 — Completed form with: (1) selected option (Option 1: Surrounding Density, Option 2: Diverse Uses, or both); (2) for Option 1: ¼-mile (400m) offset boundary description, total buildable land area within boundary (acres), combined density in sq ft of building per acre of buildable land, residential density (DU/acre), nonresidential FAR, and points determination per Table 1a; map generated showing project boundary, ¼-mile offset, and parcels within boundary with building footprints identified — map must show scale bar, north arrow, project main entrance, and boundary measurements; (3) for Option 2: table listing each qualifying use by category (per Appendix 1 use types), use name, address, walking distance in feet/meters from main entrance to use entrance measured along actual pedestrian routes (not straight-line), and use category; map showing project main entrance with ½-mile walking distance along walking route shown for each qualifying use plotted with label — map must include scale bar, north arrow, street network, and walking route from entrance to each use; points per Table 2 based on number and category diversity of uses. All data auto-retrieved from U.S. Census, Google Places API, and OpenStreetMap; walking distances calculated along pedestrian network.`;

  // Load LT Credit 4 form schema from reference database
  let formSchemaBlock = "";
  try {
    const allSchemas = JSON.parse(fs.readFileSync(FORM_SCHEMA_PATH, "utf-8"));
    const ltc4Schema = allSchemas.credits?.["LT Credit 4"];
    if (ltc4Schema?.fields?.all?.length) {
      formSchemaBlock = `\nLEED ONLINE FORM FIELD SCHEMA — LT Credit 4 (use these exact field IDs and labels, never training data):\n${JSON.stringify(ltc4Schema.fields.all, null, 2)}`;
      console.log(`  ✓ Form schema loaded — ${ltc4Schema.fields.all.length} fields`);
    }
  } catch (err) {
    console.warn(`  ⚠ Form schema load failed: ${(err as Error).message}`);
  }

  const sharedContext = `CREDIT REQUIREMENTS (extracted from PDF):
${creditPdfExtract.text}

CREDIT AUTOMATION ANALYSIS:
${creditRow}

GBCI VERIFICATION SPEC (AUTHORITATIVE — use this over any column in the spreadsheet above):
${GBCI_VERIFICATION_SPEC}
${formSchemaBlock}

PROJECT ADDRESS: ${PROJECT_ADDRESS}
COORDINATES: ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}

${missingDrawingNote}`;

  // [2/7] Pass 1a — structured JSON: diverse uses + density data
  const k2 = step.start("[2/7] Pass 1a — Diverse uses + density data (Claude + web search → JSON)");
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
  "projectAddress": "full address",
  "projectUseType": "office|residential|mixed-use|etc",
  "grossFloorAreaSqFt": 0,
  "dwellingUnits": 0,
  "pursueOption1": false,
  "pursueOption2": false,
  "pursueOption3": false,
  "censusTract": "tract ID",
  "residentialDensityDuAcre": 0.0,
  "nonResidentialFAR": 0.0,
  "combinedDensitySqFtAcre": 0.0,
  "buildableLandAcres": 0.0,
  "pointsOption1": 0,
  "diverseUses": [
    {
      "name": "Business Name",
      "address": "full street address",
      "category": "restaurant|retail|service|civic|park|school|etc",
      "walkingDistanceFeet": 0,
      "walkingDistanceMiles": 0.0,
      "qualifiesOption2": true
    }
  ],
  "pointsOption2": 0,
  "walkScore": 0,
  "walkScoreSource": "walkscore.com",
  "pointsOption3": 0,
  "pointsEarned": 0,
  "narrativeSummary": "one paragraph"
}

SEARCH INSTRUCTIONS:
1. Evaluate all three options and set pursueOption1/2/3 to true for the option(s) that earn the most points.
2. Option 1 — Surrounding Density: search US Census Bureau for residential density (DU/acre) and non-residential FAR. Determine points from Table 1a.
3. Option 2 — Diverse Uses: search exhaustively for ALL qualifying uses within ½-mile walking distance. Determine points from Table 2.
4. Option 3 — Walkable Location: search walkscore.com or Walk Score API for the Walk Score of ${PROJECT_ADDRESS}. Determine points from Table 3.
5. Set pursueOption3: true if Option 3 yields the highest points. Multiple options may be pursued simultaneously if each earns additional points.
6. Set pointsEarned to the total points earned across all pursued options.`,
    }],
    usage,
  );
  step.complete(k2);

  // Parse Pass 1a JSON
  let diverseUses: Array<{ name: string; address: string; walkingDistanceFeet: number; walkingDistanceMiles: number; qualifiesOption2: boolean }> = [];
  let pass1aData: any = {};
  try {
    const jsonStart = pass1aRaw.indexOf("{");
    const jsonEnd   = pass1aRaw.lastIndexOf("}");
    pass1aData  = JSON.parse(pass1aRaw.slice(jsonStart, jsonEnd + 1));
    diverseUses = pass1aData.diverseUses ?? [];
    // pointsEarned may be a number or {option1, option2} object depending on which options Claude returns
    const optionsSummary = [
      pass1aData.pursueOption1 ? `Opt1:${pass1aData.pointsOption1 ?? 0}pt` : null,
      pass1aData.pursueOption2 ? `Opt2:${pass1aData.pointsOption2 ?? 0}pt (${diverseUses.length} uses)` : null,
      pass1aData.pursueOption3 ? `Opt3:${pass1aData.pointsOption3 ?? 0}pt (WalkScore:${pass1aData.walkScore ?? "?"})` : null,
    ].filter(Boolean).join("  ");
    console.log(`  ✓ ${optionsSummary || "no options determined"}  →  ${pass1aData.pointsEarned ?? "—"} pt(s) total`);
  } catch {
    console.warn("  ⚠ Pass 1a JSON parse failed — map will be skipped");
  }

  // [3/7] Map generation — walking routes to all diverse uses
  const k3 = step.start("[3/7] Map generation — walking routes to diverse uses (Google Maps)");
  let mapResult: MapResult | null = null;
  let mapHtml = `<p style="color:#6b7e82;font-style:italic;font-size:12px;">[Map could not be generated — no qualifying uses returned]</p>`;

  if (diverseUses.length > 0) {
    try {
      const destinations = diverseUses.slice(0, 20).map((u, i) => ({
        address: u.address,
        label:   String(i + 1),
      }));
      mapResult = await generateMap({
        originAddress: PROJECT_ADDRESS,
        destinations,
        mapType:       "surrounding-density",
        outputPath:    path.join(OUTPUT_DIR, `${SLUG}-map.png`),
      });
      const mapB64 = mapResult.pngBuffer.toString("base64");
      mapHtml = `<img src="data:image/png;base64,${mapB64}" alt="Diverse uses walking distance map"
        style="width:100%;max-width:1200px;border:1px solid #dee2e6;border-radius:4px;" />`;
      console.log(`  ✓ Map generated — ${mapResult.routes.length} routes rendered`);
    } catch (err) {
      console.warn(`  ⚠ Map generation failed: ${(err as Error).message}`);
    }
  }
  step.complete(k3);

  // [4/7] Pass 1b — TEMPLATE RENDER (zero AI tokens)
  const k4 = step.start("[4/7] Pass 1b — Template render (0 AI tokens)");
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const formData: LTc4FormData = {
    projectAddress:           PROJECT_ADDRESS,
    projectUseType:           pass1aData.projectUseType           ?? "—",
    grossFloorAreaSqFt:       pass1aData.grossFloorAreaSqFt       ?? 0,
    dwellingUnits:            pass1aData.dwellingUnits             ?? 0,
    submissionDate:           today,
    certProgram:              "LEED v4.1 BD+C New Construction",
    creditName:               CREDIT_NAME,
    pursueOption1:            pass1aData.pursueOption1             ?? false,
    pursueOption2:            pass1aData.pursueOption2             ?? false,
    pursueOption3:            pass1aData.pursueOption3             ?? false,
    censusTract:              pass1aData.censusTract               ?? "",
    residentialDensityDuAcre: pass1aData.residentialDensityDuAcre ?? 0,
    nonResidentialFAR:        pass1aData.nonResidentialFAR         ?? 0,
    combinedDensitySqFtAcre:  pass1aData.combinedDensitySqFtAcre  ?? 0,
    buildableLandAcres:       pass1aData.buildableLandAcres        ?? 0,
    pointsOption1:            pass1aData.pointsOption1             ?? 0,
    diverseUses:              (pass1aData.diverseUses ?? []).map((u: any) => ({
      name:                 u.name                 ?? "",
      address:              u.address              ?? "",
      category:             u.category             ?? "",
      walkingDistanceFeet:  u.walkingDistanceFeet  ?? 0,
      walkingDistanceMiles: u.walkingDistanceMiles ?? 0,
      qualifiesOption2:     u.qualifiesOption2     ?? false,
    })),
    pointsOption2:   pass1aData.pointsOption2  ?? 0,
    walkScore:       pass1aData.walkScore       ?? 0,
    walkScoreSource: pass1aData.walkScoreSource ?? "walkscore.com",
    pointsOption3:   pass1aData.pointsOption3   ?? 0,
    pointsEarned:    pass1aData.pointsEarned    ?? 0,
    pointsAvailable: 5,
    narrativeSummary:  pass1aData.narrativeSummary  ?? "",
    ownerConfirmItems: pass1aData.ownerConfirmItems ?? [],
  };
  const pass1Html = renderLTc4Form(formData, mapHtml);
  console.log(`  ✓ Template rendered (${Math.round(pass1Html.length / 1024)} KB, 0 AI tokens)`);
  step.complete(k4);

  // [5/7] Pass 2 — Supporting documentation (compact JSON context — NOT Pass 1b HTML)
  const k5 = step.start("[5/7] Pass 2 — Supporting documentation (Claude + web search)");
  const pass2Html = await streamCall(
    client,
    "Pass 2 (supporting docs)",
    systemPrompt,
    [{
      type: "text",
      text: `${sharedContext}

RETRIEVED DATA (compact JSON — use directly, do not re-search):
${JSON.stringify(pass1aData, null, 2)}

INSTRUCTIONS:
Generate PART 2 only — Supporting Project Documentation. Begin directly with the Part 2 heading.
Include Section A (Census density data in full, complete diverse uses inventory with addresses and walking distances) and Section B (all Column 4 outputs per the GBCI verification spec).
Then generate the Complete Submission Checklist (Part 3) with GROUP A and GROUP B.
Do not repeat or reference Part 1. Do not generate a map.`,
    }],
    usage,
    64000,
  );
  step.complete(k5);

  // [6/7] Assemble + validate
  const k6 = step.start("[6/7] Assembling and validating output");
  const combined   = `${pass1Html}\n\n${pass2Html}`;
  const violations = validateNoUnnecessaryCustomerRequests(combined);
  let validated    = stripProcessNarration(combined);
  if (violations.length > 0) {
    validated = applyTargetedCorrections(validated, violations);
    const remaining = validateNoUnnecessaryCustomerRequests(validated);
    if (remaining.length > 0) console.warn(`  ⚠ ${remaining.length} violation(s) remain after correction`);
  }
  // Embed the real map
  validated = validated.replace(/<!--\s*WALKING_DISTANCE_MAP\s*-->/g, mapHtml);
  step.complete(k6);

  // [7/7] Policy drafts + write output files
  const k7 = step.start("[7/7] Policy drafts + writing output files");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const policyDrafts = await generatePolicyDrafts(client, creditRow, {
    creditName:             CREDIT_NAME,
    certProgram:            PROGRAM_NAME,
    projectAddress:         PROJECT_ADDRESS,
    creditRequirementsText: creditPdfExtract.text,
    creditSlug:             SLUG,
    outputDir:              OUTPUT_DIR,
  }, usage);

  const withCss      = injectTableCss(validated + policyChecklistHtml(policyDrafts));
  const standardHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${CREDIT_NAME}</title></head><body>${withCss}</body></html>`;
  const editableHtml = makeEditable(standardHtml);

  fs.writeFileSync(path.join(OUTPUT_DIR, `${SLUG}.html`),      standardHtml);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${EDITABLE_SLUG}.html`), editableHtml);
  step.complete(k7);

  // Summary
  const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
  const totalCost = ((usage.input / 1e6) * 3.00 + (usage.output / 1e6) * 15.00).toFixed(3);

  console.log("\n" + "═".repeat(60));
  console.log(`  Credit:  ${CREDIT_NAME}`);
  console.log(`  Address: ${PROJECT_ADDRESS}`);
  console.log(`  Elapsed: ${elapsed}s`);
  console.log(`  Total cost: $${totalCost}`);
  console.log(`  Tokens in/out: ${usage.input.toLocaleString()} / ${usage.output.toLocaleString()}`);
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
