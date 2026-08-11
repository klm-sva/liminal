/**
 * pipeline/test-leed-gap-analysis.ts
 *
 * Live test: LEED v4.1 BD+C Gap Analysis — Riverfront, San Diego
 *
 * Customer uploads: none. Questionnaire answers only.
 *
 * Pipeline:
 *   1. Load all LEED credits from XLSX
 *   2. Pass 1 — Web search: location, transit, density, walkability, site context
 *   3. Pass 2 — Credit-by-credit scoring: LT, SS, WE, EA (location + questionnaire data)
 *   4. Pass 3 — Credit-by-credit scoring: MR, EQ, IN, RP + full HTML report assembly
 *   5. Assemble + validate + write output files
 *
 * Run: npx ts-node pipeline/test-leed-gap-analysis.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { injectTableCss, makeEditable }         from "./lib/make-editable";
import { validateNoUnnecessaryCustomerRequests } from "./lib/validate-output";
import { StepLogger }                           from "./lib/pipeline-utils";
import { scrubNarration, writeCleanFile }       from "./lib/output-cleaner";

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

const XLSX_PATH  = path.resolve(__dirname, "reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");
const OUTPUT_DIR = path.resolve(__dirname, "output");
const SLUG       = "leed-gap-analysis-riverfront";

const PROJECT_NAME    = "Riverfront";
const PROJECT_ADDRESS = "600 W Broadway, San Diego, CA 92101";
const PROGRAM_NAME    = "LEED v4.1 BD+C — New Construction";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── Questionnaire answers ─────────────────────────────────────────────────────

const QUESTIONNAIRE = `
PROJECT INFORMATION
  Project Name: Riverfront
  Address: 600 W Broadway, San Diego, CA 92101
  Building Type: Office
  Gross Floor Area: 150,000 SF
  Floors Above Grade: 12
  Parking Spaces: 175
  LEED Certification Target: Gold (60 points minimum)
  LEED AP on Team: Yes

ENERGY & ATMOSPHERE
  Energy Performance vs. Baseline: 10–14% better than ASHRAE 90.1 baseline
  Heating Fuel: Mixed (gas + electric)
  Cooling System: Chilled water
  Renewable Energy Onsite: None
  Enhanced Commissioning: Not yet — no CX authority engaged
  Refrigerant Type: Natural refrigerants
  Contractor Selected: Not yet

WATER EFFICIENCY
  Irrigation Strategy: High-efficiency drip/micro-irrigation
  Water Reuse (cooling/process): None
  Cooling Tower: Yes (present)
  Indoor Fixture Intent: Not yet specified — no fixture schedule

LOCATION & TRANSPORTATION
  Previously Developed Site: Yes
  Full Building Demolition: No (existing structure retained/incorporated)
  Site Area: 1.2 acres
  Dedicated Bike Storage: Yes (planned)
  EV Charging: Yes (planned)
  Exterior Lighting: Unknown — not yet specified

MATERIALS & RESOURCES
  EPDs for Products: Unknown — not yet specified
  FSC-Certified Wood: Unknown
  Construction Waste Management Plan: Yes (committed)
  Low-Emitting Materials: Some specified, not comprehensive

INDOOR ENVIRONMENTAL QUALITY
  Ventilation Strategy: ASHRAE 62.1
  Daylighting: Unknown — not modeled yet
  Acoustic Performance: No — acoustic credit not pursued
  Construction IAQ Plan: Yes

INTEGRATIVE PROCESS
  Integrative Design Charrette: Yes (completed)
  CX Authority Engaged: Not yet

CUSTOMER UPLOADS: None. All scoring based on questionnaire answers above.
`;

// ─── XLSX helper — load ALL LEED credits ─────────────────────────────────────

interface LeedCredit {
  code:           string;
  name:           string;
  ptsAvailable:   number;
  category:       string;
}

function loadAllLeedCredits(): { credits: LeedCredit[]; summary: string } {
  if (!fs.existsSync(XLSX_PATH)) throw new Error(`XLSX not found: ${XLSX_PATH}`);
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Headers on row index 1 (row 2 in Excel)
  const hdrs = (rows[1] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());

  const credits: LeedCredit[] = [];
  let currentCategory = "";

  // Data from row index 4 (row 5 in Excel)
  for (const row of rows.slice(4)) {
    const code = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();
    const pts  = row[2];

    if (!code && !name) continue;

    // Category header rows: col 0 is blank, col 1 has full category name
    if (!code && name) {
      currentCategory = name;
      continue;
    }

    // Skip rows that look like category headers (all caps, no credit code pattern)
    const looksLikeCredit = /^(LT|SS|WE|EA|MR|EQ|IN|RP|IP)/i.test(code);
    if (!looksLikeCredit) {
      if (name && !pts) currentCategory = name || currentCategory;
      continue;
    }

    const ptsNum = typeof pts === "number" ? pts : parseFloat(String(pts ?? "0").replace(/[^0-9.]/g, "") || "0");

    credits.push({
      code,
      name,
      ptsAvailable: isNaN(ptsNum) ? 0 : ptsNum,
      category: currentCategory,
    });
  }

  // Build a compact catalog for the prompt
  const lines: string[] = [`LEED v4.1 BD+C Credit Catalog — ${credits.length} credits/prerequisites loaded\n`];
  let catTrack = "";
  for (const c of credits) {
    if (c.category !== catTrack) {
      catTrack = c.category;
      lines.push(`\n[${catTrack}]`);
    }
    const pts = c.ptsAvailable > 0 ? `${c.ptsAvailable} pts` : "prerequisite";
    lines.push(`  ${c.code}: ${c.name} (${pts})`);
  }

  return { credits, summary: lines.join("\n") };
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

// ─── System prompt for gap analysis ──────────────────────────────────────────

const GAP_ANALYSIS_SYSTEM_PROMPT = `ABSOLUTE OUTPUT RULE — THIS OVERRIDES EVERYTHING ELSE:

Your output is a customer-facing professional document. Output begins with the first HTML tag or heading. Nothing before that. No preamble, no narration, no process description.

You are forbidden from writing: "I will...", "Let me...", "I found...", "I retrieved...", "I searched...", "Based on my analysis...", "Here is...", "Below is...", or any sentence describing what you are about to do or just did.

════════════════════════════════════════════════════════════════════

You are a LEED v4.1 BD+C certification expert producing a gap analysis report for a project team.

════════════════════════════════════════════════════════════════════
WEB SEARCH — USE EXTENSIVELY
════════════════════════════════════════════════════════════════════

You have web search available. Use it for ALL location-dependent data:
- Transit agencies and routes serving 600 W Broadway, San Diego
- Transit stop proximity (MTS trolley, MTS bus, NCTD, Amtrak)
- Walk Score, Bike Score for the address
- Surrounding land uses and diverse use categories within ¼ mile
- Bicycle infrastructure (existing lanes, shared use paths, protected lanes)
- Census tract density (residential and employment density)
- Flood zone status (FEMA flood map)
- Wetlands, habitat, agricultural land in site vicinity
- Proximity to public open space, parks, greenways

Search multiple sources. Do not stop at the first result.

════════════════════════════════════════════════════════════════════
SCORING CONVENTIONS
════════════════════════════════════════════════════════════════════

For each credit, provide:
- CURRENT ESTIMATE: Points achievable based on known information (questionnaire answers + retrieved data)
- MAX AVAILABLE: Full point value of the credit
- STATUS: one of: Likely Achievable | Partial Credit | Requires Investigation | Not Pursuing | Prerequisite Met | Prerequisite At Risk
- GAP NOTE: What would unlock additional points, or what is uncertain

Use conservative estimates where information is incomplete. Flag every uncertain item.

Certification thresholds (LEED v4.1 BD+C):
  Certified: 40–49 pts
  Silver:    50–59 pts
  Gold:      60–79 pts  ← project target
  Platinum:  80+ pts

════════════════════════════════════════════════════════════════════
HTML FORMATTING STANDARDS
════════════════════════════════════════════════════════════════════

- Section headers: color #327cb9
- Table header rows: background #327cb9, white text, bold
- Table body: alternating white and #e8f0f7
- Table borders: 1px solid #cccccc
- Font: Arial, Helvetica, sans-serif
- Body text: #515062
- Status badges:
    "Likely Achievable" → background #d4edda, color #155724
    "Partial Credit"    → background #fff3cd, color #856404
    "Prerequisite Met"  → background #d4edda, color #155724
    "Prerequisite At Risk" → background #f8d7da, color #721c24
    "Requires Investigation" → background #e2e3e5, color #383d41
    "Not Pursuing"      → background #f8f9fa, color #6c757d

TABLES must be real HTML <table> elements with <thead>, <tbody>, <tr>, <th>, <td>. Never use plain text or markdown for tabular data.`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const t0     = Date.now();
  const usage  = { input: 0, output: 0 };
  const step   = new StepLogger();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  console.log(`\nProject: ${PROJECT_NAME}`);
  console.log(`Address: ${PROJECT_ADDRESS}`);
  console.log(`Program: ${PROGRAM_NAME}`);
  console.log(`Target:  LEED Gold (60 points)`);
  console.log(`Uploads: None — questionnaire only\n`);

  // ─── [1/4] Load LEED credit catalog ──────────────────────────────────────────
  const k1 = step.start("[1/4] Loading LEED v4.1 BD+C credit catalog from XLSX");
  const { credits, summary: creditCatalog } = loadAllLeedCredits();
  console.log(`  ✓ ${credits.length} credits/prerequisites loaded`);
  step.complete(k1);

  const sharedContext = `PROGRAM: ${PROGRAM_NAME}
PROJECT NAME: ${PROJECT_NAME}
PROJECT ADDRESS: ${PROJECT_ADDRESS}
REPORT DATE: ${today}

QUESTIONNAIRE ANSWERS:
${QUESTIONNAIRE}

FULL LEED CREDIT CATALOG:
${creditCatalog}`;

  // ─── [2/4] Pass 1 — Location research + LT / SS credits ─────────────────────
  const k2 = step.start("[2/4] Pass 1 — Location research + LT & SS credit scoring");

  let pass1Html = await streamCall(
    client,
    "Pass 1 (location + LT/SS)",
    GAP_ANALYSIS_SYSTEM_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS FOR THIS PASS:
Score ONLY the Location & Transportation (LT) and Sustainable Sites (SS) credits for this pass.
Use web search extensively to retrieve location-specific data for 600 W Broadway, San Diego, CA 92101 before scoring.

WHAT TO SEARCH FOR:
1. Transit: All MTS trolley lines and stations near this address, all MTS bus routes, Amtrak/Coaster stations. Determine which stops are within ¼ mile walking distance. Count qualifying weekday and weekend trip frequency per stop per LEED LTc5 requirements (transit trips per day).
2. Walk Score and Bike Score for 600 W Broadway, San Diego from walkscore.com
3. Diverse uses within ¼ mile: restaurants, retail, services, civic uses — enumerate all qualifying uses by LEED LTc4 categories
4. Bicycle infrastructure: protected lanes, shared-use paths, signed routes within ¼ mile of the site
5. Site context: Is this a previously developed urban infill site? Flood zone? Wetlands? Prime farmland?
6. Public open space and parks within ¼ mile
7. Surrounding residential and employment density (Census tract data)

OUTPUT FORMAT:
Produce an HTML document structured as follows:

<h1>LEED v4.1 Gap Analysis — ${PROJECT_NAME}</h1>
<p>[Project address, program, date, target certification level]</p>

<h2>SECTION A — LOCATION & TRANSPORTATION (LT)</h2>
[For each LT prerequisite and credit: credit code, name, max pts, estimated pts, status badge, scoring rationale. Organize in a single HTML table with per-credit rows, then a brief narrative for each credit explaining the score. Do NOT include the raw retrieved data (transit stop lists, diverse use inventories, density tables, etc.) — use it internally to inform your scoring estimates only. The findings belong inside individual credit deliverables, not in the gap analysis report.]

<h2>SECTION B — SUSTAINABLE SITES (SS)</h2>
[Same structure: credit table + per-credit narrative. Apply questionnaire data (previously developed site, site area 1.2 ac, parking 175 spaces, bike storage yes, EV yes, exterior lighting unknown, construction waste mgmt yes). Do NOT include raw retrieved data in the output.]

End this pass with an LT + SS subtotal table showing pts earned / pts available for each category.`,
    }],
    usage,
    40000,
  );
  ({ cleaned: pass1Html } = scrubNarration(pass1Html));
  step.complete(k2);

  // ─── [3/4] Pass 2 — WE / EA credits ─────────────────────────────────────────
  const k3 = step.start("[3/4] Pass 2 — WE & EA credit scoring");

  let pass2Html = await streamCall(
    client,
    "Pass 2 (WE/EA)",
    GAP_ANALYSIS_SYSTEM_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

LOCATION RESEARCH AND LT/SS SCORING (from Pass 1):
${pass1Html.slice(0, 20000)}

INSTRUCTIONS FOR THIS PASS:
Score the Water Efficiency (WE) and Energy & Atmosphere (EA) credits. Begin directly with the WE section heading. No recap of prior content.

WATER EFFICIENCY (WE):
Apply these questionnaire answers:
- Irrigation: High-efficiency drip/micro — likely qualifies for WE Credit 1 (outdoor water use) at some level
- No water reuse systems
- Cooling tower: present — must meet WE Credit 3 (cooling tower water use) threshold
- Fixture intent: not yet specified — cannot confirm indoor water use reduction tier

For WEp1 (Indoor Water Use prereq): prerequisite at risk — no fixture schedule yet
For WEp2 (Outdoor Water Use prereq): likely met with HE drip/micro
For WEc1: estimate based on typical HE drip — likely 1–2 pts without full fixture data
For WEc2 (Outdoor): estimate based on HE irrigation strategy
For WEc3 (Cooling tower): cooling tower present, compliance pathway achievable

ENERGY & ATMOSPHERE (EA):
Apply these questionnaire answers:
- Energy performance: 10–14% better than ASHRAE 90.1 baseline
- Enhanced CX: no (no CX authority engaged yet)
- Refrigerant: natural refrigerants
- Renewables: none
- Heating: mixed fuel; Cooling: chilled water

For EAp1 (Energy Efficiency prereq): met with 10–14% improvement
For EAp2 (Min Energy Performance): met
For EAp3 (Building-level energy metering): typically achievable, assume yes
For EAc1 (Optimize Energy Performance): 10–14% improvement = estimate pts per LEED table
  - Look up: LEED v4.1 EAc1 points table for new construction offices at 10–14% improvement
For EAc2 (Adv Energy Metering): likely achievable — 1 pt
For EAc3 (Grid Harmonization): not pursuing — 0 pts
For EAc4 (Renewable Energy): none onsite — 0 pts (unless purchasing RECs, unknown)
For EAc5 (Enhanced Commissioning): no CX authority yet — not achievable currently
For EAc6 (Enhanced Refrigerant Mgmt): natural refrigerants — likely 1 pt achievable

OUTPUT FORMAT:
<h2>SECTION C — WATER EFFICIENCY (WE)</h2>
[Credit table + per-credit narrative]

<h2>SECTION D — ENERGY & ATMOSPHERE (EA)</h2>
[Credit table + per-credit narrative. Web search for EAc1 points table if needed to confirm pts estimate at 10–14% improvement for office.]

End with WE + EA subtotal table.`,
    }],
    usage,
    32000,
  );
  ({ cleaned: pass2Html } = scrubNarration(pass2Html));
  step.complete(k3);

  // ─── [4/4] Pass 3 — MR / EQ / IN / RP + full report assembly ────────────────
  const k4 = step.start("[4/4] Pass 3 — MR, EQ, IN, RP scoring + full report assembly");

  let pass3Html = await streamCall(
    client,
    "Pass 3 (MR/EQ/IN/RP + report)",
    GAP_ANALYSIS_SYSTEM_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

PRIOR SCORING SUMMARY (from Pass 1 + Pass 2):
LT & SS scored.
WE & EA scored.

KEY SCORES SO FAR (use the actual subtotals from the prior passes when assembling the summary):
Refer to the subtotals from Pass 1 and Pass 2 when building the final summary table.

INSTRUCTIONS FOR THIS PASS:
Score Materials & Resources (MR), Indoor Environmental Quality (EQ), Innovation (IN), and Regional Priority (RP). Then assemble the full gap analysis report.

MATERIALS & RESOURCES (MR):
Apply these questionnaire answers:
- EPDs: Unknown — not yet specified
- FSC wood: Unknown
- Construction Waste Management: Yes (committed)
- Low-emitting materials: Some specified, not comprehensive

MRp1 (Storage and Collection of Recyclables): typically achievable, assume yes
MRp2 (Construction and Demolition Waste Mgmt prereq): Yes (CWM plan committed)
MRc1 (Building Life-Cycle Impact Reduction): No full demolition, existing structure retained — may qualify
MRc2 (Building Product Disclosure — EPDs): Unknown EPDs — 0 pts currently
MRc3 (Building Product Disclosure — Sourcing): Unknown FSC/responsible sourcing
MRc4 (Building Product Disclosure — Ingredients): Unknown
MRc5 (Construction and Demolition Waste): CWM plan committed — likely 1–2 pts

INDOOR ENVIRONMENTAL QUALITY (EQ):
Apply:
- Ventilation: ASHRAE 62.1 (minimum standard)
- Daylighting: Unknown — not modeled
- Acoustic: Not pursuing
- Construction IAQ Plan: Yes

EQp1 (Min IAQ Performance): ASHRAE 62.1 — prerequisite met
EQp2 (ETS Control): standard for commercial — met
EQp3 (Min Acoustic Performance): prerequisite at risk if acoustic credit not pursued
EQc1 (Enhanced IAQ Strategies): achievable with standard measures
EQc2 (Low-Emitting Materials): some specified — partial credit possible
EQc3 (Construction IAQ Mgmt Plan): Yes — 1 pt achievable
EQc4 (Indoor Air Quality Assessment): achievable post-construction
EQc5 (Thermal Comfort): typically achievable
EQc6 (Interior Lighting): typically achievable
EQc7 (Daylight): unknown — 0 pts currently
EQc8 (Quality Views): downtown San Diego location — likely achievable
EQc9 (Acoustic Performance): not pursuing — 0 pts

INNOVATION (IN):
- Integrative process charrette completed — IN Credit 1 (Integrative Design) may be achievable
- LEED AP on team — IN Credit 2 (LEED AP) = 1 pt
- Estimate 1–2 IN pts total

REGIONAL PRIORITY (RP):
Search for LEED v4.1 Regional Priority credits for San Diego, CA 92101. Regional priority credits are bonus points for credits that address regional environmental priorities. Web search for "LEED Regional Priority credits San Diego California" to identify which credits earn RP bonus points for this zip code. Estimate up to 4 RP pts if applicable credits are being pursued.

FULL REPORT ASSEMBLY:
After scoring MR/EQ/IN/RP, assemble the complete gap analysis report as a single, well-structured HTML document:

STRUCTURE:
1. <h2>SECTION E — MATERIALS & RESOURCES (MR)</h2>
2. <h2>SECTION F — INDOOR ENVIRONMENTAL QUALITY (EQ)</h2>
3. <h2>SECTION G — INNOVATION (IN) & REGIONAL PRIORITY (RP)</h2>
4. <h2>SECTION H — OVERALL SCORECARD</h2>
   A single HTML table showing ALL categories:
   | Category | Credits Available | Pts Available | Estimated Pts | Gap |
   Include LT, SS, WE, EA (using subtotals from prior passes), MR, EQ, IN, RP, and TOTAL row.

5. <h2>SECTION I — GAP TO GOLD CERTIFICATION</h2>
   - Total estimated points
   - Gap to 60-point Gold target
   - Gap to 50-point Silver target (if Gold looks tight)
   - Clear statement of certification outlook (on track / needs action)

6. <h2>SECTION J — PRIORITY CREDIT SHORTLIST</h2>
   A prioritized list of 8–12 credits that represent the best opportunity to close the gap to Gold. For each:
   - Credit code and name
   - Current estimated pts
   - Maximum achievable pts
   - What would unlock the additional pts
   - Ease of implementation: Easy / Moderate / Complex

7. <h2>SECTION K — PREREQUISITE RISK REGISTER</h2>
   List all prerequisites where status is "At Risk" or "Requires Investigation". For each:
   - Credit code, name, risk, and recommended action.

8. <h2>SECTION L — NEXT STEPS</h2>
   Recommended actions for the project team within the next 30 days to improve certification probability, organized by category.`,
    }],
    usage,
    40000,
  );
  ({ cleaned: pass3Html } = scrubNarration(pass3Html));
  step.complete(k4);

  // ─── Assemble + validate + write ──────────────────────────────────────────────
  const kOut = step.start("[output] Assembling, validating, and writing output files");

  const combined = `${pass1Html}\n\n${pass2Html}\n\n${pass3Html}`;
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
  <title>LEED v4.1 Gap Analysis — ${PROJECT_NAME}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #515062; max-width: 960px; margin: 0 auto; padding: 40px 24px; }
    h1 { color: #327cb9; }
    h2 { color: #327cb9; border-bottom: 2px solid #e8f0f7; padding-bottom: 6px; }
    h3 { color: #515062; }
  </style>
</head>
<body>
${withCss}
</body>
</html>`;

  const editableHtml = makeEditable(standardHtml);

  writeCleanFile(path.join(OUTPUT_DIR, `${SLUG}.html`),                   standardHtml, SLUG);
  writeCleanFile(path.join(OUTPUT_DIR, `${SLUG}-editable.html`),          editableHtml, `${SLUG}-editable`);
  console.log(`  ✓ Files written`);

  step.complete(kOut);

  const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
  const totalCost = ((usage.input / 1e6) * 3.00 + (usage.output / 1e6) * 15.00).toFixed(3);

  console.log("\n" + "═".repeat(60));
  console.log(`  Project:  ${PROJECT_NAME}`);
  console.log(`  Program:  ${PROGRAM_NAME}`);
  console.log(`  Target:   LEED Gold`);
  console.log(`  Elapsed:  ${elapsed}s`);
  console.log(`  Cost:     $${totalCost}`);
  console.log(`  Tokens:   in:${usage.input.toLocaleString()} / out:${usage.output.toLocaleString()}`);
  console.log("─".repeat(60));
  console.log(`  Output: ${OUTPUT_DIR}/`);
  console.log(`    ${SLUG}.html`);
  console.log(`    ${SLUG}-editable.html`);
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message ?? err);
  process.exit(1);
});
