/**
 * pipeline/lib/lt-transit-template.ts
 *
 * Pass 1b for LT Credit 5 — Access to Quality Transit.
 *
 * Claude returns a compact JSON object via Pass 1a (web search, ~2000–4000 tokens).
 * This module renders that JSON into a full LEED Online Form HTML section.
 * Zero AI time — pure JavaScript template.
 *
 * The CreditLocation interface matches the structured locations array returned
 * by Pass 1a exactly. Walking distances (feet, minutes) are updated by the
 * Google Maps pipeline after Pass 1a and before rendering.
 */

export interface CreditLocation {
  name:                   string;
  address:                string;
  type:                   "transit_stop" | "bicycle_facility" | "diverse_use" | "other";
  transit_type:           "bus" | "BRT" | "light_rail" | "heavy_rail" | "commuter_rail" | "ferry" | null;
  walking_distance_miles: number;
  walking_distance_feet:  number;
  weekday_trips:          number;
  weekend_trips:          number;
  qualifies:              boolean;
  points_contributed:     number;
  data_source:            string;
  // Optional extension fields — Claude may include these
  routes?:                string[];
  transit_agency?:        string;
  // Populated by Google Maps pipeline after route calculation
  duration_minutes?:      number;
  // Weekday departure times by route — sourced directly from GTFS stop_times.txt
  weekdaySchedule?:       Array<{ route: string; times: string[]; count: number }>;
}

export interface LTc5FormData {
  // Project info
  projectName:    string;
  projectAddress: string;
  certProgram:    string;
  creditName:     string;
  submissionDate: string;

  // Path selected
  path: "1" | "2";

  // Locations returned by Pass 1a (web search) + enriched by Google Maps
  locations:      CreditLocation[];
  totalQualifying: number;
  pointsEarned:   number;
  pointsAvailable: number;
  thresholdMet:   boolean;

  // Free-text fields from Pass 1a JSON
  narrativeSummary:    string;
  complianceStatement: string;

  // Owner-confirm items (site-specific, not auto-retrievable)
  ownerConfirmItems:   string[];
}

// ─── Table 1 — Trip Count Threshold ──────────────────────────────────────────

