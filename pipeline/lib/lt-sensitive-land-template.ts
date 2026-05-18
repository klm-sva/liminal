/**
 * pipeline/lib/lt-sensitive-land-template.ts
 *
 * Pass 1b for LT Credit 2 — Sensitive Land Protection.
 *
 * Claude returns a compact JSON object via Pass 1a (web search: FEMA, NWI, USDA, NatureServe).
 * This module renders that JSON into the full LEED Online Form LT102 HTML.
 * Zero AI tokens — pure JavaScript template.
 */

export interface SensitiveLandFormData {
  // Project info
  projectAddress:  string;
  projectName:     string;
  certProgram:     string;
  creditName:      string;
  submissionDate:  string;

  // Compliance path (Option 1 is the standard path — avoid sensitive land)
  compliancePath:  "Option 1" | "Option 2";

  // FEMA flood data
  femaFloodZone:          string;   // e.g. "Zone X (minimal flood hazard)"
  femaFirmPanel:          string;   // e.g. "06073C1670G"
  femaFirmDate:           string;
  femaFirmUrl:            string;
  onFloodplain:           boolean;  // true = NOT compliant for this factor

  // USFWS National Wetlands Inventory
  wetlandsMapped:         boolean;  // true = wetlands present within/adjacent
  wetlandsDescription:    string;
  nwiUrl:                 string;

  // USDA Web Soil Survey
  primeFarmland:          boolean;  // true = prime farmland present
  farmlandDescription:    string;
  soilType:               string;
  usdaUrl:                string;

  // NatureServe — threatened/endangered species
  endangeredHabitat:      boolean;  // true = listed species habitat present
  speciesDescription:     string;
  natureserveUrl:         string;

  // Compliance determination
  compliant:          boolean;
  pointsEarned:       number;
  pointsAvailable:    number;
  narrativeSummary:   string;
  ownerConfirmItems:  string[];
}

function escHtml(s: string | number | boolean): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function yesNo(val: boolean, invertForCompliance = false): string {
  const compliant = invertForCompliance ? !val : val;
  const label = val ? "Yes" : "No";
  const badge = compliant
    ? `<span style="background:#d4edda;color:#155724;border:1px solid #c3e6cb;border-radius:3px;padding:1px 6px;font-size:11px;margin-left:6px;">✓ Compliant</span>`
    : `<span style="background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:3px;padding:1px 6px;font-size:11px;margin-left:6px;">✗ Issue</span>`;
  return `${label} ${badge}`;
}

function sourceLink(url: string, label: string): string {
  if (!url) return label;
  return `<a href="${escHtml(url)}" target="_blank" style="color:#327cb9;">${escHtml(label)}</a>`;
}

