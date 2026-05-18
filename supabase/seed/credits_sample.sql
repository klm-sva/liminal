-- ============================================================
-- Liminal — Sample Credits Seed
-- Demonstrates the exact data structure for the credits catalog.
-- Replace prompt_text with production-grade prompts before launch.
-- ============================================================

-- ============================================================
-- LEED BD+C v4.1 — Sample Credits
-- ============================================================

insert into credits (
  program, category, credit_code, credit_name,
  points_available, automation_type,
  requirements_pdf_path,
  has_leed_form, leed_form_link,
  has_calculator, calculator_path,
  prompt_text, required_customer_documents,
  deliverable_description, partial_notes, price, is_active
) values

-- LT Credit 5 — Access to Quality Transit
(
  'leed_bdc_v41',
  'Location & Transportation',
  'LTc5',
  'Access to Quality Transit',
  5,
  'full',
  'leed/location-transportation/LTc5/requirements.pdf',
  true,
  'https://leedonline.usgbc.org/leed/Credit/Detail/LTc5',
  false,
  null,
  'You are a LEED BD+C v4.1 documentation specialist. Using ONLY the attached requirements PDF for LT Credit 5 (Access to Quality Transit) and the customer-supplied documents, generate a complete LEED compliance narrative. The narrative must: (1) identify the functional entry of the project, (2) list all transit stops within 0.25 miles for bus/streetcar or 0.5 miles for rail/ferry, (3) calculate weekday and weekend trip thresholds, (4) confirm achievement of minimum points tier, (5) cite specific page/section numbers from submitted documents. Output as a structured Word document with LEED Online form answers pre-filled. Do not use any information outside the provided files.',
  ARRAY[
    'Site plan showing functional entry point with scale',
    'Transit map or screenshot with distance measurements annotated',
    'Transit agency schedule for all stops within threshold distance (weekday + weekend)',
    'Zoning or address confirmation document'
  ],
  'A completed LEED BD+C v4.1 LT Credit 5 compliance package including: narrative document (.docx), HTML preview, and pre-filled LEED Online form answers.',
  null,
  14900,
  true
),

-- EA Prerequisite 2 — Minimum Energy Performance
(
  'leed_bdc_v41',
  'Energy & Atmosphere',
  'EAp2',
  'Minimum Energy Performance',
  0,
  'partial',
  'leed/energy-atmosphere/EAp2/requirements.pdf',
  true,
  'https://leedonline.usgbc.org/leed/Credit/Detail/EAp2',
  true,
  'leed/energy-atmosphere/EAp2/calculator.xlsx',
  'You are a LEED BD+C v4.1 documentation specialist. Using ONLY the attached requirements PDF for EA Prerequisite 2 (Minimum Energy Performance) and the customer-supplied energy model files, generate the prerequisite compliance narrative. You must: (1) identify the compliance path (ASHRAE 90.1 Appendix G or prescriptive), (2) extract baseline and proposed energy use from the energy model, (3) calculate percent savings, (4) confirm the 5% minimum savings threshold is met, (5) populate the energy calculator with extracted values. Flag any values you cannot confirm from the provided documents. Do not fabricate energy model outputs.',
  ARRAY[
    'Whole-building energy model output report (eQUEST, EnergyPlus, IES-VE, or equivalent)',
    'Energy model input files (.inp, .idf, .aps, or .gbxml)',
    'Mechanical engineer stamp and signature on energy model summary',
    'Utility rate schedule used in the model'
  ],
  'A LEED EA Prerequisite 2 compliance package including: narrative document (.docx), HTML preview, pre-filled LEED Online form answers, and completed energy performance calculator (.xlsx) with your model values populated.',
  'The energy model input file review and validation of modelling assumptions requires qualified mechanical engineering review. The AI generates the narrative and populates the calculator; a licensed engineer must verify the modelling methodology before final submission.',
  19900,
  true
),

