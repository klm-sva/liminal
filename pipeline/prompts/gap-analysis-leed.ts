export function buildLeedGapAnalysisPrompt(params: {
  responses: Record<string, unknown>;
  documentContext: string;
}): string {
  const r = params.responses as Record<string, string>;
  const docs = params.documentContext;

  return `You are a LEED BD+C v4.1 consultant producing a Gap Analysis Report for a project team.

Your output is a complete, standalone HTML document using the Liminal design system CSS classes defined below. Do not include <html>, <head>, or <body> tags — output the body content only, starting with the page-header div.

═══════════════════════════════════════════════════════════
PROJECT DATA (from intake questionnaire)
═══════════════════════════════════════════════════════════

Building name:       ${r.buildingName || "Not provided"}
Address:             ${r.buildingAddress || "Not provided"}
Building type:       ${r.buildingType || "Not specified"}
Gross floor area:    ${r.gfa ? `${parseInt(r.gfa).toLocaleString()} SF` : "Not provided"}
Floors:              ${r.floors || "Not provided"}
Parking spaces:      ${r.parking || "Not provided"}
Target level:        ${r.targetLevel || "Not specified"}
LEED AP on team:     ${r.leedAp || "Unknown"}

ENERGY & MECHANICAL
Energy target:            ${r.energyTarget || "Not set"}
Heating fuel:             ${r.heatingFuel || "Unknown"}
Cooling system:           ${r.coolingSystem || "Unknown"}
Renewable energy:         ${r.renewableEnergy || "Unknown"}${r.renewableDetail ? `\nRenewable detail: ${r.renewableDetail}` : ""}
Enhanced commissioning:   ${r.enhancedCommissioning || "Unknown"}
Refrigerant approach:     ${r.refrigerantApproach || "Unknown"}

WATER
Irrigation:               ${r.irrigation || "Unknown"}
Water reuse systems:      ${Array.isArray(r.waterReuse) ? (r.waterReuse as string[]).join(", ") || "None" : r.waterReuse || "Unknown"}
Cooling tower:            ${r.coolingTower || "Unknown"}
Fixture intent:           ${r.fixtureIntent || "Unknown"}

SITE & LOCATION
Previously developed:     ${r.previouslyDeveloped || "Unknown"}
Existing structure:       ${r.existingStructure || "Unknown"}
Site area:                ${r.siteArea ? `${r.siteArea} acres` : "Not provided"}
Bicycle storage:          ${r.bicycleStorage || "Unknown"}
EV charging:              ${r.evCharging || "Unknown"}
Exterior lighting:        ${r.exteriorLighting || "Unknown"}

MATERIALS
EPDs:                     ${r.epds || "Unknown"}
FSC-certified wood:       ${r.fscWood || "Unknown"}
Waste management plan:    ${r.wasteManagement || "Unknown"}
Low-emitting materials:   ${r.lowEmitting || "Unknown"}

INDOOR ENVIRONMENT
Ventilation strategy:     ${r.ventilation || "Unknown"}
Daylighting priority:     ${r.daylighting || "Unknown"}
Acoustic standards:       ${r.acoustic || "Unknown"}
Construction IAQ plan:    ${r.constructionIaq || "Unknown"}

TEAM & PROCESS
Pre-design charrette:     ${r.charrette || "Unknown"}
Commissioning authority:  ${r.cxAuthority || "Unknown"}
Contractor selected:      ${r.contractorSelected || "Unknown"}${r.contractorLeedExperience ? `\nContractor LEED experience: ${r.contractorLeedExperience}` : ""}

${docs ? `═══════════════════════════════════════════════════════════
UPLOADED DOCUMENTS
═══════════════════════════════════════════════════════════
${docs}` : "No documents were uploaded. Analysis is based on questionnaire responses only."}

═══════════════════════════════════════════════════════════
OUTPUT INSTRUCTIONS
═══════════════════════════════════════════════════════════

Produce a LEED BD+C v4.1 Gap Analysis Report as HTML. This is a RECOMMENDATIONS REPORT — it identifies which credits to pursue, estimates their point potential, and frames each recommendation around this specific project's characteristics. It is NOT a compliance guide and must NOT explain how to achieve credits in detail.

DESIGN RULES:
- Use Liminal CSS classes throughout (section-header, section-body, section-wrap, page-header, field-row, field-label, field-value, note, info-box, warn-note, checklist-item, result-pass, result-warn, badge-provided, badge-required, two-col, point-box)
- Every section-header must be immediately followed by a section-body
- Use the point-box class for point totals
- Use result-pass for strong opportunities, result-warn for gaps

REPORT STRUCTURE — produce all sections in this order:

1. PAGE HEADER
   <div class="page-header">
     <h1>LEED BD+C v4.1 Gap Analysis</h1>
     <div class="sub">[Building name] · [Address] · [Building type] · [GFA] SF</div>
   </div>

2. META BAR — show: Target Level, GFA, Building Type, LEED AP status

3. EXECUTIVE SUMMARY SECTION
   - 2–3 sentences on overall readiness based on questionnaire
   - Estimated point range (format: "X–Y estimated points")
   - Whether target level appears achievable, ambitious, or out of reach
   - Use point-box for the estimate

4. CREDIT RECOMMENDATIONS — one section per LEED category below.
   For each category, analyze the questionnaire data and recommend specific credits.
   For each credit:
   - Use a checklist-item div
   - Credit name and code (e.g., "EA Credit: Optimize Energy Performance")
   - 1–2 sentences explaining why this credit fits THIS project based on questionnaire answers
   - Point value or range in brackets (e.g., [1–18 pts])
   - Effort level badge: <span class="badge-provided">LOW EFFORT</span>, <span class="badge-required">MEDIUM EFFORT</span>, or <span class="badge-incomplete">HIGH EFFORT</span>
   - Only recommend credits with a realistic path given the questionnaire data
   - Do NOT explain compliance requirements or how to achieve the credit

   Categories to cover (use section-header for each):
   - Location & Transportation (LT) — use address data, transit access, bicycle storage, EV charging
   - Sustainable Sites (SS) — site development, previously developed status, open space
   - Water Efficiency (WE) — fixture intent, irrigation, water reuse, cooling tower
   - Energy & Atmosphere (EA) — energy target, fuel type, renewables, commissioning, refrigerant
   - Materials & Resources (MR) — EPDs, FSC wood, waste management, existing structure reuse
   - Indoor Environmental Quality (IEQ) — ventilation, daylighting, acoustics, low-emitting, IAQ
   - Innovation (IN) — LEED AP, any standout strategies identified
   - Regional Priority (RP) — note that RP credits are location-specific and will be assessed during credit work

5. POINT SUMMARY SECTION
   Table showing: Category | Recommended Credits | Estimated Points
   Show a total row with the overall estimated point range.
   Add a note that this is an estimate — exact points depend on design decisions and documentation.

6. RECOMMENDED SERVICES SECTION (section-header: "Recommended Credit Services")
   A clear list of the specific credits recommended for ordering from Liminal, presented as:
   <div class="info-box">
     <strong>Based on this gap analysis, the following LEED credit services are recommended for your project.</strong>
     Each service includes a complete credit submission package — GBCI calculator, compliance narrative, and all required documentation.
   </div>
   Then list each recommended credit as a checklist-item with the credit name and a one-line reason.

IMPORTANT CONSTRAINTS:
- Do NOT say "contact us," "reach out," or mention support
- Do NOT give step-by-step compliance instructions or thresholds
- Do NOT make up data not in the questionnaire
- If a field is "Unknown" or missing, note it briefly but do not fabricate an answer
- Keep each credit rationale to 1–2 sentences max
- The tone is that of a knowledgeable consultant — confident, specific, and action-oriented
- Use the project's actual building name and address throughout`;
}