function table1Html(locations: CreditLocation[]): string {
  const rows = locations.map((loc, i) => {
    const directional    = Math.round(loc.weekday_trips / 2);
    const wkndDirection  = loc.weekend_trips > 0 ? Math.round(loc.weekend_trips / 2) : 0;
    const routeLabel     = loc.routes?.join(", ") ?? loc.transit_type ?? "—";
    const distLabel      = loc.walking_distance_feet > 0
      ? `${loc.walking_distance_feet.toLocaleString()} ft${loc.duration_minutes ? ` (${loc.duration_minutes} min)` : ""}`
      : `${(loc.walking_distance_miles * 5280).toFixed(0)} ft est.`;

    return `<tr>
      <td>${i + 1}</td>
      <td>${escHtml(loc.name)}</td>
      <td>${escHtml(routeLabel)}</td>
      <td class="num">${distLabel}</td>
      <td class="num">${directional}</td>
      <td class="num">${wkndDirection || "—"}</td>
      <td class="center">${loc.qualifies ? "✓" : "—"}</td>
    </tr>`;
  }).join("\n");

  return `
<table class="liminal-table" id="ltc5-trip-count-table">
  <caption>Table 1 — Qualifying Transit Stops: Weekday Trip Count</caption>
  <thead>
    <tr>
      <th>#</th>
      <th>Stop Name</th>
      <th>Routes / Type</th>
      <th>Walking Distance</th>
      <th>Weekday Directional Trips</th>
      <th>Weekend Directional Trips</th>
      <th>Qualifies?</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Main template ────────────────────────────────────────────────────────────

export function renderLTc5Form(data: LTc5FormData, mapHtml: string): string {
  const qualifyingLocations = data.locations.filter((l) => l.qualifies);

  const ownerItems = data.ownerConfirmItems.length > 0
    ? `<ul>${data.ownerConfirmItems.map((item) => `<li>[OWNER TO CONFIRM: ${escHtml(item)}]</li>`).join("")}</ul>`
    : `<p><em>No owner-confirmation items required for this credit path.</em></p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(data.creditName)} — ${escHtml(data.projectName)}</title>
  <style>
    :root {
      --color-primary: #2b4044;
      --color-accent:  #327cb9;
      --color-bg:      #f8f9fa;
      --color-border:  #dee2e6;
    }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 24px; background: #fff; }
    h1   { font-size: 18px; color: var(--color-primary); border-bottom: 2px solid var(--color-primary); padding-bottom: 8px; }
    h2   { font-size: 14px; color: var(--color-primary); margin-top: 24px; }
    .section-box { border: 1px solid var(--color-border); border-radius: 4px; padding: 16px; margin-bottom: 16px; background: var(--color-bg); }
    .field-row   { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .field-label { font-weight: bold; min-width: 200px; color: #444; font-size: 12px; }
    .field-value { flex: 1; border-bottom: 1px solid #ccc; padding-bottom: 2px; min-height: 18px; }
    .badge-pass  { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 3px; padding: 2px 8px; font-weight: bold; }
    .badge-fail  { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 3px; padding: 2px 8px; font-weight: bold; }
    .owner-box   { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin: 12px 0; }
    .owner-box strong { color: #856404; }
    table.liminal-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    table.liminal-table th { background: var(--color-primary); color: white; padding: 6px 8px; text-align: left; }
    table.liminal-table td { padding: 5px 8px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
    table.liminal-table tr:nth-child(even) td { background: #f2f5f6; }
    td.num    { text-align: right; font-variant-numeric: tabular-nums; }
    td.center { text-align: center; }
  </style>
</head>
<body>

<h1>${escHtml(data.creditName)}</h1>

<div class="section-box">
  <h2>Project Information</h2>
  <div class="field-row"><span class="field-label">Project Name / Address</span><span class="field-value">${escHtml(data.projectAddress)}</span></div>
  <div class="field-row"><span class="field-label">Certification Program</span><span class="field-value">${escHtml(data.certProgram)}</span></div>
  <div class="field-row"><span class="field-label">Credit</span><span class="field-value">${escHtml(data.creditName)}</span></div>
  <div class="field-row"><span class="field-label">Submission Date</span><span class="field-value">${escHtml(data.submissionDate)}</span></div>
</div>

<div class="section-box">
  <h2>Compliance Path</h2>
  <div class="field-row">
    <span class="field-label">Path Selected</span>
    <span class="field-value">
      Path ${escHtml(data.path)} — ${data.path === "1"
        ? "Proximity to Transit (≥ 100 weekday directional trips within 0.5 mile)"
        : "Proximity to Commuter Rail or Ferry (see threshold table)"}
    </span>
  </div>
</div>

<div class="section-box">
  <h2>Qualifying Transit Stops</h2>
  <p>
    <strong>${qualifyingLocations.length}</strong> qualifying transit stop(s) identified within 0.5-mile walking distance of the project functional entry.
    Directional trip counts = total weekday trips ÷ 2 (one direction of service), per LEED v4.1 LT Credit 5 Table 1.
  </p>
  ${table1Html(data.locations)}
</div>

<div class="section-box">
  <h2>Walking Distance Map</h2>
  ${mapHtml}
</div>

<div class="section-box">
  <h2>Points Determination</h2>
  <div class="field-row">
    <span class="field-label">Qualifying Stops Found</span>
    <span class="field-value">${qualifyingLocations.length} (threshold: ≥ 1 required for 1 point)</span>
  </div>
  <div class="field-row">
    <span class="field-label">Points Earned</span>
    <span class="field-value"><strong>${data.pointsEarned}</strong> / ${data.pointsAvailable} available</span>
  </div>
  <div class="field-row">
    <span class="field-label">Compliance Status</span>
    <span class="field-value">
      ${data.thresholdMet
        ? `<span class="badge-pass">COMPLIANT — Threshold Met</span>`
        : `<span class="badge-fail">NOT COMPLIANT — Threshold Not Met</span>`}
    </span>
  </div>
</div>

<div class="section-box">
  <h2>Narrative Summary</h2>
  <p>${escHtml(data.narrativeSummary)}</p>
</div>

<div class="section-box">
  <h2>Compliance Statement</h2>
  <p>${escHtml(data.complianceStatement)}</p>
</div>

${data.ownerConfirmItems.length > 0 ? `
<div class="owner-box">
  <strong>Owner / Project Team — Action Required</strong>
  ${ownerItems}
</div>
` : ""}

</body>
</html>`;
}
