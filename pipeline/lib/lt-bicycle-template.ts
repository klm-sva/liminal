/**
 * pipeline/lib/lt-bicycle-template.ts
 *
 * Pass 1b for LT Credit 6 — Bicycle Facilities.
 *
 * Renders the structured JSON from Pass 1a into full LEED Online Form LT108 HTML.
 * Zero AI tokens — pure JavaScript template.
 *
 * Three sections:
 *   1. Bicycle Network Connectivity
 *   2. Bicycle Storage Calculation
 *   3. Shower / Changing Facility Calculation
 */

export interface BicycleDestination {
  name:                string;
  category:            string;   // Appendix 1 category
  address:             string;
  bikingDistanceMiles: number;
  qualifies:           boolean;
}

export interface LTc6FormData {
  projectAddress:  string;
  projectName:     string;
  certProgram:     string;
  creditName:      string;
  submissionDate:  string;

  // Network connectivity
  networkDescription:       string;   // bicycle network within 200 yards of functional entry
  networkWithin200Yards:    boolean;
  destinations:             BicycleDestination[];
  totalQualifyingDest:      number;
  compliancePath:           "diverse-uses" | "school-employment" | "transit";

  // Bicycle storage
  regularOccupants:       number;
  peakVisitors:           number;
  longTermRequired:       number;   // max(5% of occupants, 4)
  longTermProvided:       number;
  longTermLocation:       string;
  longTermDrawingRef:     string;
  longTermDistanceFt:     number;   // must be ≤300 ft to functional entry
  shortTermRequired:      number;   // max(2.5% of visitors, 4)
  shortTermProvided:      number;
  shortTermLocation:      string;
  shortTermDrawingRef:    string;
  shortTermDistanceFt:    number;   // must be ≤200 ft to main entrance

  // Shower / changing
  showersRequired:     number;
  showersProvided:     number;
  showerLocation:      string;
  showerDrawingRef:    string;

  // Result
  compliant:         boolean;
  pointsEarned:      number;
  pointsAvailable:   number;
  narrativeSummary:  string;
  ownerConfirmItems: string[];
}

function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function distCheck(ft: number, limitFt: number): string {
  if (ft <= 0) return `<span style="background:#fff3cd;color:#856404;padding:0 4px;border-radius:2px;">[OWNER TO CONFIRM: verify from drawings]</span>`;
  const pass = ft <= limitFt;
  return `<span style="background:${pass ? "#d4edda" : "#f8d7da"};color:${pass ? "#155724" : "#721c24"};padding:0 4px;border-radius:2px;">${ft.toLocaleString()} ft ${pass ? "✓" : `✗ exceeds ${limitFt} ft limit`}</span>`;
}

// ─── Section 1: Network Connectivity ─────────────────────────────────────────

function networkSection(data: LTc6FormData): string {
  const qualifying = data.destinations.filter((d) => d.qualifies);

  const destRows = qualifying.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(d.name)}</td>
      <td>${esc(d.category)}</td>
      <td>${esc(d.address)}</td>
      <td class="num">${d.bikingDistanceMiles > 0 ? d.bikingDistanceMiles.toFixed(2) + " mi" : "[confirm]"}</td>
    </tr>`).join("");

  const pathLabel = {
    "diverse-uses":      "≥10 Diverse Uses within 3-mile biking distance",
    "school-employment": "School or Employment Center (≥50% residential project)",
    "transit":           "BRT / Rail / Ferry Terminal within 3-mile biking distance",
  }[data.compliancePath];

  return `