-- EA Credit 2 — Optimize Energy Performance
(
  'leed_bdc_v41',
  'Energy & Atmosphere',
  'EAc2',
  'Optimize Energy Performance',
  18,
  'partial',
  'leed/energy-atmosphere/EAc2/requirements.pdf',
  true,
  'https://leedonline.usgbc.org/leed/Credit/Detail/EAc2',
  true,
  'leed/energy-atmosphere/EAc2/calculator.xlsx',
  'You are a LEED BD+C v4.1 documentation specialist. Using ONLY the attached requirements PDF for EA Credit 2 (Optimize Energy Performance) and the customer-supplied energy model files, generate the credit compliance narrative and determine achievable points. You must: (1) extract the proposed energy cost savings percentage from the model output, (2) map the percentage savings to the LEED point table in the requirements PDF, (3) determine the number of points achieved, (4) populate the calculator template with model values, (5) write the narrative citing document references. Do not extrapolate or adjust energy model results.',
  ARRAY[
    'Whole-building energy model output report with EUI table',
    'Energy model input files',
    'Mechanical engineer stamp on energy model',
    'Utility rate schedules'
  ],
  'A LEED EA Credit 2 compliance package: narrative (.docx), HTML preview, pre-filled LEED Online form, and completed energy calculator (.xlsx) showing points achieved.',
  'Point determination depends on the accuracy of the energy model submitted. AI populates documentation from model outputs only — engineering judgement on model validity is outside scope.',
  24900,
  true
),

-- WE Credit 1 — Outdoor Water Use Reduction
(
  'leed_bdc_v41',
  'Water Efficiency',
  'WEc1',
  'Outdoor Water Use Reduction',
  2,
  'full',
  'leed/water-efficiency/WEc1/requirements.pdf',
  true,
  'https://leedonline.usgbc.org/leed/Credit/Detail/WEc1',
  true,
  'leed/water-efficiency/WEc1/calculator.xlsx',
  'You are a LEED BD+C v4.1 documentation specialist. Using ONLY the attached requirements PDF for WE Credit 1 (Outdoor Water Use Reduction) and the customer-supplied landscape and irrigation documents, generate the credit compliance narrative. You must: (1) identify whether landscaping option 1 (no irrigation) or option 2 (reduced irrigation) applies, (2) for option 2, extract landscape area types and plant species, calculate baseline vs. design irrigation demand using the LEED water calculator methodology, (3) confirm the reduction percentage meets the credit threshold, (4) cite page numbers from submitted irrigation plans. Populate the calculator template with the extracted species and area values.',
  ARRAY[
    'Landscape plan with plant species list, areas, and irrigation zones',
    'Irrigation system specifications or "no permanent irrigation" confirmation letter',
    'Local ET0 data or NOAA weather station reference',
    'Landscape architect or civil engineer stamp on irrigation drawings'
  ],
  'A LEED WE Credit 1 compliance package: narrative (.docx), HTML preview, pre-filled LEED Online form, and completed water calculator (.xlsx).',
  null,
  14900,
  true
),

-- SS Credit 1 — Site Assessment
(
  'leed_bdc_v41',
  'Sustainable Sites',
  'SSc1',
  'Site Assessment',
  1,
  'full',
  'leed/sustainable-sites/SSc1/requirements.pdf',
  true,
  'https://leedonline.usgbc.org/leed/Credit/Detail/SSc1',
  false,
  null,
  'You are a LEED BD+C v4.1 documentation specialist. Using ONLY the attached requirements PDF for SS Credit 1 (Site Assessment) and the customer-supplied site survey documents, generate the credit compliance narrative. The narrative must confirm that a comprehensive site survey was performed covering: topography, hydrology, climate, vegetation, soils, human use, and human health effects. Extract specific data points from each submitted survey document and map them to the seven required assessment areas. Reference specific page numbers and document names. Do not infer data not present in the submitted files.',
  ARRAY[
    'Site topographic survey',
    'Geotechnical / soils report',
    'Hydrological assessment or FEMA flood zone documentation',
    'Site vegetation / habitat assessment',
    'Climate data summary (solar, wind, precipitation)',
    'Site photographs (minimum 8, annotated)',
    'Civil or landscape architect stamp on site plan'
  ],
  'A LEED SS Credit 1 compliance narrative (.docx), HTML preview, and pre-filled LEED Online form answers mapping each submitted document to the seven required site assessment categories.',
  null,
  9900,
  true
);