export function renderLTc2Form(data: SensitiveLandFormData, mapHtml: string): string {
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
    .field-label { font-weight: bold; min-width: 240px; color: #444; font-size: 12px; }
    .field-value { flex: 1; border-bottom: 1px solid #ccc; padding-bottom: 2px; min-height: 18px; }
    .source-note { font-size: 11px; color: #666; margin-top: 2px; }
    .badge-pass  { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 3px; padding: 2px 8px; font-weight: bold; }
    .badge-fail  { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 3px; padding: 2px 8px; font-weight: bold; }
    .owner-box   { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin: 12px 0; }
    .owner-box strong { color: #856404; }
  </style>
</head>
<body>

<h1>${escHtml(data.creditName)}</h1>

<div class="section-box">
  <h2>Project Information</h2>
  <div class="field-row"><span class="field-label">Project Address</span><span class="field-value">${escHtml(data.projectAddress)}</span></div>
  <div class="field-row"><span class="field-label">Certification Program</span><span class="field-value">${escHtml(data.certProgram)}</span></div>
  <div class="field-row"><span class="field-label">Submission Date</span><span class="field-value">${escHtml(data.submissionDate)}</span></div>
</div>

<div class="section-box">
  <h2>Compliance Path</h2>
  <div class="field-row">
    <span class="field-label">Path Selected</span>
    <span class="field-value">${escHtml(data.compliancePath)} — Do not develop on sensitive land</span>
  </div>
</div>

<div class="section-box">
  <h2>Site Context Map</h2>
  <p style="font-size:11px;color:#666;margin-bottom:8px;">
    Site location shown relative to FEMA flood zone boundaries, NWI mapped wetlands, and parcel boundary.
  </p>
  ${mapHtml}
</div>

<div class="section-box">
  <h2>Factor 1 — Floodplains (FEMA Flood Map)</h2>
  <div class="field-row">
    <span class="field-label">Is the project on a 100-year floodplain?</span>
    <span class="field-value">${yesNo(data.onFloodplain, true)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">FEMA Flood Zone</span>
    <span class="field-value">${escHtml(data.femaFloodZone || "—")}</span>
  </div>
  <div class="field-row">
    <span class="field-label">FIRM Panel Number</span>
    <span class="field-value">${escHtml(data.femaFirmPanel || "—")}</span>
  </div>
  <div class="field-row">
    <span class="field-label">FIRM Effective Date</span>
    <span class="field-value">${escHtml(data.femaFirmDate || "—")}</span>
  </div>
  ${data.femaFirmUrl ? `<div class="source-note">Source: ${sourceLink(data.femaFirmUrl, "FEMA Flood Map Service Center")}</div>` : ""}
</div>

<div class="section-box">
  <h2>Factor 2 — Wetlands (USFWS National Wetlands Inventory)</h2>
  <div class="field-row">
    <span class="field-label">Are wetlands mapped within or adjacent to the project?</span>
    <span class="field-value">${yesNo(data.wetlandsMapped, true)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Description</span>
    <span class="field-value">${escHtml(data.wetlandsDescription || "—")}</span>
  </div>
  ${data.nwiUrl ? `<div class="source-note">Source: ${sourceLink(data.nwiUrl, "USFWS National Wetlands Inventory Mapper")}</div>` : ""}
</div>

<div class="section-box">
  <h2>Factor 3 — Prime Farmland (USDA Web Soil Survey)</h2>
  <div class="field-row">
    <span class="field-label">Is the project on prime farmland?</span>
    <span class="field-value">${yesNo(data.primeFarmland, true)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Soil Type</span>
    <span class="field-value">${escHtml(data.soilType || "—")}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Description</span>
    <span class="field-value">${escHtml(data.farmlandDescription || "—")}</span>
  </div>
  ${data.usdaUrl ? `<div class="source-note">Source: ${sourceLink(data.usdaUrl, "USDA Web Soil Survey")}</div>` : ""}
</div>

<div class="section-box">
  <h2>Factor 4 — Species Habitat (NatureServe Explorer)</h2>
  <div class="field-row">
    <span class="field-label">Is the project within listed species habitat?</span>
    <span class="field-value">${yesNo(data.endangeredHabitat, true)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Description</span>
    <span class="field-value">${escHtml(data.speciesDescription || "—")}</span>
  </div>
  ${data.natureserveUrl ? `<div class="source-note">Source: ${sourceLink(data.natureserveUrl, "NatureServe Explorer")}</div>` : ""}
</div>

<div class="section-box">
  <h2>Points Determination</h2>
  <div class="field-row">
    <span class="field-label">Points Earned</span>
    <span class="field-value"><strong>${escHtml(data.pointsEarned)}</strong> / ${escHtml(data.pointsAvailable)} available</span>
  </div>
  <div class="field-row">
    <span class="field-label">Compliance Status</span>
    <span class="field-value">
      ${data.compliant
        ? `<span class="badge-pass">COMPLIANT — Credit Earned</span>`
        : `<span class="badge-fail">NOT COMPLIANT — Sensitive Land Conflict Identified</span>`}
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