<div class="section-box">
  <h2>Section 1 — Bicycle Network Connectivity</h2>

  <div class="field-row">
    <span class="field-label">Compliance Path</span>
    <span class="field-value">${esc(pathLabel)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Bicycle Network Within 200 Yards</span>
    <span class="field-value">
      ${data.networkWithin200Yards
        ? `<span class="badge-pass">YES — Network confirmed within 200 yards (180m) of functional entry</span>`
        : `<span class="badge-fail">NOT CONFIRMED — verify network connection from drawings</span>`}
    </span>
  </div>
  <div class="field-row">
    <span class="field-label">Network Description</span>
    <span class="field-value">${esc(data.networkDescription || "[OWNER TO CONFIRM: describe network type and street name]")}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Total Qualifying Destinations</span>
    <span class="field-value">
      <strong>${data.totalQualifyingDest}</strong>
      ${data.totalQualifyingDest >= 10
        ? `<span class="badge-pass">✓ Meets ≥10 requirement</span>`
        : `<span class="badge-fail">✗ Does not meet ≥10 threshold (${data.totalQualifyingDest} found)</span>`}
    </span>
  </div>

  <table class="liminal-table" style="margin-top:12px;">
    <caption>Qualifying Diverse Uses — 3-Mile Biking Distance (Appendix 1 Categories)</caption>
    <thead>
      <tr>
        <th>#</th>
        <th>Use Name</th>
        <th>Category</th>
        <th>Address</th>
        <th>Biking Distance</th>
      </tr>
    </thead>
    <tbody>${destRows || `<tr><td colspan="5" style="text-align:center;color:#888;">[No qualifying destinations returned]</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="4"><strong>Total qualifying uses</strong></td>
        <td class="num"><strong>${qualifying.length}</strong></td>
      </tr>
    </tfoot>
  </table>
</div>`;
}

// ─── Section 2: Bicycle Storage Calculation ───────────────────────────────────

function storageSection(data: LTc6FormData): string {
  const ltMeets  = data.longTermProvided  >= data.longTermRequired;
  const stMeets  = data.shortTermProvided >= data.shortTermRequired;
  const ltDist   = distCheck(data.longTermDistanceFt,  300);
  const stDist   = distCheck(data.shortTermDistanceFt, 200);

  return `
<div class="section-box">
  <h2>Section 2 — Bicycle Storage Calculation</h2>

  <div class="field-row">
    <span class="field-label">Regular Occupants</span>
    <span class="field-value">${data.regularOccupants > 0 ? esc(data.regularOccupants) : `<span style="background:#fff3cd;color:#856404;padding:0 4px;border-radius:2px;">[OWNER TO CONFIRM: from registration data]</span>`}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Peak Visitors</span>
    <span class="field-value">${data.peakVisitors > 0 ? esc(data.peakVisitors) : `<span style="background:#fff3cd;color:#856404;padding:0 4px;border-radius:2px;">[OWNER TO CONFIRM: from registration data]</span>`}</span>
  </div>

  <table class="liminal-table" style="margin-top:12px;">
    <caption>Bicycle Storage Requirements vs. Provided</caption>
    <thead>
      <tr>
        <th>Storage Type</th>
        <th>Calculation</th>
        <th>Required</th>
        <th>Provided</th>
        <th>Drawing Ref</th>
        <th>Distance to Entry</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Long-term</strong><br/><span style="font-size:11px;color:#666;">secured, covered</span></td>
        <td style="font-size:11px;">5% × ${data.regularOccupants || "[occupants]"} occupants, min 4</td>
        <td class="num">${data.longTermRequired || "—"}</td>
        <td class="num">${data.longTermProvided > 0 ? data.longTermProvided : `<span style="background:#fff3cd;color:#856404;padding:0 4px;border-radius:2px;">[confirm]</span>`}</td>
        <td style="font-size:11px;">${esc(data.longTermDrawingRef || "[OWNER TO CONFIRM: drawing sheet ref]")}</td>
        <td>${ltDist}<br/><span style="font-size:10px;color:#888;">limit: ≤300 ft to functional entry</span></td>
        <td>${ltMeets && data.longTermProvided > 0 ? `<span class="badge-pass">✓ MEETS</span>` : `<span class="badge-fail">✗ FAILS</span>`}</td>
      </tr>
      <tr>
        <td><strong>Short-term</strong><br/><span style="font-size:11px;color:#666;">visible, accessible</span></td>
        <td style="font-size:11px;">2.5% × ${data.peakVisitors || "[visitors]"} peak visitors, min 4</td>
        <td class="num">${data.shortTermRequired || "—"}</td>
        <td class="num">${data.shortTermProvided > 0 ? data.shortTermProvided : `<span style="background:#fff3cd;color:#856404;padding:0 4px;border-radius:2px;">[confirm]</span>`}</td>
        <td style="font-size:11px;">${esc(data.shortTermDrawingRef || "[OWNER TO CONFIRM: drawing sheet ref]")}</td>
        <td>${stDist}<br/><span style="font-size:10px;color:#888;">limit: ≤200 ft to main entrance</span></td>
        <td>${stMeets && data.shortTermProvided > 0 ? `<span class="badge-pass">✓ MEETS</span>` : `<span class="badge-fail">✗ FAILS</span>`}</td>
      </tr>
    </tbody>
  </table>

  <div class="field-row" style="margin-top:12px;">
    <span class="field-label">Long-term Storage Location</span>
    <span class="field-value">${esc(data.longTermLocation || "[OWNER TO CONFIRM: describe location from drawings]")}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Short-term Storage Location</span>
    <span class="field-value">${esc(data.shortTermLocation || "[OWNER TO CONFIRM: describe location from drawings]")}</span>
  </div>
</div>`;
}

// ─── Section 3: Shower / Changing Facility Calculation ───────────────────────

function showerSection(data: LTc6FormData): string {
  const showerMeets = data.showersProvided >= data.showersRequired;

  return `
<div class="section-box">
  <h2>Section 3 — Shower and Changing Facility Calculation</h2>

  <div class="field-row">
    <span class="field-label">Regular Occupants</span>
    <span class="field-value">${data.regularOccupants > 0 ? esc(data.regularOccupants) : `<span style="background:#fff3cd;color:#856404;padding:0 4px;border-radius:2px;">[OWNER TO CONFIRM]</span>`}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Showers Required</span>
    <span class="field-value">${data.showersRequired > 0 ? `<strong>${data.showersRequired}</strong> (per LEED v4.1 LT Credit 6 formula)` : `<span style="background:#fff3cd;color:#856404;padding:0 4px;border-radius:2px;">[calculated from occupant count]</span>`}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Showers Provided</span>
    <span class="field-value">
      ${data.showersProvided > 0
        ? `<strong>${data.showersProvided}</strong> — ${esc(data.showerDrawingRef || "[drawing ref]")} — ${showerMeets ? `<span class="badge-pass">✓ MEETS REQUIREMENT</span>` : `<span class="badge-fail">✗ INSUFFICIENT</span>`}`
        : `<span style="background:#fff3cd;color:#856404;padding:0 4px;border-radius:2px;">[OWNER TO CONFIRM: from plumbing fixture schedule]</span>`}
    </span>
  </div>
  <div class="field-row">
    <span class="field-label">Shower / Changing Room Location</span>
    <span class="field-value">${esc(data.showerLocation || "[OWNER TO CONFIRM: describe from architectural floor plans]")}</span>
  </div>
</div>`;
}

// ─── Main template ────────────────────────────────────────────────────────────

export function renderLTc6Form(data: LTc6FormData, mapHtml: string): string {
  const ownerItems = (data.ownerConfirmItems ?? []).length > 0
    ? `<div class="owner-box"><strong>Owner / Project Team — Action Required</strong><ul>${
        data.ownerConfirmItems.map((i) => `<li>[OWNER TO CONFIRM: ${esc(i)}]</li>`).join("")
      }</ul></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(data.creditName)} — ${esc(data.projectAddress)}</title>
  <style>
    :root { --primary: #2b4044; --accent: #327cb9; --border: #dee2e6; --bg: #f8f9fa; }
    body  { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 24px; background: #fff; }
    h1    { font-size: 18px; color: var(--primary); border-bottom: 2px solid var(--primary); padding-bottom: 8px; }
    h2    { font-size: 14px; color: var(--primary); margin-top: 24px; }
    .section-box { border: 1px solid var(--border); border-radius: 4px; padding: 16px; margin-bottom: 16px; background: var(--bg); }
    .field-row   { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .field-label { font-weight: bold; min-width: 240px; color: #444; font-size: 12px; }
    .field-value { flex: 1; border-bottom: 1px solid #ccc; padding-bottom: 2px; min-height: 18px; }
    .badge-pass  { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 3px; padding: 2px 8px; font-weight: bold; font-size: 11px; }
    .badge-fail  { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 3px; padding: 2px 8px; font-weight: bold; font-size: 11px; }
    .owner-box   { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin: 12px 0; }
    .owner-box strong { color: #856404; }
    table.liminal-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    table.liminal-table caption { font-weight: bold; text-align: left; margin-bottom: 4px; color: #333; }
    table.liminal-table th  { background: var(--primary); color: white; padding: 6px 8px; text-align: left; }
    table.liminal-table td  { padding: 5px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
    table.liminal-table tfoot td { background: #e8f0f7; font-size: 11px; padding: 4px 8px; }
    table.liminal-table tr:nth-child(even) td { background: #f2f5f6; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>

<h1>${esc(data.creditName)}</h1>

<div class="section-box">
  <h2>Project Information</h2>
  <div class="field-row"><span class="field-label">Project Address</span><span class="field-value">${esc(data.projectAddress)}</span></div>
  <div class="field-row"><span class="field-label">Certification Program</span><span class="field-value">${esc(data.certProgram)}</span></div>
  <div class="field-row"><span class="field-label">Submission Date</span><span class="field-value">${esc(data.submissionDate)}</span></div>
</div>

<div class="section-box">
  <h2>Points Determination</h2>
  <div class="field-row">
    <span class="field-label">Points Earned</span>
    <span class="field-value">
      <strong>${data.pointsEarned}</strong> / ${data.pointsAvailable} available
      ${data.compliant
        ? `<span class="badge-pass">COMPLIANT — ${data.pointsEarned} Point${data.pointsEarned !== 1 ? "s" : ""} Earned</span>`
        : `<span class="badge-fail">NOT COMPLIANT — Requirements Not Met</span>`}
    </span>
  </div>
</div>

${networkSection(data)}

<div class="section-box">
  <h2>Bicycle Network Map</h2>
  <p style="font-size:11px;color:#666;margin-bottom:8px;">
    Map shows project boundary, functional entries, bicycle storage locations, and bicycle routes to all qualifying destinations within 3-mile biking distance.
    Scale bar and north arrow included. Biking distances measured along bicycle network.
  </p>
  ${mapHtml}
</div>

${storageSection(data)}
${showerSection(data)}

<div class="section-box">
  <h2>Narrative Summary</h2>
  <p>${esc(data.narrativeSummary)}</p>
</div>

${ownerItems}

</body>
</html>`;
}