-- ============================================================
-- WELL v2 — Sample Credits
-- ============================================================

insert into credits (
  program, category, credit_code, credit_name,
  points_available, automation_type,
  requirements_pdf_path,
  well_verification_row,
  prompt_text, required_customer_documents,
  deliverable_description, partial_notes, price, is_active
) values

-- Air Feature 01 — Fundamental Air Quality
(
  'well_v2',
  'Air',
  'A01',
  'Fundamental Air Quality',
  null,
  'partial',
  'well-v2/air/A01/requirements.pdf',
  3,
  'You are a WELL v2 documentation specialist. Using ONLY the attached requirements PDF for Feature A01 (Fundamental Air Quality) and row 3 of the attached verification-requirements.xlsx (which specifies exactly what documentation IWBI requires for this feature), generate a complete WELL compliance documentation package. You must: (1) address each part of A01 (Parts 1–4 as specified in the requirements PDF), (2) confirm the applicable verification method from the Excel row (policy review, spot measurement, or performance test), (3) draft the narrative addressing each requirement with citations to submitted documents, (4) note any requirements that require on-site testing that cannot be pre-documented. Do not reference any other WELL features.',
  ARRAY[
    'Indoor air quality management plan or HVAC commissioning report',
    'Ventilation design calculations (ASHRAE 62.1 compliance)',
    'Material specifications confirming low-VOC products for adhesives, sealants, coatings, flooring',
    'Smoking policy for the building'
  ],
  'A WELL v2 Feature A01 compliance package: narrative document (.docx), HTML preview, and documentation checklist mapped to IWBI verification requirements.',
  'Part 4 (Air Testing) requires on-site air quality measurements by a qualified assessor after occupancy. This cannot be pre-generated; the package includes preparation guidance and a testing protocol template.',
  14900,
  true
),

-- Water Feature 01 — Fundamental Water Quality
(
  'well_v2',
  'Water',
  'W01',
  'Fundamental Water Quality',
  null,
  'full',
  'well-v2/water/W01/requirements.pdf',
  18,
  'You are a WELL v2 documentation specialist. Using ONLY the attached requirements PDF for Feature W01 (Fundamental Water Quality) and row 18 of the attached verification-requirements.xlsx, generate a complete WELL compliance documentation package. Address each part of W01 as listed in the requirements PDF. For each part: confirm the applicable verification method, draft the policy or design narrative, and map each submitted document to the requirement it satisfies. Cite specific page and section numbers from submitted documents. Do not use knowledge of other WELL features.',
  ARRAY[
    'Water quality test results from a certified laboratory (within 12 months)',
    'Water treatment system documentation (filters, UV, etc.)',
    'Plumbing system flushing protocol',
    'Water system management plan or O&M manual section'
  ],
  'A WELL v2 Feature W01 compliance package: narrative document (.docx), HTML preview, and documentation checklist aligned to IWBI verification requirements.',
  null,
  14900,
  true
),

-- Light Feature 01 — Light Exposure and Education
(
  'well_v2',
  'Light',
  'L01',
  'Light Exposure and Education',
  null,
  'full',
  'well-v2/light/L01/requirements.pdf',
  47,
  'You are a WELL v2 documentation specialist. Using ONLY the attached requirements PDF for Feature L01 (Light Exposure and Education) and row 47 of the attached verification-requirements.xlsx, generate a complete WELL compliance documentation package. Address each part of L01. For policy-based parts, draft the required policy language. For design-based parts, extract the relevant specifications from submitted drawings and confirm compliance against the requirement thresholds. Reference submitted documents precisely.',
  ARRAY[
    'Architectural reflected ceiling plan with fixture schedule',
    'Lighting specification sheets (lumen output, CCT, CRI)',
    'Daylight simulation report or floor plan with glazing areas annotated',
    'Occupant education plan or signage design'
  ],
  'A WELL v2 Feature L01 compliance package: narrative document (.docx), HTML preview, and documentation checklist.',
  null,
  12900,
  true
);

