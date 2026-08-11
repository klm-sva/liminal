/**
 * pipeline/lib/calculator-guide.ts — updated
 *
 * Universal Calculator Input Guide generator.
 *
 * When automation analysis says a calculator is required, this module:
 *   1. Finds the matching schema from leed_v41_calculator_schemas.json
 *   2. Makes one Claude call to extract all field values from project data
 *   3. Renders a 4-section HTML guide appended to both output files
 *
 * No Excel files are touched — this is the permanent replacement for
 * all populate_calculator.py / openpyxl work.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";

const CALC_SCHEMA_PATH = path.join(process.cwd(), "pipeline/reference/leed/leed_v41_calculator_schemas.json");

export interface CalcGuideResult {
  html:               string;
  calculatorName:     string;
  tabCount:           number;
  fieldCount:         number;
  ownerConfirmCount:  number;
  skipped:            boolean;
  skipReason?:        string;
}

interface CalcSchema {
  id:       string;
  name:     string;
  credits:  string[];
  tabs:     string[];
  [key: string]: unknown;
}

interface GuideEntry {
  tab:         string;
  context?:    string;   // e.g. "AHU-3 / Zone: Gymnasium"
  field_label: string;
  value:       string | number | null;
  unit?:       string;
  source:      string;   // "mechanical drawings" | "project profile" | "auto-retrieved" | "[OWNER TO CONFIRM: ...]"
}

// ── Schema resolution (same two-pass logic as calculator.ts) ──────────────────

function cc(s: string): string {
  return s.toLowerCase()
    .replace(/prerequisite/g, "prereq")  // "EQ Prerequisite 1" → "eqprereq1" matches schema credit "EQ Prereq 1"
    .replace(/[^a-z0-9]/g, "");
}

function findSchemaForCredit(creditName: string, schemas: Record<string, CalcSchema>): CalcSchema | null {
  const nameNorm = cc(creditName);

  for (const schema of Object.values(schemas)) {
    if (schema.credits.some((c) => nameNorm.includes(cc(c)))) return schema;
  }
  // Generic words that appear in many credit names — exclude from fuzzy matching
  const STOP_WORDS = new Set([
    "management", "performance", "materials", "building", "project",
    "credit", "calculator", "worksheet", "systems", "reduction",
    "enhanced", "minimum", "fundamental", "indoor", "outdoor",
  ]);

  for (const schema of Object.values(schemas)) {
    if (nameNorm.includes(cc(schema.id))) return schema;
    const schemaWords = schema.name.toLowerCase().split(/\W+/)
      .filter((w) => w.length > 5 && !STOP_WORDS.has(w));
    if (schemaWords.some((w) => nameNorm.includes(w))) return schema;
  }
  return null;
}

// ── Calculator access URL extraction ─────────────────────────────────────────

function extractCalculatorUrl(creditRow: string): string {
  // Look for any URL in the creditRow (automation analysis often lists a USGBC download link)
  const urlMatch = creditRow.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch) return urlMatch[0];

  // Fallback — USGBC resources page
  return "https://www.usgbc.org/resources";
}

// ── Claude extraction call ────────────────────────────────────────────────────

async function extractGuideEntries(
  client:      Anthropic,
  schema:      CalcSchema,
  projectData: string,
  usage:       { input: number; output: number },
): Promise<GuideEntry[]> {

  // Skip non-input tabs. For BPDO, also skip tabs that auto-pull from Materials
  // (Sourcing of Raw Materials, Material Ingredients, Reference) — user enters Materials + EPD only.
  const skipTabs  = new Set([
    "instructions", "instructions bd+c", "instructions id+c",
    "lookups", "reference", "summary",
    "sourcing of raw materials", "material ingredients",
  ]);
  const inputTabs = schema.tabs.filter((t) => !skipTabs.has(t.toLowerCase()));

  // Collect all input field lists from the schema
  const fieldContext = Object.entries(schema)
    .filter(([k, v]) => k.toLowerCase().includes("input") && Array.isArray(v))
    .map(([k, v]) => `${k}:\n${(v as string[]).map((f) => `  - ${f}`).join("\n")}`)
    .join("\n\n");

  const validOccupancy = (schema.validOccupancyCategoryInputs as string[] | undefined) ?? [];
  const occupancyNote  = validOccupancy.length > 0
    ? `\nVALID OCCUPANCY CATEGORY STRINGS (use exact spelling including trailing spaces):\n${validOccupancy.map((s) => `  "${s}"`).join("\n")}`
    : "";

  const prompt = `You are producing a Calculator Input Guide for the LEED ${schema.name}.

CALCULATOR SCHEMA — input fields required:
${fieldContext}
${occupancyNote}

INPUT TABS TO POPULATE (skip Instructions, Summary, Lookups):
${inputTabs.join(", ")}

PROJECT DATA:
${projectData.slice(0, 50000)}

Return ONLY a valid JSON array (no markdown, no explanation) of entry objects.
Each object has these exact keys:
  "tab"         — exact tab name from INPUT TABS list above
  "context"     — (optional) grouping context, e.g. "AHU-3" or "AHU-3 / Zone: Gymnasium"
  "field_label" — exact field name as listed in the schema inputs
  "value"       — the value extracted from project data (string or number), or null if unknown
  "unit"        — unit of measure if applicable (e.g. "cfm", "sq ft", "people"), else ""
  "source"      — one of:
                    "mechanical drawings"  — value read directly from drawing
                    "project profile"      — project name, address, date, owner
                    "auto-retrieved"       — ASHRAE tables, EPA data, built-in calculator logic
                    "[OWNER TO CONFIRM: <brief description>]"  — only if truly unknown

Rules:
- Emit one entry per field per zone / system. For multi-zone systems, repeat the zone-level fields for every zone.
- Include EVERY zone, fixture, space, or system found in the project data — be exhaustive.
- For Occupancy Category fields: use the exact string from VALID OCCUPANCY CATEGORY STRINGS above.
- Do NOT include auto-calculated fields (Rp, Ra, Vbz, Ez, Voz, Ev, Vot, Zpz, D, Vou) — those compute in Excel.
- Numbers without quotes; strings in quotes; null for truly unknown values.
- The "value" key must never be omitted — use null if no value is available.`;

  // Use streaming — required for large max_tokens responses (SDK enforces this above ~10 min)
  const stream = client.messages.stream({
    model:       "claude-sonnet-4-6",
    max_tokens:  16000,
    temperature: 0,
    messages:    [{ role: "user", content: prompt }],
  });

  let text = "";
  stream.on("text", (chunk: string) => { text += chunk; });
  const final = await stream.finalMessage();

  usage.input  += final.usage.input_tokens;
  usage.output += final.usage.output_tokens;

  text = text.trim();

  const start = text.indexOf("[");
  const end   = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Calculator guide extraction: Claude did not return a JSON array");
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as GuideEntry[];
  } catch {
    throw new Error(`Calculator guide extraction: JSON parse failed — ${text.slice(start, start + 200)}`);
  }
}

// ── HTML rendering ────────────────────────────────────────────────────────────

const PRIMARY   = "#327cb9";
const LIGHT_BG  = "#abcde8";
const PALE_BG   = "#f7fafd";
const BODY_TEXT = "#515062";
const WHITE     = "#ffffff";

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sourceLabel(source: string): string {
  if (!source) return "";
  if (source.startsWith("[OWNER TO CONFIRM")) {
    return `<span style="color:#856404;font-weight:600;">${esc(source)}</span>`;
  }
  const labels: Record<string, string> = {
    "mechanical drawings": "Mechanical drawings",
    "project profile":     "Project profile",
    "auto-retrieved":      "Auto-retrieved",
  };
  const label = labels[source.toLowerCase()] ?? esc(source);
  return `<span style="color:#6b7e82;">${label}</span>`;
}

function renderGuideHtml(
  schema:      CalcSchema,
  entries:     GuideEntry[],
  creditRow:   string,
): string {
  const calcUrl  = extractCalculatorUrl(creditRow);
  const tabOrder = schema.tabs.filter((t) => {
    const tl = t.toLowerCase();
    return !["instructions", "summary"].includes(tl);
  });

  // Group entries by tab
  const byTab = new Map<string, GuideEntry[]>();
  for (const entry of entries) {
    if (!byTab.has(entry.tab)) byTab.set(entry.tab, []);
    byTab.get(entry.tab)!.push(entry);
  }

  // Use schema tab order; add any unseen tabs at the end
  const renderedTabs: string[] = [];
  const seenTabs = new Set<string>();
  const tabRenderOrder = [
    ...tabOrder,
    ...[...byTab.keys()].filter((t) => !tabOrder.includes(t)),
  ];

  for (const tab of tabRenderOrder) {
    if (seenTabs.has(tab)) continue;
    seenTabs.add(tab);
    const tabEntries = byTab.get(tab);
    if (!tabEntries || tabEntries.length === 0) continue;

    // Group by context within the tab
    const byContext = new Map<string, GuideEntry[]>();
    for (const e of tabEntries) {
      const key = e.context ?? "";
      if (!byContext.has(key)) byContext.set(key, []);
      byContext.get(key)!.push(e);
    }

    let contextBlocks = "";
    for (const [ctx, ctxEntries] of byContext) {
      const ctxHeader = ctx
        ? `<tr><td colspan="5" style="background:${LIGHT_BG};font-weight:600;padding:6px 10px;font-size:12px;color:${BODY_TEXT};">${esc(ctx)}</td></tr>`
        : "";
      const rows = ctxEntries.map((e) => {
        const valueDisplay = e.value === null
          ? `<span style="color:#856404;">—</span>`
          : `<strong>${esc(e.value)}</strong>`;
        return `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;color:${BODY_TEXT};font-size:13px;">${esc(e.field_label)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:13px;">${valueDisplay}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:12px;color:#6b7e82;">${esc(e.unit ?? "")}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:12px;">${sourceLabel(e.source)}</td>
          </tr>`;
      }).join("\n");
      contextBlocks += ctxHeader + rows;
    }

    renderedTabs.push(`
      <div style="margin-bottom:24px;">
        <div style="background:${LIGHT_BG};border-radius:4px 4px 0 0;padding:8px 14px;font-weight:700;font-size:14px;color:${BODY_TEXT};">
          Tab: ${esc(tab)}
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #cccccc;border-top:none;font-family:sans-serif;">
          <thead>
            <tr style="background:${PALE_BG};">
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:34%;">Field Label</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:28%;">Value to Enter</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:10%;">Unit</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:28%;">Source</th>
            </tr>
          </thead>
          <tbody>
            ${contextBlocks}
          </tbody>
        </table>
      </div>`);
  }

  // Section 3 — Completion checklist
  const checkItems = entries.map((e) => {
    const label = e.context ? `${e.context} — ${e.field_label}` : e.field_label;
    return `<li style="margin:4px 0;font-size:13px;color:${BODY_TEXT};">
        <label style="cursor:pointer;">
          <input type="checkbox" style="margin-right:8px;"/>
          ${esc(label)}
          ${e.value !== null ? `<span style="color:#155724;font-size:12px;"> — ${esc(e.value)}</span>` : `<span style="color:#856404;font-size:12px;"> — <em>confirm with owner</em></span>`}
        </label>
      </li>`;
  }).join("\n");

  const ownerConfirmCount = entries.filter((e) => e.source?.startsWith("[OWNER TO CONFIRM")).length;
  const ownerNote = ownerConfirmCount > 0
    ? `<p style="margin:8px 0 0;font-size:12px;color:#856404;"><strong>${ownerConfirmCount} field(s) require owner confirmation</strong> — shown with [OWNER TO CONFIRM] label above.</p>`
    : "";

  return `
<div style="margin-top:40px;border:2px solid ${PRIMARY};border-radius:6px;overflow:hidden;font-family:sans-serif;">

  <!-- Header -->
  <div style="background:${PRIMARY};padding:14px 20px;">
    <h2 style="margin:0;color:${WHITE};font-size:18px;font-weight:700;">
      Calculator Input Guide — ${esc(schema.name)}
    </h2>
    <div style="color:${LIGHT_BG};font-size:13px;margin-top:4px;">
      LEED Credit: ${esc(schema.credits.join(", "))} &nbsp;·&nbsp; Version: ${esc(String(schema.version ?? ""))}
    </div>
  </div>

  <div style="padding:20px;background:${WHITE};">

    <!-- Section 1 — Instructions -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
      <h3 style="margin:0 0 8px;color:${PRIMARY};font-size:15px;">Section 1 — Instructions</h3>
      <p style="margin:0;font-size:13px;color:${BODY_TEXT};line-height:1.6;">
        Open the official USGBC ${esc(schema.name)} from the Calculator Access section below.
        Enter the values shown in the tab-by-tab tables into the corresponding cells.
        Fields marked <strong>[OWNER TO CONFIRM]</strong> require site-specific data from the project team.
        Do not manually enter auto-calculated values (highlighted in yellow in the calculator) — those compute automatically from your inputs.
        After entering all values, verify that the formula cells recalculate and review the Summary tab for compliance status.
      </p>
    </div>

    <!-- Section 2 — Tab-by-tab input tables -->
    <h3 style="margin:0 0 14px;color:${PRIMARY};font-size:15px;">Section 2 — Input Values by Tab</h3>
    ${renderedTabs.join("\n")}

    <!-- Section 3 — Completion checklist -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
      <h3 style="margin:0 0 10px;color:${PRIMARY};font-size:15px;">Section 3 — Completion Checklist</h3>
      <ul style="margin:0;padding:0 0 0 4px;list-style:none;">
        ${checkItems}
        <li style="margin:10px 0 4px;font-size:13px;color:${BODY_TEXT};border-top:1px solid #cccccc;padding-top:10px;">
          <label style="cursor:pointer;">
            <input type="checkbox" style="margin-right:8px;"/>
            <strong>Verify all formula cells recalculate correctly</strong> — check Summary tab for compliance status before submitting
          </label>
        </li>
      </ul>
      ${ownerNote}
    </div>

    <!-- Section 4 — Calculator Access -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;">
      <h3 style="margin:0 0 8px;color:${PRIMARY};font-size:15px;">Section 4 — Calculator Access</h3>
      <p style="margin:0;font-size:13px;color:${BODY_TEXT};">
        Download the official calculator from USGBC:
        <a href="${esc(calcUrl)}" style="color:${PRIMARY};font-weight:600;" target="_blank">${esc(calcUrl)}</a>
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7e82;">
        Calculator: <strong>${esc(schema.name)}</strong> (${esc(String(schema.version ?? ""))}).
        Upload the completed file to LEED Online under the documentation tab for ${esc(schema.credits.join(", "))}.
      </p>
    </div>

  </div>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateCalculatorGuide(
  client:      Anthropic,
  creditRow:   string,
  creditName:  string,
  projectData: string,
  usage:       { input: number; output: number },
): Promise<CalcGuideResult | null> {

  if (!creditRow.toLowerCase().includes("calculator")) {
    return null;
  }

  const rawSchemas: Record<string, unknown> = fs.existsSync(CALC_SCHEMA_PATH)
    ? JSON.parse(fs.readFileSync(CALC_SCHEMA_PATH, "utf-8"))
    : {};
  const schemas = ((rawSchemas).calculators ?? {}) as Record<string, CalcSchema>;
  const schema  = findSchemaForCredit(creditName, schemas);
  if (!schema) {
    const reason = `No calculator schema matched: credit="${creditName}"`;
    console.warn(`  [calc-guide] ⚠ ${reason}`);
    return {
      html: skippedHtml(creditName, reason),
      calculatorName:    creditName,
      tabCount:          0,
      fieldCount:        0,
      ownerConfirmCount: 0,
      skipped:           true,
      skipReason:        reason,
    };
  }

  console.log(`\n  [calc-guide] Generating Input Guide for ${schema.name}`);
  console.log(`  [calc-guide] Extracting field values from project data...`);

  const entries = await extractGuideEntries(client, schema, projectData, usage);

  const tabsPresent      = [...new Set(entries.map((e) => e.tab))];
  const fieldCount       = entries.length;
  const ownerConfirmCount = entries.filter((e) => e.source?.startsWith("[OWNER TO CONFIRM")).length;

  console.log(`  [calc-guide] ✓ ${fieldCount} entries across ${tabsPresent.length} tab(s), ${ownerConfirmCount} owner-confirm`);

  const html = renderGuideHtml(schema, entries, creditRow);

  return {
    html,
    calculatorName:     schema.name,
    tabCount:           tabsPresent.length,
    fieldCount,
    ownerConfirmCount,
    skipped:            false,
  };
}

function skippedHtml(creditName: string, reason: string): string {
  return `
<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:12px;margin:8px 0;font-family:sans-serif;">
  <strong style="color:#856404;">⚠ Calculator Input Guide — Manual Step Required</strong><br/>
  <span style="font-size:12px;color:#6b7e82;">
    A calculator is required for ${esc(creditName)} but could not be auto-populated.<br/>
    Reason: ${esc(reason)}<br/>
    Download the official calculator from <a href="https://www.usgbc.org/resources" style="color:#327cb9;">usgbc.org/resources</a> and complete manually.
  </span>
</div>`;
}
