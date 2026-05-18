/**
 * pipeline/lib/lt-density-uses-template.ts
 *
 * Pass 1b for LT Credit 4 — Surrounding Density and Diverse Uses.
 *
 * Claude returns a compact JSON object via Pass 1a (web search).
 * This module renders that JSON into the full LEED Online Form LT104 HTML.
 * Zero AI tokens — pure JavaScript template.
 */

export interface DiverseUse {
  name:                 string;
  address:              string;
  category:             string;
  walkingDistanceFeet:  number;
  walkingDistanceMiles: number;
  qualifiesOption2:     boolean;
}

export interface LTc4FormData {
  // Project info
  projectAddress:    string;
  projectUseType:    string;
  grossFloorAreaSqFt: number;
  dwellingUnits:     number;
  submissionDate:    string;
  certProgram:       string;
  creditName:        string;

  // Options pursued
  pursueOption1:     boolean;
  pursueOption2:     boolean;
  pursueOption3:     boolean;

  // Option 1 — Surrounding Density
  censusTract:              string;
  residentialDensityDuAcre: number;
  nonResidentialFAR:        number;
  combinedDensitySqFtAcre:  number;
  buildableLandAcres:        number;
  pointsOption1:             number;

  // Option 2 — Diverse Uses
  diverseUses:    DiverseUse[];
  pointsOption2:  number;

  // Option 3 — Walkable Location
  walkScore:       number;
  walkScoreSource: string;
  pointsOption3:   number;

  // Final
  pointsEarned:      number;
  pointsAvailable:   number;
  narrativeSummary:  string;
  ownerConfirmItems: string[];
}