-- ============================================================
-- WELL Health-Safety Rating — Sample Credits
-- ============================================================

insert into credits (
  program, category, credit_code, credit_name,
  points_available, automation_type,
  requirements_pdf_path,
  well_verification_row,
  prompt_text, required_customer_documents,
  deliverable_description, partial_notes, price, is_active
) values

-- SC1 — Cleaning and Sanitization Procedures
(
  'well_hsr',
  'Cleaning & Sanitization',
  'SC1',
  'Cleaning and Sanitization Procedures',
  null,
  'full',
  'well-hsr/cleaning-sanitization/SC1/requirements.pdf',
  5,
  'You are a WELL Health-Safety Rating documentation specialist. Using ONLY the attached requirements PDF for Feature SC1 (Cleaning and Sanitization Procedures) and row 5 of the attached well-hsr/verification-requirements.xlsx, generate a complete compliance documentation package. You must: (1) confirm the required cleaning frequency for each space type, (2) draft a cleaning protocol that meets the specific product and frequency requirements in the requirements PDF, (3) confirm the disinfectant product requirements, (4) address surface touchpoint protocols. Draft all required policy documents in full. Reference submitted documents for any project-specific information.',
  ARRAY[
    'Current cleaning and sanitization protocol or contract',
    'List of cleaning products and Safety Data Sheets (SDS)',
    'Facility floor plan with space types labeled',
    'Touchpoint inventory list (doors, handles, shared equipment)'
  ],
  'A WELL Health-Safety Rating SC1 compliance package: narrative document (.docx), HTML preview, complete drafted cleaning protocol ready for facility adoption, and documentation checklist.',
  null,
  9900,
  true
),

-- SE1 — Emergency Preparedness Program
(
  'well_hsr',
  'Emergency Preparedness',
  'SE1',
  'Emergency Preparedness Program',
  null,
  'partial',
  'well-hsr/emergency-preparedness/SE1/requirements.pdf',
  12,
  'You are a WELL Health-Safety Rating documentation specialist. Using ONLY the attached requirements PDF for Feature SE1 (Emergency Preparedness Program) and row 12 of the attached well-hsr/verification-requirements.xlsx, generate a compliance documentation package. Address each part of SE1: (1) draft the emergency response plan structure based on submitted documents, (2) confirm communication protocol requirements are addressed, (3) identify training documentation requirements, (4) draft the business continuity plan outline. Note clearly any elements that require facility-specific input the customer must complete.',
  ARRAY[
    'Existing emergency response plan (if any)',
    'Building evacuation plan / floor plan with exits',
    'Contact list for emergency services and building management',
    'Occupancy and tenant roster'
  ],
  'A WELL Health-Safety Rating SE1 compliance package: narrative (.docx), HTML preview, drafted emergency response plan template with your building data pre-filled, and documentation checklist.',
  'The emergency response plan template will be pre-filled with your building information but requires review and sign-off by facility management and local emergency services before submission.',
  12900,
  true
);

-- ============================================================
-- Verify seed
-- ============================================================
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from credits;
  raise notice 'Seed complete: % credit rows inserted', v_count;

  -- Verify constraints
  if exists (select 1 from credits where has_calculator = true and calculator_path is null) then
    raise exception 'Constraint violation: has_calculator=true but calculator_path is null';
  end if;

  if exists (select 1 from credits where has_leed_form = true and program != 'leed_bdc_v41') then
    raise exception 'Constraint violation: has_leed_form=true on non-LEED credit';
  end if;

  raise notice 'All constraint checks passed.';
end;
$$;
