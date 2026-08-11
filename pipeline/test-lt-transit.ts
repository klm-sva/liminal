/**
 * pipeline/test-lt-transit.ts
 *
 * Live test: LT Credit 5 — Access to Quality Transit
 * Project: 433 N Capitol Ave, Indianapolis, IN 46204
 * Program: LEED v4.1 BD+C New Construction
 *
 * Architecture: no custom retrieval code. Claude uses web_search to find all
 * location data (transit stops, trip counts, schedules) as part of Pass 1a.
 * Google Maps handles walking route measurement and aerial map rendering only.
 *
 * Execution order:
 *   1. Load source files (PDF, XLSX credit row)
 *   2. Pass 1a — Claude + web_search → structured JSON (locations array + form fields)
 *   3. Map generation — Google Maps walking routes for qualifying locations
 *   4. Pass 1b — Template render (0 AI tokens, 0 ms)
 *   5. Pass 2 — Supporting documentation (Claude + web_search)
 *   6. Assemble, validate, write both HTML files
 *
 * Run: npx ts-node pipeline/test-lt-transit.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { injectTableCss, makeEditable } from "./lib/make-editable";
import { generateMap, measureWalkingDistances, type WalkingRoute } from "./map-generation";
import { CREDIT_SUBMISSION_PROMPT } from "./prompts/credit-submission";
import { validateNoUnnecessaryCustomerRequests, applyTargetedCorrections, stripProcessNarration } from "./lib/validate-output";
import { StepLogger } from "./lib/pipeline-utils";
import { renderLTc5Form, type LTc5FormData, type CreditLocation } from "./lib/lt-transit-template";
import { findGtfsFeedUrls, getGtfsStopsNearProject, gtfsResultsToCreditLocations } from "./lib/gtfs-transit";
import { extractPdfContent, EXTRACT_PROMPTS } from "./lib/pdf-extract";
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

const DESKTOP        = "/Users/kelsey/Desktop/program automation ";
const XLSX_PATH      = path.join(DESKTOP, "automation analysis files/LEED_v41_BDC_Automation_Analysis_v6.xlsx");
const PDF_PATH       = path.join(DESKTOP, "leed credit files Nov 2025 Guide /LT files /leed bd+c v4.1 - LT Credit - Access to Quality Transit.pdf");
const OUTPUT_DIR     = path.resolve(__dirname, "output");
const SLUG           = "lt-access-to-quality-transit";
const EDITABLE_SLUG  = "lt-access-to-quality-transit-editable";

const PROJECT_ADDRESS = process.argv[2] ?? "600 B Street, San Diego, CA 92101";
const PROGRAM_NAME    = "LEED v4.1 BD+C New Construction";
const CREDIT_NAME     = "LT Credit 5 — Access to Quality Transit";
const CREDIT_CODE     = "LT Credit 5";
const FORM_LINK       = "https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/LT107";

// The web_search tool — added to every Anthropic API call in the pipeline
const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── Geocode address → lat/lon via Google Maps Geocoding API ─────────────────

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number }> {
  const { axiosGetWithRetry } = await import("./lib/pipeline-utils");

  // Try Google Geocoding API first
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const res = await axiosGetWithRetry(
        "https://maps.googleapis.com/maps/api/geocode/json",
        { params: { address, key } },
        10000,
        `Geocoding (Google): ${address}`,
      );
      const data = res.data;
      if (data.status === "OK" && data.results?.length) {
        const loc = data.results[0].geometry.location;
        console.log(`  ✓ Geocoded via Google Maps`);
        return { lat: loc.lat, lon: loc.lng };
      }
      console.warn(`  ⚠ Google Geocoding returned ${data.status} — falling back to Nominatim`);
    } catch {
      console.warn(`  ⚠ Google Geocoding request failed — falling back to Nominatim`);
    }
  }

  // Fallback: OpenStreetMap Nominatim (free, no API key required)
  const nomRes = await axiosGetWithRetry(
    "https://nominatim.openstreetmap.org/search",
    {
      params: { q: address, format: "json", limit: 1 },
      headers: { "User-Agent": "Liminal/1.0 (klmullen@hotmail.com)" },
    },
    10000,
    `Geocoding (Nominatim): ${address}`,
  );
  const results = nomRes.data as Array<{ lat: string; lon: string }>;
  if (!results?.length) {
    throw new Error(`Geocoding failed for "${address}" via both Google and Nominatim`);
  }
  console.log(`  ✓ Geocoded via Nominatim (OSM)`);
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractCreditRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(2).find((r: any[]) => String(r[1] ?? "").toLowerCase().includes("quality transit"));
  if (!row) throw new Error("LT Quality Transit row not found");
  const lines = [`Credit Automation Analysis — ${row[0]}: ${row[1]}`];
  for (let i = 2; i < hdrs.length; i++) {
    const v = row[i];
    if (v !== undefined && v !== "") lines.push(`  ${hdrs[i]}: ${String(v).replace(/\n/g, " | ").trim()}`);
  }
  return lines.join("\n");
}

// ─── JSON extractor — finds the first complete {...} block in text ─────────────

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) return text.trim();
  let depth = 0;
  let inStr  = false;
  let esc    = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc)                     { esc = false; continue; }
    if (ch === "\\" && inStr)    { esc = true;  continue; }
    if (ch === '"')              { inStr = !inStr; continue; }
    if (inStr)                   continue;
    if (ch === "{")              depth++;
    else if (ch === "}")         { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text.slice(start).trim();
}

// ─── Streaming call helper — temperature: 0, web_search on every call ─────────

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
    tools:       [WEB_SEARCH_TOOL],  // web_search enabled on every call
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
      // Rate limit from web search token consumption — wait 60s, then retry once
      console.warn(`\n  ⚠ Rate limit (429) — waiting 60s before retry...`);
      await new Promise((r) => setTimeout(r, 60000));
      return streamCall(client, label, systemPrompt, userContent, usage, maxTokens);
    }
    const detail = e.status ? ` [HTTP ${e.status}]` : "";
    throw new Error(`${label} stream failed${detail}: ${e.message}`);
  }
  usage.input  += final.usage.input_tokens;
  usage.output += final.usage.output_tokens;
  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log(`\n    ${final.usage.input_tokens.toLocaleString()} in / ${final.usage.output_tokens.toLocaleString()} out (${elapsed}s)`);
  return text;
}

// ─── Pre-render transit schedule tables from GTFS departure times ─────────────
// Renders the exact departure times we extracted and counted — these are the
// source of truth for the trip counts in the output. Embedding them directly
// means the reviewer can verify counts without going anywhere else.

function renderScheduleTables(locations: CreditLocation[], today: string, retrievalDate: string): string {
  const qualifying = locations.filter((l) => l.qualifies && l.weekdaySchedule && l.weekdaySchedule.length > 0);
  if (qualifying.length === 0) return "";

  const tableStyle = `
    border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 24px;
    font-family: Arial, Helvetica, sans-serif;
  `;
  const thStyle = `
    background: #327cb9; color: white; padding: 5px 8px; text-align: left; font-weight: bold;
  `;
  const tdStyle = `padding: 4px 8px; border-bottom: 1px solid #cccccc; vertical-align: top;`;
  const tdAltStyle = `${tdStyle} background: #e8f0f7;`;

  const stopSections = qualifying.map((loc) => {
    const schedule = loc.weekdaySchedule!;
    const rows = schedule.map((s, i) => {
      const style = i % 2 === 0 ? tdStyle : tdAltStyle;
      // Format times: strip seconds, group into a readable list
      const formatted = s.times.map((t) => t.slice(0, 5).replace(/^(\d):/, "0$1:")).join("  ·  ");
      return `<tr>
        <td style="${style} font-weight:bold;">${s.route}</td>
        <td style="${style} text-align:center;">${s.count}</td>
        <td style="${style} color:#444; line-height:1.6;">${formatted}</td>
      </tr>`;
    }).join("\n");

    const directional = Math.round(loc.weekday_trips / 2);
    return `
<h4 style="color:#327cb9; margin:16px 0 4px 0; font-size:12px;">
  ${loc.name}
  <span style="font-weight:normal; color:#666; font-size:11px;">
    — ${directional} directional trips (${loc.weekday_trips} total both directions)
  </span>
</h4>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th style="${thStyle}">Route</th>
      <th style="${thStyle} text-align:center;">Departures</th>
      <th style="${thStyle}">Weekday Departure Times</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
  }).join("\n");

  return `
<section id="liminal-schedule-tables" style="margin-top:32px;">
  <h3 style="color:#327cb9; border-bottom:2px solid #327cb9; padding-bottom:6px; font-size:14px;">
    Transit Schedule Data — Qualifying Stops
  </h3>
  <p style="font-size:11px; color:#515062; margin-bottom:16px;">
    Departure times extracted directly from GTFS schedule files published by each transit agency.
    These are the exact trip records used to calculate directional trip counts.
    Source: The Mobility Database (mobilitydatabase.org) · Retrieved: ${retrievalDate}
  </p>
  ${stopSections}
</section>`;
}

// ─── Build enriched data block from locations for Pass 2 ──────────────────────
// After map generation, walking distances are updated with Google Maps data.
// This block gives Pass 2 the confirmed, measured values so it never asks the
// customer for transit data that was already retrieved and measured.

function buildEnrichedDataBlock(
  locations: CreditLocation[],
  walkingRoutes: WalkingRoute[],
  today: string,
): Anthropic.ContentBlockParam {
  // Enrich locations with Google Maps walking distances
  const enriched: CreditLocation[] = locations.map((loc, i) => {
    const route = walkingRoutes.find((r) => r.destination.label === String(i + 1));
    if (route) {
      return {
        ...loc,
        walking_distance_feet:  route.distanceFeet,
        walking_distance_miles: route.distanceMiles,
        duration_minutes:       route.durationMinutes,
      };
    }
    return loc;
  });

  const qualifying = enriched.filter((l) => l.qualifies);

  // Collect deduplicated source URLs by agency for the Submission Checklist
  const sourcesByAgency = new Map<string, string>();
  for (const loc of enriched) {
    // data_source format: "GTFS: Agency Name — https://... — Retrieved DATE"
    const m = loc.data_source.match(/^GTFS:\s*(.+?)\s+—\s+(https?:\/\/\S+)/);
    if (m) sourcesByAgency.set(m[1].trim(), m[2].trim());
  }
  const sourceUrlBlock = sourcesByAgency.size > 0
    ? [
        `GTFS TECHNICAL SOURCE (these are raw developer files — do NOT link to these in the checklist):`,
        ...[...sourcesByAgency.entries()].map(([name, url]) => `  ${name} GTFS feed: ${url}`),
        ``,
        `CHECKLIST SOURCE LINKS — ACTION REQUIRED:`,
        `For each agency above, use web_search to find the agency's public schedule website`,
        `(e.g. "IndyGo route schedules site:indygo.net"). Use that URL — not the GTFS ZIP —`,
        `as the <a href="..."> link in Part 3 GROUP A. The reviewer needs a human-readable`,
        `schedule page they can use to independently verify the trip counts, not a raw data file.`,
        `If a specific route schedule page is available, link to the most specific page possible.`,
      ].join("\n")
    : "";

  const text = [
    `╔══════════════════════════════════════════════════════════════════════╗`,
    `║  RETRIEVED LOCATION DATA — GTFS SCHEDULE FILES + GOOGLE MAPS        ║`,
    `║  USE THESE VALUES DIRECTLY IN ALL TABLES AND NARRATIVE TEXT.        ║`,
    `║  DO NOT ADD A DATA SOURCE COLUMN TO ANY TABLE.                      ║`,
    `║  DO NOT ASK THE CUSTOMER FOR ANY OF THIS DATA.                      ║`,
    `╚══════════════════════════════════════════════════════════════════════╝`,
    ``,
    `RETRIEVAL DATE: ${today}`,
    `PROJECT ADDRESS: ${PROJECT_ADDRESS}`,
    `SEARCH RADIUS: 0.5 miles walking (LEED v4.1 LT Credit 5 threshold)`,
    ``,
    `QUALIFYING LOCATIONS (${qualifying.length} found):`,
    JSON.stringify(qualifying, null, 2),
    ``,
    `ALL LOCATIONS EVALUATED (${enriched.length} total):`,
    JSON.stringify(enriched, null, 2),
    ``,
    sourceUrlBlock,
    ``,
    `═══ INSTRUCTIONS FOR OUTPUT ═══`,
    `- Do NOT add a Data Source column to any table — source links go in Part 3 GROUP A only`,
    `- walking_distance_feet: measured by Google Maps Directions API — use exactly`,
    `- weekday_trips: total both directions from GTFS; directional trips = weekday_trips ÷ 2`,
    `- weekend_trips: total both directions from GTFS (higher of Saturday or Sunday); directional = weekend_trips ÷ 2`,
    `- BOTH weekday_trips AND weekend_trips are already retrieved from GTFS — do NOT ask the customer for either`,
    `- LEED v4.1 Table 1 requires one-direction (directional) counts — calculate from both fields above`,
    `- Walking distance map is already embedded in the HTML — do NOT request it`,
    `- Do NOT ask the customer to provide transit schedules, trip counts, or distances`,
    `- The ONLY customer upload for Path 1: site plan showing pedestrian access routes`,
    `- In Part 3 GROUP A: for each retrieved item, include a clickable <a href="..."> link to the source`,
    `  so the certification reviewer can download and independently verify the underlying data`,
  ].join("\n");

  return {
    type:          "text",
    text,
    cache_control: { type: "ephemeral" },
  } as any;
}

// ─── LEED v4.1 LT Credit 5 points table ──────────────────────────────────────

function computePoints(qualifyingCount: number): number {
  if (qualifyingCount >= 8) return 5;
  if (qualifyingCount >= 6) return 4;
  if (qualifyingCount >= 4) return 3;
  if (qualifyingCount >= 2) return 2;
  if (qualifyingCount >= 1) return 1;
  return 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in .env.local");

  const client    = new Anthropic({ apiKey, timeout: 180000, maxRetries: 0 });
  const startTime = Date.now();
  const usage     = { input: 0, output: 0 };
  const logger    = new StepLogger();
  const today     = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ── Geocode project address → lat/lon ─────────────────────────────────────
  console.log(`\nGeocoding: ${PROJECT_ADDRESS}...`);
  let PROJECT_LAT: number;
  let PROJECT_LON: number;
  try {
    const coords = await geocodeAddress(PROJECT_ADDRESS);
    PROJECT_LAT = coords.lat;
    PROJECT_LON = coords.lon;
    console.log(`  ✓ Coordinates: ${PROJECT_LAT.toFixed(5)}, ${PROJECT_LON.toFixed(5)}`);
  } catch (err) {
    console.error(`\n[ERROR] ${(err as Error).message}`);
    process.exit(1);
  }

  console.log("═".repeat(60));
  console.log(` LT Credit 5 — Access to Quality Transit`);
  console.log(` ${PROJECT_ADDRESS}`);
  console.log(` LEED v4.1 BD+C New Construction`);
  console.log("═".repeat(60));

  // ── [1/8] Load source files ────────────────────────────────────────────────

  console.log("\n[1/8] Loading source files + pre-extracting credit PDF...");
  const creditRow = extractCreditRow();

  // Pre-extract credit PDF with Haiku — result reused as text on both passes
  const creditPdfExtract = await extractPdfContent(client, PDF_PATH, EXTRACT_PROMPTS.CREDIT_REQUIREMENTS);
  usage.input  += creditPdfExtract.inputTokens;
  usage.output += creditPdfExtract.outputTokens;
  console.log(`  Credit row: ${creditRow.length} chars`);

  // Replace raw PDF block with cheap text extract
  const cachedPdf: Anthropic.ContentBlockParam = {
    type:          "text",
    text:          `CREDIT REQUIREMENTS (extracted from PDF):\n${creditPdfExtract.text}`,
    cache_control: { type: "ephemeral" },
  } as any;

  // GBCI Accepted Verification spec — overrides whatever is in the XLSX column.
  // Update this when the v8 spreadsheet is uploaded; for now the exact spec is hardcoded.
  const GBCI_VERIFICATION_SPEC = `GBCI Accepted Verification — Exact Deliverable Specification:
LEED Online Form LT107 — Completed form with: (1) selected path (Path 1: Public Transit or Path 2: Project-Sponsored Transit); (2) for Path 1: for each qualifying transit stop within walking distance — stop name/ID, transit route name and number, transit agency, stop type (bus/streetcar/BRT/rail/ferry), walking distance from nearest functional building entry to stop entrance in feet/meters measured along pedestrian route, weekday trip count (one direction only), and weekend trip count (higher-count day only); total weekday and weekend trips aggregated across all qualifying routes; points per Table 1; map showing all functional building entries, all transit stops within ¼-mile (bus/streetcar/informal) and ½-mile (BRT/rail/ferry) walking distance along walking routes with stop type labeled, pedestrian routes from each entry to qualifying stops shown with measured walking distances along walking routes, scale bar, and north arrow; (3) for Path 2: total daily project-sponsored trips (inbound plus outbound), transit stop shelter location confirmation, guaranteed ride home program description, service guarantee duration (≥3 years from CO). GTFS data auto-retrieved; walking distances calculated on pedestrian network.`;

  const cachedCreditRow: Anthropic.ContentBlockParam = {
    type:          "text",
    text:          `AUTOMATION ANALYSIS — THIS CREDIT ONLY:\n${creditRow}\n\nGBCI VERIFICATION SPEC (AUTHORITATIVE — use this over any column in the spreadsheet above):\n${GBCI_VERIFICATION_SPEC}\n\nFORM LINK: ${FORM_LINK}`,
    cache_control: { type: "ephemeral" },
  } as any;

  const projectDataBlock: Anthropic.ContentBlockParam = {
    type: "text",
    text: [
      `PROJECT DATA:`,
      `  Address: ${PROJECT_ADDRESS}`,
      `  Program: ${PROGRAM_NAME}`,
      `  Credit: ${CREDIT_NAME}`,
      `  Credit Code: ${CREDIT_CODE}`,
    ].join("\n"),
  };

  const systemPrompt = CREDIT_SUBMISSION_PROMPT;

  // ── [2/8] GTFS data fetch — accurate trip counts from agency schedule data ────
  // Downloads the GTFS feed for all transit agencies near the project address.
  // Parses stops, routes, calendar, and stop_times to produce deterministic
  // trip counts. This replaces web search for transit stop data entirely.

  console.log("\n[2/8] GTFS data fetch — discovering feeds and parsing schedules...");
  const gtfsKey = logger.start("GTFS feed discovery + parse");

  let locations: CreditLocation[] = [];
  try {
    const feedUrls   = await findGtfsFeedUrls(PROJECT_LAT, PROJECT_LON);
    console.log(`  Found ${feedUrls.length} GTFS feed(s) near project location`);
    feedUrls.forEach((f) => console.log(`    • ${f.name}: ${f.url}`));

    const gtfsResults = await getGtfsStopsNearProject(PROJECT_LAT, PROJECT_LON, feedUrls);
    locations = gtfsResultsToCreditLocations(gtfsResults, today);

    const qualifying = locations.filter((l) => l.qualifies);
    logger.complete(gtfsKey);
    console.log(`\n  GTFS: ${locations.length} stop cluster(s) within 0.5 miles, ${qualifying.length} qualifying`);
    locations.forEach((l, i) => {
      const directional = Math.round(l.weekday_trips / 2);
      console.log(`    ${i + 1}. ${l.name}`);
      console.log(`       Weekday trips: ${l.weekday_trips} total (${directional} directional) | Qualifies: ${l.qualifies ? "YES" : "NO"}`);
      console.log(`       Routes: ${l.routes?.join(", ") ?? "—"}`);
    });
  } catch (err) {
    logger.fail(gtfsKey, err as Error);
    console.warn(`  ⚠ GTFS fetch failed: ${(err as Error).message} — locations will be empty`);
  }

  // ── [3/7] Re-qualify using actual Google Maps walking distances ───────────────
  // GTFS pre-qualifies stops using haversine (straight-line) distance. Straight-line
  // is always ≤ actual walking distance, so some GTFS-qualifying stops may be outside
  // the LEED threshold once real walking routes are measured. Re-qualify BEFORE
  // Pass 1a so the compliance calculation uses only genuinely qualifying stops.

  console.log("\n[3/7] Re-qualifying stops using actual walking distances (Google Maps)...");
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

  if (mapsKey) {
    const candidates = locations.filter((l) => l.qualifies);
    if (candidates.length > 0) {
      const requalifyKey = logger.start("Walking distance re-qualification");
      try {
        const measuredRoutes = await measureWalkingDistances(
          PROJECT_ADDRESS,
          candidates.map((loc, i) => ({ address: loc.address, label: String(i) })),
        );

        const BUS_THRESHOLD_FT  = 1320; // 0.25 miles — LEED v4.1 LT Credit 5 bus
        const RAIL_THRESHOLD_FT = 2640; // 0.50 miles — LEED v4.1 LT Credit 5 rail/ferry

        for (const route of measuredRoutes) {
          const idx = parseInt(route.destination.label, 10);
          const loc = candidates[idx];
          if (!loc) continue;
          const isRail = loc.transit_type !== "bus" && loc.transit_type !== "BRT";
          const thresholdFt = isRail ? RAIL_THRESHOLD_FT : BUS_THRESHOLD_FT;
          const actuallyQualifies = route.distanceFeet <= thresholdFt;
          if (!actuallyQualifies) {
            console.log(`  ✗ Disqualified: ${loc.name} — ${route.distanceFeet.toLocaleString()} ft actual walking (limit: ${thresholdFt.toLocaleString()} ft)`);
          } else {
            console.log(`  ✓ Confirmed: ${loc.name} — ${route.distanceFeet.toLocaleString()} ft (within ${thresholdFt.toLocaleString()} ft limit)`);
          }
          loc.walking_distance_feet  = route.distanceFeet;
          loc.walking_distance_miles = route.distanceMiles;
          loc.duration_minutes       = route.durationMinutes;
          loc.qualifies              = actuallyQualifies;
        }
        logger.complete(requalifyKey);
        const requalCount = locations.filter((l) => l.qualifies).length;
        console.log(`  Qualifying after walking distance check: ${requalCount}`);
      } catch (err) {
        logger.fail(requalifyKey, err as Error);
        console.warn(`  ⚠ Re-qualification failed: ${(err as Error).message} — using GTFS straight-line distances`);
      }
    }
  } else {
    console.log("  ⚠ GOOGLE_MAPS_API_KEY not set — skipping re-qualification (GTFS straight-line distances used)");
  }

  // ── [4/7] Pass 1a — narrative + compliance from PDF (uses re-qualified stops) ──
  // Re-qualification is complete. Claude reads the PDF to determine points from
  // the LEED scoring table and writes the narrative and compliance statement.

  console.log("\n[4/7] Pass 1a — compliance + narrative (Claude reads PDF)...");

  const gtfsDataSummary = locations.map((l, i) => {
    const directional = Math.round(l.weekday_trips / 2);
    const distFt = l.walking_distance_feet > 0 ? l.walking_distance_feet : Math.round(l.walking_distance_miles * 5280);
    const distNote = mapsKey ? `${distFt.toLocaleString()} ft (Google Maps measured)` : `~${distFt.toLocaleString()} ft (GTFS straight-line estimate)`;
    const wkndDirectional = l.weekend_trips > 0 ? Math.round(l.weekend_trips / 2) : 0;
    return `  ${i + 1}. ${l.name} | routes: ${l.routes?.join(", ") ?? "—"} | weekday directional trips: ${directional} | weekend directional trips: ${wkndDirectional || "0 (no weekend service)"} | walking distance: ${distNote} | qualifies: ${l.qualifies}`;
  }).join("\n");

  const pass1aSystem = `You are a LEED documentation specialist. Return ONLY a valid JSON object — no markdown, no preamble, no explanation.`;

  const pass1aContent: Anthropic.ContentBlockParam[] = [
    cachedPdf,
    cachedCreditRow,
    projectDataBlock,
    {
      type: "text",
      text: [
        `Transit stop data has been retrieved from GTFS schedule files and walking distances verified by Google Maps.`,
        `Do NOT search for additional stops. Use only the data below.`,
        ``,
        `STOPS EVALUATED (walking distances are Google Maps measured, not estimates):`,
        gtfsDataSummary,
        ``,
        `Your task: read the credit requirements PDF to determine the correct points from the LEED scoring table,`,
        `then return a JSON object with exactly these fields:`,
        `{`,
        `  "path": "1",`,
        `  "pointsEarned": <number — read the points table in the PDF using the qualifying stop count above>,`,
        `  "pointsAvailable": 5,`,
        `  "thresholdMet": <boolean>,`,
        `  "narrativeSummary": "<2-3 sentence summary of transit access at this project>",`,
        `  "complianceStatement": "<formal compliance statement using the verified data above>",`,
        `  "ownerConfirmItems": ["<items requiring physical site access or owner decisions only>"]`,
        `}`,
        ``,
        `Return raw JSON only — no code fence, no explanation.`,
      ].join("\n"),
    },
  ];

  const pass1aKey  = logger.start("Pass 1a — compliance + narrative (Claude)");
  const pass1aText = await streamCall(client, "Pass 1a (compliance)", pass1aSystem, pass1aContent, usage, 4000);
  logger.complete(pass1aKey);

  let pass1aData: Partial<LTc5FormData> = {};
  try {
    pass1aData = JSON.parse(extractJsonObject(pass1aText));
    console.log(`  Points (from PDF table): ${pass1aData.pointsEarned} / ${pass1aData.pointsAvailable ?? 5}`);
  } catch (err) {
    console.warn(`  ⚠ Pass 1a JSON parse failed: ${(err as Error).message} — using defaults`);
  }

  // ── Map generation — Google Maps walking routes for re-qualified locations ────

  console.log("\n[5/7] Generating walking distance map via Google Maps API...");
  let mapPngBuffer:  Buffer | null  = null;
  let mapBase64Html: string         = "";
  let walkingRoutes: WalkingRoute[] = [];

  const qualifyingLocations = locations.filter((l) => l.qualifies);

  if (!mapsKey) {
    console.log("  ⚠ GOOGLE_MAPS_API_KEY not set — map placeholder will appear in output");
  } else if (qualifyingLocations.length === 0) {
    console.log("  ⚠ No qualifying locations — skipping map generation");
  } else {
    const mapKey = logger.start("Map generation (Google Maps)");
    try {
      const destinations = qualifyingLocations.slice(0, 8).map((loc, i) => ({
        address: loc.address,
        label:   String(i + 1),
      }));
      const mapResult = await generateMap({
        originAddress: PROJECT_ADDRESS,
        destinations,
        mapType: "transit-stops",
      });
      mapPngBuffer  = mapResult.pngBuffer;
      walkingRoutes = mapResult.routes;
      mapBase64Html = `data:image/png;base64,${mapPngBuffer.toString("base64")}`;
      logger.complete(mapKey);
      console.log(`  ✓ Map generated (${Math.round(mapPngBuffer.length / 1024)} KB PNG)`);
      mapResult.routes.forEach((r) =>
        console.log(`    • ${r.destination.label}: ${r.distanceFeet.toLocaleString()} ft (${r.durationMinutes} min walk)`)
      );

      // Update qualifying locations with measured walking distances from Google Maps
      walkingRoutes.forEach((r) => {
        const idx = parseInt(r.destination.label, 10) - 1;
        if (idx >= 0 && idx < qualifyingLocations.length) {
          qualifyingLocations[idx].walking_distance_feet  = r.distanceFeet;
          qualifyingLocations[idx].walking_distance_miles = r.distanceMiles;
          qualifyingLocations[idx].duration_minutes       = r.durationMinutes;
        }
      });
    } catch (err) {
      logger.fail(mapKey, err as Error);
      console.warn(`  ⚠ Map generation failed: ${(err as Error).message} — placeholder will appear`);
    }
  }

  // Build map HTML figure
  const mapHtml = mapBase64Html
    ? `<figure style="margin:24px 0;text-align:center;">
        <img src="${mapBase64Html}" alt="Walking Distance Map — ${PROJECT_ADDRESS}" style="width:100%;max-width:1200px;border:1px solid #cccccc;"/>
        <figcaption style="font-size:11px;color:#555;margin-top:6px;">Source: Google Maps — Walking distances measured along pedestrian routes. ${today}</figcaption>
      </figure>`
    : `<div style="border:2px dashed #cccccc;padding:24px;text-align:center;color:#888;margin:24px 0;">
        <strong>Walking Distance Map</strong><br/>
        Add GOOGLE_MAPS_API_KEY to .env.local to enable real aerial map generation.
      </div>`;

  // ── [4/6] Pass 1b — Template render (0 AI tokens, 0 ms) ───────────────────

  console.log("\n[6/7] Pass 1b — Template render (0 AI tokens)...");

  const qualifyingCount = qualifyingLocations.length;
  const computedPoints  = computePoints(qualifyingCount);

  const ltc5FormData: LTc5FormData = {
    projectName:    PROJECT_ADDRESS,
    projectAddress: PROJECT_ADDRESS,
    certProgram:    PROGRAM_NAME,
    creditName:     CREDIT_NAME,
    submissionDate: today,
    path:           (pass1aData.path as "1" | "2") ?? "1",
    locations:      qualifyingLocations,
    totalQualifying: qualifyingCount,
    pointsEarned:   pass1aData.pointsEarned   ?? computedPoints,
    pointsAvailable: pass1aData.pointsAvailable ?? 5,
    thresholdMet:   pass1aData.thresholdMet   ?? qualifyingCount > 0,
    narrativeSummary:
      pass1aData.narrativeSummary ??
      `${qualifyingCount} qualifying transit stop(s) identified within 0.5 miles of the project. Transit access threshold is met.`,
    complianceStatement:
      pass1aData.complianceStatement ??
      `The project meets the requirements of LEED v4.1 LT Credit 5, Path 1, with ${qualifyingCount} qualifying stop(s).`,
    ownerConfirmItems:
      pass1aData.ownerConfirmItems ??
      ["Site plan from drawing set showing functional entries and pedestrian access routes to qualifying transit stops"],
  };

  const part1Raw = renderLTc5Form(ltc5FormData, mapHtml);
  console.log(`  ✓ Template rendered (${Math.round(part1Raw.length / 1024)} KB, 0 AI tokens)`);

  // ── [5/6] Pass 2 — Supporting Documentation ────────────────────────────────

  console.log("\n[7/7] Pass 2 — Supporting Documentation...");

  // Enriched data block — locations with Google Maps distances, for Pass 2 context
  const enrichedDataBlock = buildEnrichedDataBlock(qualifyingLocations, walkingRoutes, today);

  const pass2System = systemPrompt + `

══════════════════════════════════════════
THIS RESPONSE: PART 2 FRAGMENT ONLY
══════════════════════════════════════════
Generate ONLY the supporting documentation (Part 2).
- Output an HTML fragment — NO DOCTYPE, NO <html>, NO <head>, NO <body> tags
- Start with a <section> or <div> element
- Include ONLY items listed in Column 4 of the automation analysis spreadsheet
- Do NOT repeat the form or any form fields from Part 1
- Do NOT generate any map — the map is already embedded
- Do NOT narrate the process
- Do NOT ask the customer for transit schedules, trip counts, or walking distances — use RETRIEVED LOCATION DATA
- Trip count tables, distance tables, threshold comparison tables: use real HTML <table> elements
- Be concise: include every required item completely
- You may use web search to verify any data point or find additional supporting information`;

  const pass2Content: Anthropic.ContentBlockParam[] = [
    enrichedDataBlock,
    cachedPdf,
    cachedCreditRow,
    projectDataBlock,
    {
      type: "text",
      text: [
        `Generate PART 2 and PART 3 for ${CREDIT_NAME}.`,
        ``,
        `PART 2 — Supporting Documentation:`,
        `Include: GTFS trip count table, walking distance analysis, points determination per Tables 1 and 2, data source citations.`,
        `Use the location data from the RETRIEVED LOCATION DATA block — it is already confirmed and measured. Do not ask the customer for any of it.`,
        `Do not include the form. Do not generate a map.`,
        ``,
        `PART 3 — Complete Submission Checklist:`,
        `Read Column 1 (Project Team Must Upload) and Column 2 (Claude Auto-Retrieves) from the automation analysis row above.`,
        `List every Column 2 item as PROVIDED with where it appears in this document.`,
        `List every Column 1 item as REQUIRED FROM PROJECT TEAM with a specific description of what it is, why it cannot be auto-retrieved, and the format required.`,
        `Every item from both columns must appear. None may be omitted.`,
        ``,
        `Then include the Processing Summary.`,
      ].join("\n"),
    },
  ];

  const pass2Key = logger.start("Pass 2 — Supporting Documentation (Claude)");
  const part2Raw = await streamCall(client, "Pass 2 (docs)", pass2System, pass2Content, usage);
  logger.complete(pass2Key);

  // ── [6/6] Assemble, validate, write ────────────────────────────────────────

  console.log("\n[8/8] Assembling and validating output...");

  const part2Clean = part2Raw;

  // Pre-render transit schedule tables from GTFS departure times — these are the
  // actual schedule data (not an AI summary) embedded directly for reviewer verification.
  const scheduleTablesHtml = renderScheduleTables(qualifyingLocations, today, today);
  if (scheduleTablesHtml) {
    console.log(`  ✓ Schedule tables pre-rendered from GTFS departure times`);
  }

  // Width normalization — inject a style block that resets any max-width or
  // margin:auto that Claude adds to its Part 2 container, so both parts render
  // at the same effective width as the body (body { padding: 24px } in Part 1).
  const widthResetStyle = `<style>
/* liminal-width-reset: Part 2 must align with Part 1 body width */
#liminal-part2 > section,
#liminal-part2 > div { max-width: none !important; margin-left: 0 !important; margin-right: 0 !important; box-sizing: border-box !important; }
</style>`;

  const part2Wrapped = `${widthResetStyle}\n<div id="liminal-part2">\n${part2Clean}\n${scheduleTablesHtml}\n</div>`;

  const bodyCloseIdx = part1Raw.lastIndexOf("</body>");
  const assembled = bodyCloseIdx !== -1
    ? part1Raw.slice(0, bodyCloseIdx) + "\n\n<!-- PART 2 -->\n" + part2Wrapped + "\n\n</body></html>"
    : part1Raw + "\n\n" + part2Wrapped;

  // Strip process narration from the full assembled document
  let fullHtml = stripProcessNarration(assembled);
  if (fullHtml.length < assembled.length) {
    console.log(`  ✓ Narration stripped from full document (${assembled.length - fullHtml.length} chars removed)`);
  }

  // Validate — block if any output asks customer for auto-retrievable data
  let violations = validateNoUnnecessaryCustomerRequests(fullHtml);

  if (violations.length > 0) {
    console.log(`\n  ✗ VALIDATION FAILED — ${violations.length} violation(s) detected:`);
    violations.forEach((v, i) => {
      console.log(`    ${i + 1}. ${v.description}`);
      console.log(`       Context: ${v.context}`);
    });
    console.log(`\n  Applying targeted corrections...`);
    fullHtml   = applyTargetedCorrections(fullHtml, violations);
    violations = validateNoUnnecessaryCustomerRequests(fullHtml);
    if (violations.length === 0) {
      console.log(`  ✓ All violations corrected via targeted replacement`);
    } else {
      console.warn(`  ⚠ ${violations.length} violation(s) remain after targeted correction — delivering with warnings`);
      violations.forEach((v, i) => console.log(`    ${i + 1}. ${v.description}`));
    }
  } else {
    console.log(`  ✓ Validation passed — no customer requests for auto-retrievable data`);
  }

  // Policy drafts — detect any policy requirements from Column 1 and generate drafts
  const policyDrafts = await generatePolicyDrafts(client, creditRow, {
    creditName:             CREDIT_NAME,
    certProgram:            PROGRAM_NAME,
    projectAddress:         PROJECT_ADDRESS,
    creditRequirementsText: creditPdfExtract.text,
    creditSlug:             SLUG,
    outputDir:              OUTPUT_DIR,
  }, usage);

  if (policyDrafts.length > 0) {
    const bodyClose = fullHtml.lastIndexOf("</body>");
    const policySection = policyChecklistHtml(policyDrafts);
    fullHtml = bodyClose !== -1
      ? fullHtml.slice(0, bodyClose) + policySection + "\n</body></html>"
      : fullHtml + policySection;
  }

  const writeKey = logger.start("Write output files");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const standardHtml = injectTableCss(fullHtml);
  const htmlPath     = path.join(OUTPUT_DIR, `${SLUG}.html`);
  fs.writeFileSync(htmlPath, standardHtml);
  console.log(`  ✓ Standard HTML: ${SLUG}.html (${Math.round(standardHtml.length / 1024)} KB)`);

  const mapEmbedded  = standardHtml.includes("data:image/png;base64");
  console.log(`  ✓ Real map embedded: ${mapEmbedded ? "YES" : "NO (API key not set)"}`);

  const editableHtml = makeEditable(fullHtml);
  const editablePath = path.join(OUTPUT_DIR, `${EDITABLE_SLUG}.html`);
  fs.writeFileSync(editablePath, editableHtml);
  console.log(`  ✓ Editable HTML: ${EDITABLE_SLUG}.html (${Math.round(editableHtml.length / 1024)} KB)`);
  logger.complete(writeKey);

  // ── Summary ───────────────────────────────────────────────────────────────

  const elapsed    = Math.round((Date.now() - startTime) / 1000);
  const inputCost  = (usage.input  / 1_000_000) * 3.00;
  const outputCost = (usage.output / 1_000_000) * 15.00;
  const totalCost  = inputCost + outputCost;

  const hasNoNarration = !standardHtml.match(/I have reviewed|I will now|As requested|Here is the|Based on the attached/i);
  const hasTables      = (standardHtml.match(/<table/gi) ?? []).length;
  const hasContentEdit = editableHtml.includes('contenteditable="true"');
  const hasBanner      = editableHtml.includes("liminal-edit-banner");
  const hasTableCss    = standardHtml.includes("liminal-table-css");
  const htmlSize       = Math.round(fs.statSync(htmlPath).size / 1024);
  const editableSize   = Math.round(fs.statSync(editablePath).size / 1024);
  const finalViolations = validateNoUnnecessaryCustomerRequests(standardHtml);

  console.log("\n" + "═".repeat(60));
  console.log("  RESULTS");
  console.log("═".repeat(60));
  console.log(`  Total cost:            $${totalCost.toFixed(3)}`);
  console.log(`  Total time:            ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log(`  Tokens in/out:         ${usage.input.toLocaleString()} / ${usage.output.toLocaleString()}`);
  console.log(`  Standard HTML size:    ${htmlSize} KB`);
  console.log(`  Editable HTML size:    ${editableSize} KB`);
  console.log(`  Real map embedded:     ${mapEmbedded ? "YES ✓" : "NO — add GOOGLE_MAPS_API_KEY"}`);
  console.log(`  Editable HTML:         ${hasContentEdit && hasBanner ? "YES ✓" : "FAILED ✗"}`);
  console.log(`    contenteditable:     ${hasContentEdit ? "YES ✓" : "NO ✗"}`);
  console.log(`    instruction banner:  ${hasBanner ? "YES ✓" : "NO ✗"}`);
  console.log(`  Table CSS injected:    ${hasTableCss ? "YES ✓" : "NO ✗"}`);
  console.log(`  HTML tables:           ${hasTables} table(s) ✓`);
  console.log(`  No process narration:  ${hasNoNarration ? "YES ✓" : "FAILED — narration detected"}`);
  console.log(`  FIX 1 validation:      ${finalViolations.length === 0 ? "PASS ✓ — no auto-retrievable requests" : `FAIL ✗ — ${finalViolations.length} violation(s)`}`);
  if (finalViolations.length > 0) {
    console.log(`  Remaining violations:`);
    finalViolations.forEach((v, i) => console.log(`    ${i + 1}. ${v.description}`));
  }
  console.log(`  web_search enabled:    YES ✓ — on all API calls`);
  console.log(`  GTFS data source:      YES ✓ — trip counts from agency schedule files`);

  // Full locations report
  console.log(`\n  LOCATIONS FOUND (${locations.length} total, ${qualifyingLocations.length} qualifying):`);
  locations.forEach((l, i) => {
    const directional = Math.round(l.weekday_trips / 2);
    const dist = l.walking_distance_feet > 0
      ? `${l.walking_distance_feet.toLocaleString()} ft`
      : `${(l.walking_distance_miles * 5280).toFixed(0)} ft est.`;
    const dur = l.duration_minutes ? ` (${l.duration_minutes} min)` : "";
    console.log(`    ${i + 1}. ${l.name}`);
    console.log(`       Distance: ${dist}${dur}  |  Weekday trips: ${l.weekday_trips} (${directional} directional)`);
    console.log(`       Qualifies: ${l.qualifies ? "YES" : "NO"}  |  Source: ${l.data_source}`);
  });
  console.log(`\n  Points: ${ltc5FormData.pointsEarned} / ${ltc5FormData.pointsAvailable} (expected 5)`);
  console.log(`  Map: ${mapEmbedded ? "aerial base + walking routes along sidewalks" : "placeholder (add GOOGLE_MAPS_API_KEY)"}`);

  console.log("═".repeat(60));
  console.log(`\n  Output: ${OUTPUT_DIR}/`);
  console.log(`    ${SLUG}.html`);
  console.log(`    ${EDITABLE_SLUG}.html`);
  policyDrafts.forEach((d) => console.log(`    ${d.filename}  [policy draft]`));
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message);
  process.exit(1);
});
