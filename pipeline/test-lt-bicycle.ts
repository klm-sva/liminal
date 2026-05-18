/**
 * pipeline/test-lt-bicycle.ts
 *
 * Live test: LT Credit 6 — Bicycle Facilities
 * Program: LEED v4.1 BD+C New Construction
 *
 * Pipeline:
 *   1. Load XLSX credit row + geocode + pre-extract drawings (Civil006, Rinker_009)
 *   2. Pass 1a — Claude reads drawings + web search → structured JSON
 *      (storage locations, occupancy, showers from drawings; OSM network + Google Places destinations)
 *   3. Bicycling distance measurement — Google Maps Directions API (mode: bicycling)
 *   4. Map generation — bicycle routes to qualifying destinations
 *   5. Pass 1b — TEMPLATE RENDER → full form HTML. Zero AI tokens.
 *   6. Pass 2 — Claude receives compact JSON → supporting docs + checklist
 *   7. Assemble, validate, write output files
 *
 * Run: npx ts-node pipeline/test-lt-bicycle.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { injectTableCss, makeEditable } from "./lib/make-editable";
import { CREDIT_SUBMISSION_PROMPT } from "./prompts/credit-submission";
import { validateNoUnnecessaryCustomerRequests, applyTargetedCorrections, stripProcessNarration } from "./lib/validate-output";
import { StepLogger } from "./lib/pipeline-utils";
import { axiosGetWithRetry } from "./lib/pipeline-utils";
import { extractPdfContent, EXTRACT_PROMPTS } from "./lib/pdf-extract";
import { generateMap, measureBicyclingDistances, type MapResult } from "./map-generation";
import { renderLTc6Form, type LTc6FormData, type BicycleDestination } from "./lib/lt-bicycle-template";
import { generatePolicyDrafts, policyChecklistHtml } from "./lib/policy-generator";
import { renderPdfToTiles } from "./lib/pdf-extract";
import { locateFeaturesOnPage, annotateDrawing, type AnnotationFeature } from "./lib/drawing-annotator";

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

const DESKTOP        = "/Users/kelsey/Desktop/program automation ";
const XLSX_PATH      = path.join(DESKTOP, "automation analysis files/LEED_v41_BDC_Automation_Analysis_v6.xlsx");
const CIVIL_PATH     = path.join(DESKTOP, "example drawing set/Civil006.pdf");
const ARCH_PATH      = path.join(DESKTOP, "example drawing set/Rinker_009.pdf");
const OUTPUT_DIR     = path.resolve(__dirname, "output");
const SLUG           = "lt-bicycle-facilities";
const EDITABLE_SLUG  = "lt-bicycle-facilities-editable";

const PROJECT_ADDRESS = process.argv[2] ?? "304 Newell Drive, Gainesville, FL 32611";
const PROGRAM_NAME    = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME     = "LT Credit 6 — Bicycle Facilities";
const CREDIT_CODE     = "LT Credit 6";
const FORM_LINK       = "https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/LT108";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) => String(r[1] ?? "").toLowerCase().includes("bicycle"));
  if (!row) throw new Error("LT Bicycle Facilities row not found in XLSX");
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
        { params: { address, key } }, 10000, `Geocoding: ${address}`,
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

// ─── JSON extractor ───────────────────────────────────────────────────────────

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) return text.trim();
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc)                  { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true;  continue; }
    if (ch === '"')           { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text.slice(start).trim();
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
      console.warn("\n  ⚠ Rate-limited — waiting 60s...");
      await new Promise((r) => setTimeout(r, 60000));
      return streamCall(client, label, systemPrompt, userContent, usage, maxTokens);
    }
    throw err;
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
  console.log("═".repeat(60));
  console.log(` ${CREDIT_NAME}`);
  console.log(` ${PROGRAM_NAME}`);
  console.log("═".repeat(60));

  // [1/7] Load source files
  const k1 = step.start("[1/7] Loading source files + geocoding + pre-extracting drawings");

  // Try extracting credit row from XLSX (may fail if v6 has no bicycle row — fall back to hardcoded)
  let creditRow = "";
  try {
    creditRow = extractCreditRow();
    console.log(`  ✓ Credit row loaded from XLSX`);
  } catch {
    console.warn("  ⚠ Bicycle row not found in XLSX — using hardcoded credit row");
    creditRow = `Credit Automation Analysis — LT Credit 6: Bicycle Facilities
  Project Team Must Upload: Civil site plan showing bicycle storage locations and distances from entries (drawing set); architectural floor plans showing shower and changing room locations (drawing set); plumbing fixture schedule with shower count (drawing set); building occupancy data (entered at registration); for historic urban context: narrative identifying historic routes by type
  Claude Auto-Retrieves: OpenStreetMap cycling network within 3-mile radius with classifications; Google Places API diverse uses within 3-mile biking distance (name, category, address, biking distance); transit stations within 3-mile biking distance; biking distances along bicycle network; walking distances from bicycle storage to functional entries; distance from short-term storage to main entrance (must be ≤200 ft) and long-term to functional entry (≤300 ft)
  Outputs: Completed LEED Online Form LT108: (1) bicycle network connectivity — network description, qualifying destinations table, annotated map; (2) bicycle storage calculation table; (3) shower/changing facility calculation`;
  }

  const coords = await geocodeAddress(PROJECT_ADDRESS);
  console.log(`  ✓ Coordinates: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);

  const civilExtract = await extractPdfContent(client, CIVIL_PATH, `Extract all of the following from this civil site plan:
- Project name and address (full street address, city, state, zip)
- All bicycle storage locations (rack types, quantities, precise locations relative to building entries)
- Distance from each bicycle storage location to the nearest functional building entry (in feet)
- Site boundary description
- Any bicycle network connections or paths shown on the site plan
Output as structured plain text.`, "tiled-image");
  usage.input  += civilExtract.inputTokens;
  usage.output += civilExtract.outputTokens;

  const archExtract = await extractPdfContent(client, ARCH_PATH, `Extract all of the following from this architectural floor plan:
- Project name and address
- All shower and changing room locations (floor level, room number or designation, quantity)
- Total number of showers provided
- Building occupancy classification and regular occupant count if noted
- Any plumbing fixture schedule information visible on this sheet
Output as structured plain text.`, "tiled-image");
  usage.input  += archExtract.inputTokens;
  usage.output += archExtract.outputTokens;

  step.complete(k1);

  const GBCI_VERIFICATION_SPEC = `GBCI Accepted Verification — Exact Deliverable Specification:
LEED Online Form LT108 — Completed form with: (1) bicycle network connectivity confirmation: description of bicycle network within 200 yards (180m) of functional entry or storage, destinations served (list of ≥10 diverse uses per Appendix 1 within 3-mile biking distance — distance is on biking route — or school/employment center if ≥50% residential, or BRT/rail/ferry terminal), each destination name and biking distance in miles from project boundary; map showing project boundary, functional entries, bicycle storage locations, full bicycle network within 3-mile radius with all qualifying destinations labeled and biking distances noted, 200-yard walking distance along a walking path from entry/storage to network connection, scale bar, north arrow; (2) bicycle storage calculation: total peak visitors, long-term storage spaces provided (≥5% of regular occupants, min 4), short-term spaces provided (≥2.5% of peak visitors, min 4), storage location descriptions confirming short-term within 200 ft of main entrance and long-term within 300 ft of functional entry; (3) shower/changing facility calculation: total regular occupants, number of showers required per formula, number provided, and location confirmation. Bicycle network data auto-retrieved from OpenStreetMap; destinations auto-verified from Google Places API.
NOTES: Historic urban context narrative must identify routes by type — customer must provide this narrative if pursuing that path.
FORM LINK: ${FORM_LINK}`;

  const systemPrompt = CREDIT_SUBMISSION_PROMPT;

  const sharedContext = `CREDIT AUTOMATION ANALYSIS:
${creditRow}

GBCI VERIFICATION SPEC (AUTHORITATIVE — use this over any column in the spreadsheet above):
${GBCI_VERIFICATION_SPEC}

CIVIL SITE PLAN DATA (extracted from Civil006.pdf):
${civilExtract.text}

ARCHITECTURAL FLOOR PLAN DATA (extracted from Rinker_009.pdf):
${archExtract.text}

PROJECT ADDRESS: ${PROJECT_ADDRESS}
COORDINATES: ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;

  // [2/7] Pass 1a — structured JSON
  const k2 = step.start("[2/7] Pass 1a — Drawing analysis + bicycle network + destinations (Claude + web search → JSON)");
  const pass1aSystem = `You are a LEED documentation specialist. Return ONLY a valid JSON object — no markdown, no preamble, no explanation.`;
  const pass1aRaw = await streamCall(
    client,
    "Pass 1a (JSON)",
    pass1aSystem,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
1. Use the civil site plan data above to identify bicycle storage locations, counts, and distances to entries.
2. Use the architectural floor plan data above to identify shower and changing room locations and counts.
3. Use web search to find: OpenStreetMap bicycle network within 200 yards of the project; diverse uses within 3-mile biking distance (restaurants, retail, services, civic uses, parks, schools per LEED Appendix 1); transit stations within 3-mile biking distance.
4. If the project address is not confirmed on the drawings, search for the campus address that matches a Rinker Hall building at a university.
5. Biking distances must be along the bicycle network, not straight-line.

Return a JSON object with this exact structure:
{
  "projectAddress": "confirmed full address",
  "projectName": "building name from drawings",
  "regularOccupants": 0,
  "peakVisitors": 0,
  "networkDescription": "description of bicycle network type and street name within 200 yards",
  "networkWithin200Yards": true,
  "compliancePath": "diverse-uses",
  "destinations": [
    {
      "name": "Business or Place Name",
      "category": "Appendix 1 category (e.g. restaurant, retail, park, etc.)",
      "address": "full street address",
      "bikingDistanceMiles": 0.0,
      "qualifies": true
    }
  ],
  "totalQualifyingDest": 0,
  "longTermRequired": 0,
  "longTermProvided": 0,
  "longTermLocation": "description from civil drawing",
  "longTermDrawingRef": "sheet/detail reference",
  "longTermDistanceFt": 0,
  "shortTermRequired": 0,
  "shortTermProvided": 0,
  "shortTermLocation": "description from civil drawing",
  "shortTermDrawingRef": "sheet/detail reference",
  "shortTermDistanceFt": 0,
  "showersRequired": 0,
  "showersProvided": 0,
  "showerLocation": "description from architectural drawing",
  "showerDrawingRef": "sheet/room reference",
  "compliant": true,
  "pointsEarned": 1,
  "pointsAvailable": 1,
  "narrativeSummary": "2-3 sentence summary",
  "ownerConfirmItems": ["list any items requiring owner confirmation"]
}`,
    }],
    usage,
    8000,
  );
  step.complete(k2);

  let pass1aData: any = {};
  try {
    pass1aData = JSON.parse(extractJsonObject(pass1aRaw));
    // Update address from drawing data if Claude confirmed it
    const confirmedAddress = pass1aData.projectAddress ?? PROJECT_ADDRESS;
    console.log(`  ✓ Address confirmed: ${confirmedAddress}`);
    console.log(`  ✓ Occupants: ${pass1aData.regularOccupants} regular, ${pass1aData.peakVisitors} peak visitors`);
    console.log(`  ✓ Destinations found: ${(pass1aData.destinations ?? []).length} (${pass1aData.totalQualifyingDest} qualifying)`);
    console.log(`  ✓ Storage: LT ${pass1aData.longTermProvided} (req ${pass1aData.longTermRequired}) / ST ${pass1aData.shortTermProvided} (req ${pass1aData.shortTermRequired})`);
    console.log(`  ✓ Showers: ${pass1aData.showersProvided} provided (req ${pass1aData.showersRequired})`);
  } catch {
    console.warn("  ⚠ Pass 1a JSON parse failed — using empty data");
  }

  const resolvedAddress = pass1aData.projectAddress ?? PROJECT_ADDRESS;

  // [3/7] Bicycling distance measurement
  const k3 = step.start("[3/7] Bicycling distance measurement — Google Maps (mode: bicycling)");
  const destinations: BicycleDestination[] = (pass1aData.destinations ?? []).map((d: any) => ({
    name:                d.name              ?? "",
    category:            d.category          ?? "",
    address:             d.address           ?? "",
    bikingDistanceMiles: d.bikingDistanceMiles ?? 0,
    qualifies:           d.qualifies          ?? false,
  }));

  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (mapsKey && destinations.length > 0) {
    try {
      const candidates = destinations.slice(0, 15);
      const routes = await measureBicyclingDistances(
        resolvedAddress,
        candidates.map((d, i) => ({ address: d.address, label: String(i + 1) })),
      );
      routes.forEach((r) => {
        const idx = parseInt(r.destination.label, 10) - 1;
        if (idx >= 0 && idx < candidates.length) {
          candidates[idx].bikingDistanceMiles = r.distanceMiles;
          candidates[idx].qualifies = r.distanceMiles <= 3.0;
        }
      });
      console.log(`  ✓ ${routes.length} bicycling distances measured via Google Maps`);
    } catch (err) {
      console.warn(`  ⚠ Bicycling distance measurement failed: ${(err as Error).message}`);
    }
  } else {
    console.log("  ⚠ GOOGLE_MAPS_API_KEY not set or no destinations — using Pass 1a estimates");
  }
  step.complete(k3);

  // [4/7] Map generation — bicycle routes to qualifying destinations
  const k4 = step.start("[4/7] Map generation — bicycle routes (Google Maps)");
  let mapHtml = `<p style="color:#6b7e82;font-style:italic;font-size:12px;">[Bicycle network map — add GOOGLE_MAPS_API_KEY to enable map generation]</p>`;

  const qualifyingDest = destinations.filter((d) => d.qualifies);
  if (mapsKey && qualifyingDest.length > 0) {
    try {
      const mapResult: MapResult = await generateMap({
        originAddress: resolvedAddress,
        destinations:  qualifyingDest.slice(0, 12).map((d, i) => ({ address: d.address, label: String(i + 1) })),
        mapType:       "bicycle-facilities",
        outputPath:    path.join(OUTPUT_DIR, `${SLUG}-map.png`),
      });
      const mapB64 = mapResult.pngBuffer.toString("base64");
      mapHtml = `<img src="data:image/png;base64,${mapB64}" alt="Bicycle facilities map — ${resolvedAddress}"
        style="width:100%;max-width:1200px;border:1px solid #dee2e6;border-radius:4px;" />`;
      console.log(`  ✓ Map generated — ${mapResult.routes.length} bicycle routes rendered`);
    } catch (err) {
      console.warn(`  ⚠ Map generation failed: ${(err as Error).message}`);
    }
  } else {
    console.log("  ⚠ Skipping map — no API key or no qualifying destinations");
  }
  step.complete(k4);

  // [5/7] Pass 1b — template render (zero AI tokens)
  const k5 = step.start("[5/7] Pass 1b — Template render (0 AI tokens)");
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const formData: LTc6FormData = {
    projectAddress:    resolvedAddress,
    projectName:       pass1aData.projectName      ?? "",
    certProgram:       PROGRAM_NAME,
    creditName:        CREDIT_NAME,
    submissionDate:    today,
    networkDescription:    pass1aData.networkDescription    ?? "",
    networkWithin200Yards: pass1aData.networkWithin200Yards ?? false,
    destinations,
    totalQualifyingDest:   pass1aData.totalQualifyingDest   ?? qualifyingDest.length,
    compliancePath:        pass1aData.compliancePath        ?? "diverse-uses",
    regularOccupants:      pass1aData.regularOccupants      ?? 0,
    peakVisitors:          pass1aData.peakVisitors          ?? 0,
    longTermRequired:      pass1aData.longTermRequired      ?? 0,
    longTermProvided:      pass1aData.longTermProvided      ?? 0,
    longTermLocation:      pass1aData.longTermLocation      ?? "",
    longTermDrawingRef:    pass1aData.longTermDrawingRef    ?? "",
    longTermDistanceFt:    pass1aData.longTermDistanceFt    ?? 0,
    shortTermRequired:     pass1aData.shortTermRequired     ?? 0,
    shortTermProvided:     pass1aData.shortTermProvided     ?? 0,
    shortTermLocation:     pass1aData.shortTermLocation     ?? "",
    shortTermDrawingRef:   pass1aData.shortTermDrawingRef   ?? "",
    shortTermDistanceFt:   pass1aData.shortTermDistanceFt   ?? 0,
    showersRequired:       pass1aData.showersRequired       ?? 0,
    showersProvided:       pass1aData.showersProvided       ?? 0,
    showerLocation:        pass1aData.showerLocation        ?? "",
    showerDrawingRef:      pass1aData.showerDrawingRef      ?? "",
    compliant:             pass1aData.compliant             ?? false,
    pointsEarned:          pass1aData.pointsEarned          ?? 0,
    pointsAvailable:       1,
    narrativeSummary:      pass1aData.narrativeSummary      ?? "",
    ownerConfirmItems:     pass1aData.ownerConfirmItems     ?? [],
  };

  const pass1Html = renderLTc6Form(formData, mapHtml);
  console.log(`  ✓ Template rendered (${Math.round(pass1Html.length / 1024)} KB, 0 AI tokens)`);
  step.complete(k5);

  // [6/7] Pass 2 — Supporting documentation
  const k6 = step.start("[6/7] Pass 2 — Supporting documentation (Claude + web search)");
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
Include:
  Section A: Full bicycle network data — OSM network description, classification of routes within 3-mile radius, network connectivity to project.
  Section B: Complete destination inventory — all destinations found with biking distances, Appendix 1 category, address, compliance status.
  Section C: Drawing data summary — storage dimensions and locations from civil drawing, shower locations from architectural drawing.
  Section D: All Column 4 outputs per the GBCI verification spec.
Then generate the Complete Submission Checklist (Part 3) with GROUP A (project team provides) and GROUP B (Claude auto-retrieves).
Do not repeat or reference Part 1. Do not generate a map.`,
    }],
    usage,
    64000,
  );
  step.complete(k6);

  // [7/7] Policy drafts + assemble + validate + write
  const k7 = step.start("[7/7] Policy drafts + assembling + validating + writing output files");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const combined   = `${pass1Html}\n\n${pass2Html}`;
  const violations = validateNoUnnecessaryCustomerRequests(combined);
  let validated    = stripProcessNarration(combined);
  if (violations.length > 0) {
    validated = applyTargetedCorrections(validated, violations);
    const remaining = validateNoUnnecessaryCustomerRequests(validated);
    if (remaining.length > 0) console.warn(`  ⚠ ${remaining.length} violation(s) remain after correction`);
  }

  const policyDrafts = await generatePolicyDrafts(client, creditRow, {
    creditName:             CREDIT_NAME,
    certProgram:            PROGRAM_NAME,
    projectAddress:         resolvedAddress,
    creditRequirementsText: `${civilExtract.text}\n\n${archExtract.text}`,
    creditSlug:             SLUG,
    outputDir:              OUTPUT_DIR,
  }, usage);

  const withCss      = injectTableCss(validated + policyChecklistHtml(policyDrafts));
  const standardHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${CREDIT_NAME}</title></head><body>${withCss}</body></html>`;
  const editableHtml = makeEditable(standardHtml);

  fs.writeFileSync(path.join(OUTPUT_DIR, `${SLUG}.html`),          standardHtml);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${EDITABLE_SLUG}.html`), editableHtml);
  step.complete(k7);

  // [annotated site plan] ─────────────────────────────────────────────────────
  // Generate annotated civil drawing showing bicycle storage locations.
  // Tile 2 (index 2, bottom-left) is where racks were found on Civil006.pdf.
  // A coordinate-query pass locates the exact position within that tile.

  const ANNOTATED_SLUG = `${SLUG}-annotated-site-plan`;
  try {
    const kA = step.start("[+] Annotated site plan — locating bicycle storage on civil drawing");
    const civilBuffer = fs.readFileSync(CIVIL_PATH);
    const sharp = (await import("sharp")).default;

    // Render a single full-page image at 2500px longest side — same resolution
    // that reliably found the rack notation in our extraction testing
    const civilTiles = await renderPdfToTiles(civilBuffer);
    // Re-render the full page (not tiled) at moderate resolution for location query
    const { default: pdfjsLib } = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
    const { createCanvas }      = await import("@napi-rs/canvas");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `file://${require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;

    const pdfData   = new Uint8Array(civilBuffer);
    const pdf       = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const page      = await pdf.getPage(1);
    const vp        = page.getViewport({ scale: 150 / 72 }); // 150 DPI for location query
    const cvs       = createCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx2d     = cvs.getContext("2d");
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, cvs.width, cvs.height);
    await page.render({ canvasContext: ctx2d as any, viewport: vp, canvas: cvs as any }).promise;

    const longest    = Math.max(cvs.width, cvs.height);
    const resizeOpts = longest > 2500 ? (cvs.width >= cvs.height ? { width: 2500 } : { height: 2500 }) : {};
    const pageJpeg   = await sharp(cvs.toBuffer("image/png")).resize(resizeOpts).jpeg({ quality: 92 }).toBuffer();

    console.log(`  Full-page image: ${Math.round(pageJpeg.length / 1024)} KB — querying feature locations...`);

    const lt = pass1aData.longTermProvided  ?? 0;
    const st = pass1aData.shortTermProvided ?? 0;

    const locations = await locateFeaturesOnPage(
      client,
      pageJpeg,
      "image/jpeg",
      [
        "long-term bicycle storage — secured rack location near building entry",
        "short-term bicycle storage — visitor rack location near main entrance",
      ],
    );

    const [ltLoc, stLoc] = locations;
    if (!ltLoc && !stLoc) {
      console.warn("  ⚠ No storage locations found on full-page image — skipping annotated drawing");
    } else {
      const features: AnnotationFeature[] = [];

      if (ltLoc) {
        console.log(`  ✓ Long-term storage at ${ltLoc.pctX.toFixed(0)}%, ${ltLoc.pctY.toFixed(0)}% on full page`);
        features.push({ label: "LONG-TERM BICYCLE STORAGE", sublabel: `${lt} spaces • secured, covered`,   tileCol: 0, tileRow: 0, pctX: ltLoc.pctX, pctY: ltLoc.pctY, color: "#2b4044" });
      }
      if (stLoc) {
        console.log(`  ✓ Short-term storage at ${stLoc.pctX.toFixed(0)}%, ${stLoc.pctY.toFixed(0)}% on full page`);
        features.push({ label: "SHORT-TERM BICYCLE STORAGE", sublabel: `${st} spaces • visible from entry`, tileCol: 0, tileRow: 0, pctX: stLoc.pctX, pctY: stLoc.pctY, color: "#327cb9" });
      }

      // annotateDrawing with cols=1, rows=1 treats the whole page as one tile
      const annotatedPng  = await annotateDrawing(civilBuffer, features, 1, 1);
      const annotatedPath = path.join(OUTPUT_DIR, `${ANNOTATED_SLUG}.png`);
      fs.writeFileSync(annotatedPath, annotatedPng);
      console.log(`  ✓ Annotated site plan: ${annotatedPath} (${Math.round(annotatedPng.length / 1024)} KB)`);
    }
    step.complete(kA);
  } catch (err) {
    console.warn(`  ⚠ Annotated site plan failed: ${(err as Error).message}`);
  }

  // Summary
  const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
  const totalCost = ((usage.input / 1e6) * 3.00 + (usage.output / 1e6) * 15.00).toFixed(3);

  console.log("\n" + "═".repeat(60));
  console.log(`  Credit:  ${CREDIT_NAME}`);
  console.log(`  Address: ${resolvedAddress}`);
  console.log(`  Elapsed: ${elapsed}s`);
  console.log(`  Total cost: $${totalCost}`);
  console.log(`  Tokens in/out: ${usage.input.toLocaleString()} / ${usage.output.toLocaleString()}`);
  console.log("─".repeat(60));
  console.log(`  Output: ${OUTPUT_DIR}/`);
  console.log(`    ${SLUG}.html`);
  console.log(`    ${EDITABLE_SLUG}.html`);
  console.log(`    ${ANNOTATED_SLUG}.png  [annotated site plan]`);
  policyDrafts.forEach((d) => console.log(`    ${d.filename}  [policy draft]`));
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message ?? err);
  process.exit(1);
});
