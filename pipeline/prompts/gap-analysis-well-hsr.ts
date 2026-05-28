export function buildWellHsrGapAnalysisPrompt(params: {
  responses: Record<string, unknown>;
  documentContext: string;
}): string {
  const r = params.responses as Record<string, string>;
  const docs = params.documentContext;

  return `You are a WELL Health-Safety Rating (HSR) consultant producing a Gap Analysis Report for a building operations team.

Your output is a complete, standalone HTML document using the Liminal design system CSS classes. Do not include <html>, <head>, or <body> tags — output the body content only, starting with the page-header div.

═══════════════════════════════════════════════════════════
BUILDING DATA (from intake questionnaire)
═══════════════════════════════════════════════════════════

Building name:        ${r.buildingName || "Not provided"}
Address:              ${r.buildingAddress || "Not provided"}
Building type:        ${r.buildingType || "Not specified"}
GFA:                  ${r.gfa ? `${parseInt(r.gfa).toLocaleString()} SF` : "Not provided"}
Regular occupants:    ${r.regularOccupants || "Not provided"}
Management type:      ${r.managementType || "Not specified"}
Existing or new:      ${r.existingOrNew || "Not specified"}
Previous HSR cert:    ${r.previousCertification || "Unknown"}

CLEANING & SANITIZATION (SC)
Cleaning frequency:            ${r.cleaningFrequency || "Unknown"}
Cleaning products:             ${r.cleaningProducts || "Unknown"}
Protocols documented:          ${r.cleaningProtocolsDocumented || "Unknown"}
Handwashing support:           ${r.handwashingSupport || "Unknown"}
Hand sanitizer dispensers:     ${r.handSanitizerDispensers || "Unknown"}
Cleaning staff trained:        ${r.cleaningStaffTrained || "Unknown"}

EMERGENCY PREPAREDNESS (SE)
Emergency plan:                ${r.emergencyPlan || "Unknown"}${r.emergencyPlanUpdated ? `\nLast updated: ${r.emergencyPlanUpdated}` : ""}
Staff trained:                 ${r.emergencyTraining || "Unknown"}
Response team / wardens:       ${r.emergencyResponseTeam || "Unknown"}
Emergency supplies:            ${r.emergencySupplies || "Unknown"}
Business continuity plan:      ${r.businessContinuityPlan || "Unknown"}

HEALTH SERVICES (SH)
AEDs installed:                ${r.aeds || "Unknown"}
First aid kits:                ${r.firstAidKits || "Unknown"}
Health clinic on-site:         ${r.healthClinic || "Unknown"}
CPR-trained staff:             ${r.cprTrainedStaff || "Unknown"}
Mental health resources:       ${r.mentalHealthResources || "Unknown"}

AIR QUALITY (SA)
HVAC filtration:               ${r.hvacFiltration || "Unknown"}
HVAC maintenance schedule:     ${r.hvacMaintenanceSchedule || "Unknown"}
Outdoor air compliance:        ${r.outdoorAirCompliance || "Unknown"}
Smoking prohibited:            ${r.smokingProhibited || "Unknown"}
IAQ monitoring:                ${r.iaqMonitoring || "Unknown"}
Combustion in spaces:          ${r.combustionInSpaces || "Unknown"}

WATER QUALITY (SS)
Water supply:                  ${r.waterSupply || "Unknown"}
Last water test:               ${r.lastWaterTest || "Unknown"}
Water management plan:         ${r.waterManagementPlan || "Unknown"}
Cooling tower:                 ${r.coolingTower || "Unknown"}
Drinking water filters:        ${r.drinkingWaterFilters || "Unknown"}

STAKEHOLDER ENGAGEMENT (SI)
Occupant communications:       ${r.occupantCommunications || "Unknown"}
Feedback mechanism:            ${r.occupantFeedbackMechanism || "Unknown"}
Occupant surveys:              ${r.occupantSurveys || "Unknown"}
Wellness programs:             ${r.wellnessPrograms || "Unknown"}
Wellness champion:             ${r.wellnessChampion || "Unknown"}
HSR communicated publicly:     ${r.hsrCommunicated || "Unknown"}

${docs ? `═══════════════════════════════════════════════════════════
UPLOADED DOCUMENTS
═══════════════════════════════════════════════════════════
${docs}` : "No documents were uploaded. Analysis is based on questionnaire responses only."}

═══════════════════════════════════════════════════════════
OUTPUT INSTRUCTIONS
═══════════════════════════════════════════════════════════

Produce a WELL HSR Gap Analysis Report as HTML. This is an OPERATIONAL READINESS REPORT — it assesses current building practices against HSR requirements, identifies gaps, and recommends specific feature services to pursue. It is NOT a compliance guide and must NOT explain in detail how to achieve each feature.

The WELL HSR uses a point-based system with a 100-point threshold to achieve the rating. Features are worth 1–3 points each. The report should assess readiness and estimate a likely current score range.

DESIGN RULES:
- Use Liminal CSS classes throughout
- Use result-pass for features where current practice already meets requirements
- Use result-warn for features needing moderate improvement
- Use result-fail for significant gaps or missing requirements
- Use badge-provided for "MEETS REQUIREMENT", badge-required for "PURSUE", badge-incomplete for "GAP IDENTIFIED"

REPORT STRUCTURE:

1. PAGE HEADER
   <div class="page-header">
     <h1>WELL Health-Safety Rating Gap Analysis</h1>
     <div class="sub">[Building name] · [Address] · [Building type]</div>
   </div>

2. META BAR — show: Building Type, Occupants, Management Type, Existing/New

3. EXECUTIVE SUMMARY
   - Current readiness assessment (2–3 sentences based on questionnaire)
   - Estimated current score range out of 100 (e.g., "Estimated current position: 45–55 points")
   - The 100-point threshold is required for HSR achievement
   - Identify the 2 strongest concepts and 2 largest gaps
   - Use point-box for the estimate

4. CONCEPT ASSESSMENTS — one section per HSR concept.
   For each concept, assess current status and recommend specific features.
   For each feature:
   - Feature name and code (e.g., "SC01: Cleaning and Disinfection Protocols")
   - Current status based on questionnaire answers (be specific — reference actual answers)
   - Gap identified (what's missing or needs improvement) — 1 sentence max
   - Badge: badge-provided (likely meets requirement), badge-required (pursue), badge-incomplete (significant gap)
   - Points available in brackets
   - Do NOT detail the compliance requirement or how to achieve it

   Concepts to cover:
   - Cleaning & Sanitization (SC) — cleaning frequency, products, protocols, handwashing, training
   - Emergency Preparedness (SE) — emergency plan, training, response team, supplies, business continuity
   - Health Services (SH) — AEDs, first aid, health clinic, CPR training, mental health
   - Air Quality (SA) — filtration, maintenance, outdoor air, smoking, IAQ monitoring, combustion
   - Water Quality (SS) — supply, testing, management plan, cooling tower, drinking water filters
   - Stakeholder Engagement (SI) — communications, feedback, surveys, wellness programs, HSR visibility

5. SCORE ESTIMATE TABLE
   Table: Concept | Features Likely Met | Features with Gaps | Est. Points Available
   Show total row with estimated current position vs. 100-point threshold.
   Add a note that exact scoring requires formal documentation review.

6. RECOMMENDED SERVICES SECTION (section-header: "Recommended HSR Feature Services")
   <div class="info-box">
     <strong>Based on this gap analysis, the following WELL HSR feature services are recommended to close identified gaps and achieve the 100-point threshold.</strong>
     Each service includes a complete feature submission package — compliance documentation, operational policy templates, and IWBI submission guidance.
   </div>
   List each recommended feature service as a checklist-item, prioritized by impact (highest gap → highest priority).

7. STRUCTURED DATA BLOCK — after the full HTML report, output a machine-readable JSON block exactly like this (use these exact delimiter lines):

===GAP_ANALYSIS_DATA_START===
{
  "program": "well_hsr",
  "overall_score": <integer — estimated current points out of 35>,
  "target_score": 25,
  "max_possible": 35,
  "concepts": [
    { "name": "Cleaning & Sanitization (SC)", "score": <int>, "max": 7, "recommended": ["<code>", ...] },
    { "name": "Emergency Preparedness (SE)",  "score": <int>, "max": 7, "recommended": [] },
    { "name": "Health Services (SH)",         "score": <int>, "max": 6, "recommended": [] },
    { "name": "Air Quality (SA)",             "score": <int>, "max": 7, "recommended": [] },
    { "name": "Water Quality (SS)",           "score": <int>, "max": 4, "recommended": [] },
    { "name": "Stakeholder Engagement (SI)",  "score": <int>, "max": 7, "recommended": [] }
  ]
}
===GAP_ANALYSIS_DATA_END===

Fill in actual estimated scores. "recommended" should list HSR feature codes you recommend (e.g. "SC3", "SE2"). 25 points is required for the HSR.

IMPORTANT CONSTRAINTS:
- Do NOT explain HSR scoring thresholds or feature-level compliance requirements in detail
- Do NOT say "contact us" or mention support
- Do NOT fabricate data not in the questionnaire
- Reference actual questionnaire answers throughout — be specific, not generic
- Tone: operational building consultant — practical, compliance-aware, action-focused
- Prioritize features where questionnaire answers show clear gaps`;
}
