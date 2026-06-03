export function buildWellHsrGapAnalysisPrompt(params: {
  responses:       Record<string, unknown>;
  documentContext: string;
  documentCount?:  number;
}): string {
  const r    = params.responses as Record<string, string>;
  const docs = params.documentContext;
  const docCount = params.documentCount ?? 0;

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

${docCount > 0 ? `═══════════════════════════════════════════════════════════
UPLOADED DOCUMENTS — EXAMINE BEFORE WRITING THE REPORT
═══════════════════════════════════════════════════════════
${docCount} document file(s) are attached as PDFs. Visually read every page now, before generating the report.

For each document, look for evidence relevant to HSR concepts:
- Floor plans: AED cabinet locations, first aid station locations, restroom locations, janitor/cleaning closets, emergency exit routes, common areas, wellness rooms
- Mechanical/HVAC drawings: equipment type, filtration units, ventilation strategy, combustion appliances, outdoor air intakes
- Plumbing drawings: water supply type, filtration systems, cooling tower presence, drinking water points
- Operational documents: cleaning protocols, maintenance logs, training records, emergency plans, warden lists, occupant communication samples
- Reports/certifications: water test results, IAQ monitoring data, previous WELL/LEED certifications, inspection records

${docs ? `Extracted text (supplement to visual reading):\n${docs}` : ""}` : "No documents were uploaded. Base analysis on questionnaire responses only."}

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

DOCUMENT USAGE — MANDATORY:
${docCount > 0 ? `Documents are attached. You MUST actively use what you see in them. Do not produce an analysis based solely on questionnaire answers when documents are present.

For every HSR concept, check the documents for supporting or contradicting evidence:
- SC (Cleaning): Does a protocol document show cleaning frequency, products, or staff training? Does a floor plan show cleaning station or janitor closet locations?
- SE (Emergency): Does an emergency plan document exist? Does a floor plan show exit routes, warden stations, or AED/defibrillator locations?
- SH (Health Services): Does a floor plan confirm AED cabinet placement? Are first aid kit records or inspection tags visible?
- SA (Air Quality): Do mechanical drawings show filtration type, HVAC equipment, or outdoor air systems? Does a maintenance log show filter change schedule?
- SS (Water Quality): Does a water test report show results and date? Do plumbing drawings show filtration units or cooling tower?
- SI (Stakeholder Engagement): Are occupant communication samples, survey forms, or wellness program materials present?

When documents provide evidence:
1. Reference it explicitly in the concept assessment ("Floor plan shows AED cabinet on each floor", "Water test report dated [date] confirms...")
2. Upgrade the readiness badge if the document supports a stronger assessment than the questionnaire alone
3. If a document contradicts a questionnaire answer, trust the document and note the discrepancy

After the Executive Summary, include a "Document Findings" section (REQUIRED when documents are attached) that lists what each document revealed and how it changed or confirmed the analysis.` : "No documents were attached. Omit the Document Findings section."}

IMPORTANT CONSTRAINTS:
- Do NOT explain HSR scoring thresholds or feature-level compliance requirements in detail
- Do NOT say "contact us" or mention support
- Do NOT fabricate data not in the questionnaire
- Reference actual questionnaire answers throughout — be specific, not generic
- Tone: operational building consultant — practical, compliance-aware, action-focused
- Prioritize features where questionnaire answers show clear gaps`;
}
