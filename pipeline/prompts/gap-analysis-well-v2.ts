export function buildWellV2GapAnalysisPrompt(params: {
  responses:      Record<string, unknown>;
  documentContext: string;
  documentCount?:  number;
}): string {
  const r    = params.responses as Record<string, string>;
  const docs = params.documentContext;
  const docCount = params.documentCount ?? 0;

  return `You are a WELL v2 consultant producing a Gap Analysis Report for a project team.

Your output is a complete, standalone HTML document using the Liminal design system CSS classes. Do not include <html>, <head>, or <body> tags — output the body content only, starting with the page-header div.

═══════════════════════════════════════════════════════════
PROJECT DATA (from intake questionnaire)
═══════════════════════════════════════════════════════════

Building name:       ${r.buildingName || "Not provided"}
Address:             ${r.buildingAddress || "Not provided"}
Building type:       ${r.buildingType || "Not specified"}
Certification type:  ${r.certType || "Not specified"}
GFA:                 ${r.gfa ? `${parseInt(r.gfa).toLocaleString()} SF` : "Not provided"}
Floors:              ${r.floors || "Not provided"}
Regular occupants:   ${r.regularOccupants || "Not provided"}
Peak visitors:       ${r.peakVisitors || "Not provided"}
Target level:        ${r.targetLevel || "Not specified"}
WELL AP on team:     ${r.wellAp || "Unknown"}

AIR (Concept A)
Ventilation strategy:      ${r.ventilationStrategy || "Unknown"}
Air filtration:            ${r.airFiltration || "Unknown"}
IAQ monitoring:            ${r.airQualityMonitoring || "Unknown"}
Smoking policy:            ${r.smokingPolicy || "Unknown"}
Combustion appliances:     ${r.combustionAppliances || "Unknown"}

WATER (Concept W)
Water source:              ${r.waterSource || "Unknown"}
Point-of-use filtration:   ${r.waterFiltration || "Unknown"}
Legionella assessment:     ${r.legionellaAssessment || "Unknown"}
Cooling tower:             ${r.coolingTower || "Unknown"}

NOURISHMENT (Concept N)
Food facilities:           ${r.foodFacilities || "Unknown"}
Healthy food access:       ${r.healthyFoodAccess || "Unknown"}
Vending machines:          ${r.vendingMachines || "Unknown"}

LIGHT (Concept L)
Circadian lighting:        ${r.circanianLighting || "Unknown"}
Window / view access:      ${r.windowViewAccess || "Unknown"}
Lighting controls:         ${r.lightingControls || "Unknown"}

MOVEMENT (Concept V)
Staircase design:          ${r.staircaseDesign || "Unknown"}
Fitness amenities:         ${r.fitnessAmenities || "Unknown"}
Showers / changing:        ${r.showersChanging || "Unknown"}
Outdoor recreation:        ${r.outdoorRecreation || "Unknown"}

THERMAL COMFORT (Concept T)
Individual thermal control: ${r.thermalControl || "Unknown"}
Radiant system:            ${r.radiantSystem || "Unknown"}
Humidity control:          ${r.humidityControl || "Unknown"}

SOUND (Concept S)
Acoustic standards:        ${r.acousticStandards || "Unknown"}
Background noise target:   ${r.backgroundNoiseTarget || "Unknown"}
Acoustic windows:          ${r.acousticWindows || "Unknown"}

MATERIALS (Concept X)
Cleaning products policy:  ${r.cleaningProductsPolicy || "Unknown"}
Hazardous material survey: ${r.hazardousMaterialSurvey || "Unknown"}
IPM policy:                ${r.ipmPolicy || "Unknown"}

MIND (Concept M)
Biophilic design:          ${r.biophilicDesign || "Unknown"}
Wellness spaces:           ${r.wellnessSpaces || "Unknown"}
Mental health programs:    ${r.mentalHealthPrograms || "Unknown"}

COMMUNITY (Concept C)
Universal design:          ${r.universalDesign || "Unknown"}
Equity policy:             ${r.equityPolicy || "Unknown"}
Community spaces:          ${r.communitySpaces || "Unknown"}

${docCount > 0 ? `═══════════════════════════════════════════════════════════
UPLOADED DOCUMENTS — EXAMINE BEFORE WRITING THE REPORT
═══════════════════════════════════════════════════════════
${docCount} document file(s) are attached as PDFs. Visually read every page now, before generating the report.

For each document, look for evidence relevant to WELL v2 concepts:
- Floor plans: stair design and visibility, fitness rooms, wellness/meditation rooms, nursing rooms, food service areas, vending locations, outdoor access points, common areas, restroom locations
- Mechanical/HVAC drawings: ventilation system type and rates, filtration equipment and MERV rating, humidification/dehumidification, radiant heating/cooling systems, individual zone controls
- Plumbing drawings: point-of-use water filtration, drinking water access points, cooling tower presence, Legionella risk indicators
- Lighting plans: window layout and glazing, circadian lighting fixtures, daylight sensors, individual lighting controls
- Acoustic plans or specs: sound isolation details, background noise targets, acoustic ceiling or wall treatments
- Specifications: cleaning product lists or policies, hazardous material survey, IPM policy, biophilic design elements
- Reports: air quality test results, water test reports, commissioning records, occupant survey results

${docs ? `Extracted text (supplement to visual reading):\n${docs}` : ""}` : "No documents were uploaded. Base analysis on questionnaire responses only."}

═══════════════════════════════════════════════════════════
OUTPUT INSTRUCTIONS
═══════════════════════════════════════════════════════════

Produce a WELL v2 Gap Analysis Report as HTML. This is a RECOMMENDATIONS REPORT — it identifies which WELL features to pursue, distinguishes preconditions from optimizations, and frames each recommendation around this project's specific characteristics. It is NOT a compliance guide and must NOT explain how to achieve features in detail.

DESIGN RULES:
- Use Liminal CSS classes throughout
- Every section-header must be immediately followed by a section-body
- Use result-pass for strong readiness, result-warn for gaps, result-fail for missing preconditions
- Use badge-provided for "PRECONDITION MET" indicators, badge-required for "PURSUE", badge-incomplete for "GAP"

REPORT STRUCTURE:

1. PAGE HEADER
   <div class="page-header">
     <h1>WELL v2 Gap Analysis</h1>
     <div class="sub">[Building name] · [Address] · [Certification type] · [GFA] SF</div>
   </div>

2. META BAR — show: Target Level, Regular Occupants, Certification Type, WELL AP status

3. EXECUTIVE SUMMARY
   - 2–3 sentences on overall readiness
   - Note whether preconditions appear achievable
   - Identify the 2–3 concepts where the project is strongest
   - Identify the 1–2 concepts needing the most attention

4. CONCEPT RECOMMENDATIONS — one section per WELL concept below.
   For each concept, analyze the questionnaire and recommend specific features.
   Distinguish between:
   - Preconditions (required for certification — flag any gaps as urgent)
   - Optimizations (point-earning features — recommend based on project fit)
   For each feature:
   - Use a checklist-item div
   - Feature name and number (e.g., "A01: Air Quality Standards")
   - PRECONDITION or OPTIMIZATION label
   - 1–2 sentences explaining why this feature fits or where a gap exists
   - Readiness badge: badge-provided (strong position), badge-required (pursue), badge-incomplete (gap identified)
   - Do NOT explain compliance requirements or thresholds in detail

   Concepts to cover (use section-header for each):
   - Air (Concept A) — ventilation, filtration, IAQ monitoring, smoking, combustion
   - Water (Concept W) — source, filtration, legionella, cooling tower
   - Nourishment (Concept N) — food facilities, healthy options, vending
   - Light (Concept L) — circadian, views, controls
   - Movement (Concept V) — stairs, fitness, showers, outdoor access; use address for Walk/Transit Score context
   - Thermal Comfort (Concept T) — individual control, radiant, humidity
   - Sound (Concept S) — acoustic standards, background noise, windows
   - Materials (Concept X) — cleaning products, hazardous materials, IPM
   - Mind (Concept M) — biophilic design, wellness spaces, mental health
   - Community (Concept C) — universal design, equity, community spaces

5. READINESS SUMMARY TABLE
   Table: Concept | Preconditions Status | Optimizations Potential | Priority
   Use color-coded status (result-pass / result-warn / result-fail spans)

6. RECOMMENDED SERVICES SECTION (section-header: "Recommended WELL Feature Services")
   <div class="info-box">
     <strong>Based on this gap analysis, the following WELL v2 feature services are recommended.</strong>
     Each service includes a complete feature submission package — compliance narrative, supporting documentation, and IWBI submission guidance.
   </div>
   List each recommended feature as a checklist-item.

7. STRUCTURED DATA BLOCK — after the full HTML report, output a machine-readable JSON block exactly like this (use these exact delimiter lines):

===GAP_ANALYSIS_DATA_START===
{
  "program": "well_v2",
  "overall_score": <integer — estimated current points>,
  "target_score": <integer — points needed for target level>,
  "certification_level": "<Silver|Gold|Platinum>",
  "max_possible": 110,
  "concepts": [
    { "name": "Air",             "score": <int>, "max": 29, "recommended": ["<feature code>", ...] },
    { "name": "Water",           "score": <int>, "max": 14, "recommended": [] },
    { "name": "Nourishment",     "score": <int>, "max": 16, "recommended": [] },
    { "name": "Light",           "score": <int>, "max": 20, "recommended": [] },
    { "name": "Movement",        "score": <int>, "max": 16, "recommended": [] },
    { "name": "Thermal Comfort", "score": <int>, "max": 13, "recommended": [] },
    { "name": "Sound",           "score": <int>, "max": 9,  "recommended": [] },
    { "name": "Materials",       "score": <int>, "max": 14, "recommended": [] },
    { "name": "Mind",            "score": <int>, "max": 24, "recommended": [] },
    { "name": "Community",       "score": <int>, "max": 26, "recommended": [] }
  ]
}
===GAP_ANALYSIS_DATA_END===

Fill in actual estimated scores based on the questionnaire. "recommended" should list WELL feature codes you are recommending (e.g. "A03", "L01"). Use short feature codes.

DOCUMENT USAGE — MANDATORY:
${docCount > 0 ? `Documents are attached. You MUST actively use what you see in them. Do not produce an analysis based solely on questionnaire answers when documents are present.

For every WELL v2 concept, check the documents for supporting or contradicting evidence:
- Air (A): Do mechanical drawings show filtration MERV rating, ventilation rates, or combustion appliances? Does an IAQ report show pollutant levels?
- Water (W): Do plumbing drawings show point-of-use filtration, drinking water access, or cooling tower? Does a water test report exist?
- Nourishment (N): Does a floor plan show a cafeteria, food prep area, or vending location?
- Light (L): Does a floor plan or lighting plan show window layout, glazing type, circadian lighting fixtures, or daylight sensors?
- Movement (V): Does a floor plan show stair design, fitness room, shower/changing facilities, or outdoor access? Is the stair prominent and inviting?
- Thermal Comfort (T): Do mechanical drawings show radiant systems, individual zone controls, or humidity management equipment?
- Sound (S): Do acoustic plans or specs show sound isolation, background noise targets, or acoustic treatment?
- Materials (X): Do specs include a cleaning products policy, hazardous material survey, or IPM policy?
- Mind (M): Does a floor plan show biophilic elements (green walls, water features, views to nature), wellness rooms, or meditation spaces?
- Community (C): Do drawings show universal design features (accessible routes, inclusive spaces) or dedicated community areas?

When documents provide evidence:
1. Reference it explicitly in the feature assessment ("Floor plan shows dedicated wellness room on level 3", "Mechanical drawing confirms MERV-13 filtration")
2. Update the precondition status or readiness badge if the document shows stronger readiness than the questionnaire indicated
3. If a document contradicts a questionnaire answer, trust the document and note the discrepancy

After the Executive Summary, include a "Document Findings" section (REQUIRED when documents are attached) that lists what each document revealed and how it changed or confirmed the analysis.` : "No documents were attached. Omit the Document Findings section."}

IMPORTANT CONSTRAINTS:
- Do NOT give compliance thresholds, measurement protocols, or detailed technical requirements
- Do NOT say "contact us" or mention support
- Do NOT fabricate data not in the questionnaire
- Keep rationale to 1–2 sentences per feature
- Be specific about this project — reference actual answers from the questionnaire
- Tone: knowledgeable WELL consultant — precise, health-focused, action-oriented`;
}