function escHtml(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Option 2 diverse uses table ─────────────────────────────────────────────

function diverseUsesTableHtml(uses: DiverseUse[]): string {
  const qualifying = uses.filter((u) => u.qualifiesOption2);
  const rows = qualifying.map((u, i) => {
    const distFt = u.walkingDistanceFeet > 0
      ? `${u.walkingDistanceFeet.toLocaleString()} ft`
      : `${Math.round(u.walkingDistanceMiles * 5280).toLocaleString()} ft est.`;
    const distM = u.walkingDistanceFeet > 0
      ? `${Math.round(u.walkingDistanceFeet * 0.3048)} m`
      : `${Math.round(u.walkingDistanceMiles * 1609)} m est.`;
    return `<tr>
      <td>${i + 1}</td>
      <td>${escHtml(u.name)}</td>
      <td>${escHtml(u.address)}</td>
      <td>${escHtml(u.category)}</td>
      <td class="num">${distFt} / ${distM}</td>
    </tr>`;
  }).join("\n");

  // Category diversity summary
  const categorySet = new Set(qualifying.map((u) => u.category));
  const categories = Array.from(categorySet);

  return `
<table class="liminal-table" id="ltc4-diverse-uses-table">
  <caption>Option 2 — Qualifying Diverse Uses within ½-Mile Walking Distance</caption>
  <thead>
    <tr>
      <th>#</th>
      <th>Use Name</th>
      <th>Address</th>
      <th>Category (Appendix 1)</th>
      <th>Walking Distance</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="4"><strong>Total qualifying uses</strong></td>
      <td class="num"><strong>${qualifying.length}</strong></td>
    </tr>
    <tr>
      <td colspan="5">Categories represented: ${categories.map((c) => escHtml(c)).join(", ")} (${categories.length} of 5 possible)</td>
    </tr>
  </tfoot>
</table>`;
}

// ─── Option 1 density fields ──────────────────────────────────────────────────

function option1Html(data: LTc4FormData): string {
  if (!data.pursueOption1) return "";
  return `
<div class="section-box">
  <h2>Option 1 — Surrounding Density</h2>
  <div class="field-row">
    <span class="field-label">Census Tract</span>
    <span class="field-value">${escHtml(data.censusTract || "—")}</span>
  </div>
  <div class="field-row">
    <span class="field-label">¼-Mile Offset Boundary</span>
    <span class="field-value">¼-mile (400m) walking distance offset from project boundary per LEED v4.1 LT Credit 4 Option 1</span>
  </div>
  <div class="field-row">
    <span class="field-label">Total Buildable Land Area</span>
    <span class="field-value">${data.buildableLandAcres > 0 ? escHtml(data.buildableLandAcres.toFixed(1)) + " acres" : "[OWNER TO CONFIRM: verify from GIS or county assessor]"}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Residential Density</span>
    <span class="field-value">${data.residentialDensityDuAcre > 0 ? escHtml(data.residentialDensityDuAcre.toFixed(1)) + " DU/acre" : "[OWNER TO CONFIRM: verify from civil drawings or Census]"}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Nonresidential FAR</span>
    <span class="field-value">${data.nonResidentialFAR > 0 ? escHtml(data.nonResidentialFAR.toFixed(2)) : "[OWNER TO CONFIRM: verify from civil drawings]"}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Combined Density</span>
    <span class="field-value">${data.combinedDensitySqFtAcre > 0 ? escHtml(data.combinedDensitySqFtAcre.toLocaleString()) + " sq ft of building per acre of buildable land" : "—"}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Points — Option 1 (Table 1a)</span>
    <span class="field-value"><strong>${data.pointsOption1}</strong> / ${data.pointsAvailable} available</span>
  </div>
</div>`;
}

// ─── Option 2 section ─────────────────────────────────────────────────────────

function option2Html(data: LTc4FormData, mapHtml: string): string {
  if (!data.pursueOption2) return "";
  const qualifying = data.diverseUses.filter((u) => u.qualifiesOption2);
  return `
<div class="section-box">
  <h2>Option 2 — Diverse Uses</h2>
  <p>
    <strong>${qualifying.length}</strong> qualifying diverse use(s) identified within ½-mile walking distance of the project main entrance.
    Walking distances measured along actual pedestrian routes per LEED v4.1 LT Credit 4 Option 2 requirements.
  </p>
  ${diverseUsesTableHtml(data.diverseUses)}
  <div class="field-row" style="margin-top:12px;">
    <span class="field-label">Points — Option 2 (Table 2)</span>
    <span class="field-value"><strong>${data.pointsOption2}</strong> / ${data.pointsAvailable} available</span>
  </div>
</div>

<div class="section-box">
  <h2>Walking Distance Map</h2>
  <p style="font-size:11px;color:#666;margin-bottom:8px;">
    Map shows project main entrance and pedestrian walking routes to all qualifying diverse uses.
    Scale bar and north arrow included. Walking distances measured along pedestrian network.
  </p>
  ${mapHtml}
</div>`;
}

// ─── Option 3 section ─────────────────────────────────────────────────────────

function option3Html(data: LTc4FormData): string {
  if (!data.pursueOption3) return "";
  return `
<div class="section-box">
  <h2>Option 3 — Walkable Location</h2>
  <p style="font-size:11px;color:#555;margin-bottom:12px;">
    Points awarded based on Walk Score® for the project address. Walk Score measures walkability
    on a scale of 0–100 based on pedestrian access to amenities.
  </p>
  <div class="field-row">
    <span class="field-label">Walk Score®</span>
    <span class="field-value"><strong>${data.walkScore > 0 ? data.walkScore : "[OWNER TO CONFIRM: obtain from walkscore.com]"}</strong>${data.walkScore > 0 ? " / 100" : ""}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Walk Score Source</span>
    <span class="field-value">${escHtml(data.walkScoreSource || "walkscore.com")}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Points — Option 3 (Table 3)</span>
    <span class="field-value"><strong>${data.pointsOption3}</strong> / ${data.pointsAvailable} available</span>
  </div>
</div>`;
}

// ─── Main template ────────────────────────────────────────────────────────────

export function renderLTc4Form(data: LTc4FormData, mapHtml: string): string {
  const optionsLabel = [
    data.pursueOption1 ? "Option 1: Surrounding Density" : null,
    data.pursueOption2 ? "Option 2: Diverse Uses" : null,
    data.pursueOption3 ? "Option 3: Walkable Location" : null,
  ].filter(Boolean).join(" + ") || "—";

  const pointsEarned = typeof data.pointsEarned === "object"
    ? Math.max((data.pointsEarned as any).option1 ?? 0, (data.pointsEarned as any).option2 ?? 0)
    : (data.pointsEarned ?? 0);

  const ownerItems = data.ownerConfirmItems?.length > 0
    ? `<ul>${data.ownerConfirmItems.map((item) => `<li>[OWNER TO CONFIRM: ${escHtml(item)}]</li>`).join("")}</ul>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(data.creditName)} — ${escHtml(data.projectAddress)}</title>
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
    .field-label { font-weight: bold; min-width: 220px; color: #444; font-size: 12px; }
    .field-value { flex: 1; border-bottom: 1px solid #ccc; padding-bottom: 2px; min-height: 18px; }
    .badge-pass  { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 3px; padding: 2px 8px; font-weight: bold; }
    .badge-fail  { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 3px; padding: 2px 8px; font-weight: bold; }
    .owner-box   { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin: 12px 0; }
    .owner-box strong { color: #856404; }
    table.liminal-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    table.liminal-table caption { font-weight: bold; text-align: left; margin-bottom: 4px; color: #333; }
    table.liminal-table th { background: var(--color-primary); color: white; padding: 6px 8px; text-align: left; }
    table.liminal-table td { padding: 5px 8px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
    table.liminal-table tfoot td { background: #e8f0f7; font-size: 11px; padding: 4px 8px; }
    table.liminal-table tr:nth-child(even) td { background: #f2f5f6; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>

<h1>${escHtml(data.creditName)}</h1>

<div class="section-box">
  <h2>Project Information</h2>
  <div class="field-row"><span class="field-label">Project Address</span><span class="field-value">${escHtml(data.projectAddress)}</span></div>
  <div class="field-row"><span class="field-label">Certification Program</span><span class="field-value">${escHtml(data.certProgram)}</span></div>
  <div class="field-row"><span class="field-label">Project Use Type</span><span class="field-value">${escHtml(data.projectUseType || "—")}</span></div>
  <div class="field-row"><span class="field-label">Gross Floor Area</span><span class="field-value">${data.grossFloorAreaSqFt > 0 ? escHtml(data.grossFloorAreaSqFt.toLocaleString()) + " sq ft" : "[OWNER TO CONFIRM: verify from civil drawings]"}</span></div>
  ${data.dwellingUnits > 0 ? `<div class="field-row"><span class="field-label">Dwelling Units</span><span class="field-value">${escHtml(data.dwellingUnits)}</span></div>` : ""}
  <div class="field-row"><span class="field-label">Submission Date</span><span class="field-value">${escHtml(data.submissionDate)}</span></div>
</div>

<div class="section-box">
  <h2>Options Pursued</h2>
  <div class="field-row">
    <span class="field-label">Selected Option(s)</span>
    <span class="field-value">${escHtml(optionsLabel)}</span>
  </div>
</div>

${option1Html(data)}
${option2Html(data, mapHtml)}
${option3Html(data)}

<div class="section-box">
  <h2>Points Determination</h2>
  <div class="field-row">
    <span class="field-label">Points Earned</span>
    <span class="field-value"><strong>${pointsEarned}</strong> / ${escHtml(data.pointsAvailable)} available</span>
  </div>
  <div class="field-row">
    <span class="field-label">Compliance Status</span>
    <span class="field-value">
      ${pointsEarned > 0
        ? `<span class="badge-pass">COMPLIANT — ${pointsEarned} Point${pointsEarned !== 1 ? "s" : ""} Earned</span>`
        : `<span class="badge-fail">NOT COMPLIANT — Threshold Not Met</span>`}
    </span>
  </div>
</div>

<div class="section-box">
  <h2>Narrative Summary</h2>
  <p>${escHtml(data.narrativeSummary)}</p>
</div>

${ownerItems ? `
<div class="owner-box">
  <strong>Owner / Project Team — Action Required</strong>
  ${ownerItems}
</div>` : ""}

</body>
</html>`;
}
