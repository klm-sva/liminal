"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";

interface ProjectPrefill {
  id:                string;
  name:              string;
  address:           string | null;
  building_type:     string | null;
  gross_sqft:        number | null;
  regular_occupants: number | null;
  flagged_fields:    string[];
}

interface Props {
  project: ProjectPrefill | null;
}

type Form = {
  buildingName: string;
  buildingAddress: string;
  buildingType: string;
  gfa: string;
  regularOccupants: string;
  managementType: string;
  existingOrNew: string;
  previousCertification: string;
  cleaningFrequency: string;
  cleaningProducts: string;
  cleaningProtocolsDocumented: string;
  handwashingSupport: string;
  handSanitizerDispensers: string;
  cleaningStaffTrained: string;
  emergencyPlan: string;
  emergencyPlanUpdated: string;
  emergencyTraining: string;
  emergencyResponseTeam: string;
  emergencySupplies: string;
  businessContinuityPlan: string;
  aeds: string;
  firstAidKits: string;
  healthClinic: string;
  cprTrainedStaff: string;
  mentalHealthResources: string;
  hvacFiltration: string;
  hvacMaintenanceSchedule: string;
  outdoorAirCompliance: string;
  smokingProhibited: string;
  iaqMonitoring: string;
  combustionInSpaces: string;
  waterSupply: string;
  lastWaterTest: string;
  waterManagementPlan: string;
  coolingTower: string;
  drinkingWaterFilters: string;
  occupantCommunications: string;
  occupantFeedbackMechanism: string;
  occupantSurveys: string;
  wellnessPrograms: string;
  wellnessChampion: string;
  hsrCommunicated: string;
  projectNarrative: string;
};

function Pills({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            value === opt
              ? "border-certify-blue bg-certify-blue/5 text-certify-blue"
              : "border-certify-white text-certify-cool-grey hover:border-certify-blue/30 bg-white"
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-certify-deep">{label}</p>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="mt-2 w-full text-sm border border-certify-white rounded-xl px-4 py-2.5 text-certify-deep placeholder:text-certify-cool-grey/40 focus:outline-none focus:border-certify-blue/40 bg-white" />
  );
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="mt-2 w-full text-sm border border-certify-white rounded-xl px-4 py-2.5 text-certify-deep placeholder:text-certify-cool-grey/40 focus:outline-none focus:border-certify-blue/40 bg-white" />
  );
}

function LockedText({ value, onEdit }: { value: string; onEdit: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="flex-1 text-sm text-certify-deep border border-certify-white bg-certify-white/60 rounded-xl px-4 py-2.5 truncate">
        {value}
      </span>
      <button type="button" onClick={onEdit}
        className="shrink-0 text-xs text-certify-blue hover:text-certify-teal transition-colors">
        Edit
      </button>
    </div>
  );
}

function LockedPill({ value, onEdit }: { value: string; onEdit: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="px-3 py-1.5 rounded-lg border border-certify-blue bg-certify-blue/5 text-certify-blue text-xs font-medium">
        {value}
      </span>
      <button type="button" onClick={onEdit}
        className="text-xs text-certify-blue hover:text-certify-teal transition-colors">
        Edit
      </button>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-6">
      <div className="mb-5">
        <h3 className="font-serif text-lg text-certify-deep">{title}</h3>
        {note && <p className="text-xs text-certify-cool-grey mt-1 leading-relaxed">{note}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function initLocked(project: ProjectPrefill | null): Set<string> {
  if (!project) return new Set();
  const ff = project.flagged_fields ?? [];
  const locked = new Set<string>();
  if (project.name && !ff.includes("name"))                                   locked.add("buildingName");
  if (project.address && !ff.includes("address"))                             locked.add("buildingAddress");
  if (project.building_type && !ff.includes("building_type"))                 locked.add("buildingType");
  if (project.gross_sqft != null && !ff.includes("gross_sqft"))               locked.add("gfa");
  if (project.regular_occupants != null && !ff.includes("regular_occupants")) locked.add("regularOccupants");
  return locked;
}

export default function WellHsrQuestionnaireClient({ project }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Form>({
    buildingName:                project?.name ?? "",
    buildingAddress:             project?.address ?? "",
    buildingType:                project?.building_type ?? "",
    gfa:                         project?.gross_sqft != null ? String(project.gross_sqft) : "",
    regularOccupants:            project?.regular_occupants != null ? String(project.regular_occupants) : "",
    managementType:              "",
    existingOrNew:               "",
    previousCertification:       "",
    cleaningFrequency:           "",
    cleaningProducts:            "",
    cleaningProtocolsDocumented: "",
    handwashingSupport:          "",
    handSanitizerDispensers:     "",
    cleaningStaffTrained:        "",
    emergencyPlan:               "",
    emergencyPlanUpdated:        "",
    emergencyTraining:           "",
    emergencyResponseTeam:       "",
    emergencySupplies:           "",
    businessContinuityPlan:      "",
    aeds:                        "",
    firstAidKits:                "",
    healthClinic:                "",
    cprTrainedStaff:             "",
    mentalHealthResources:       "",
    hvacFiltration:              "",
    hvacMaintenanceSchedule:     "",
    outdoorAirCompliance:        "",
    smokingProhibited:           "",
    iaqMonitoring:               "",
    combustionInSpaces:          "",
    waterSupply:                 "",
    lastWaterTest:               "",
    waterManagementPlan:         "",
    coolingTower:                "",
    drinkingWaterFilters:        "",
    occupantCommunications:      "",
    occupantFeedbackMechanism:   "",
    occupantSurveys:             "",
    wellnessPrograms:            "",
    wellnessChampion:            "",
    hsrCommunicated:             "",
    projectNarrative:            "",
  });

  const [locked, setLocked] = useState<Set<string>>(() => initLocked(project));
  const unlock = (field: string) => setLocked((prev) => { const s = new Set(prev); s.delete(field); return s; });
  const set = (key: keyof Form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  async function handleContinue() {
    setSaving(true);
    try {
      if (project) {
        const updates: Record<string, unknown> = {};
        if (form.buildingName)     updates.name              = form.buildingName;
        if (form.buildingAddress)  updates.address           = form.buildingAddress;
        if (form.buildingType)     updates.building_type     = form.buildingType;
        if (form.gfa)              updates.gross_sqft        = parseInt(form.gfa, 10);
        if (form.regularOccupants) updates.regular_occupants = parseInt(form.regularOccupants, 10);

        if (Object.keys(updates).length > 0) {
          await fetch(`/api/projects/${project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
        }
      }

      await fetch("/api/gap-analysis/responses", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ program: "well_hsr", responses: form }),
      });
    } finally {
      setSaving(false);
    }
    router.push(`/orders/gap-analysis-well-hsr/documents${project ? `?project_id=${project.id}` : ""}`);
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link href="/orders/gap-analysis-well-hsr" className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors">
          ← WELL HSR Gap Analysis
        </Link>

        <div className="mb-8">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-certify-blue mb-3">WELL HSR Gap Analysis</span>
          <h1 className="font-serif text-3xl text-certify-deep mb-2">Intake questionnaire</h1>
          <p className="text-certify-cool-grey leading-relaxed">
            These questions cover your building&apos;s current operations and policies. Answer based on what is in place today — gaps are exactly what we are here to identify.
          </p>
        </div>

        {/* Project summary card */}
        {project && (
          <div className="bg-certify-blue/5 border border-certify-blue/15 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
            <Building2 size={14} className="text-certify-blue shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-certify-deep truncate">{project.name}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {project.address       && <span className="text-xs text-certify-cool-grey">{project.address}</span>}
                {project.building_type && <span className="text-xs text-certify-cool-grey">{project.building_type}</span>}
                {project.gross_sqft    && <span className="text-xs text-certify-cool-grey">{project.gross_sqft.toLocaleString()} SF</span>}
              </div>
            </div>
          </div>
        )}

        {/* Building Overview */}
        <Section title="Building Overview">
          <Q label="Building name">
            {locked.has("buildingName")
              ? <LockedText value={form.buildingName} onEdit={() => unlock("buildingName")} />
              : <TextInput value={form.buildingName} onChange={set("buildingName")} placeholder="e.g. One Market Plaza" />}
          </Q>
          <Q label="Building address">
            {locked.has("buildingAddress")
              ? <LockedText value={form.buildingAddress} onEdit={() => unlock("buildingAddress")} />
              : <TextInput value={form.buildingAddress} onChange={set("buildingAddress")} placeholder="Street, city, state, zip" />}
          </Q>
          <Q label="Building type">
            {locked.has("buildingType")
              ? <LockedPill value={form.buildingType} onEdit={() => unlock("buildingType")} />
              : <Pills value={form.buildingType} onChange={set("buildingType")}
                  options={["Office", "Multifamily", "Retail", "Healthcare", "Hotel / Hospitality", "Industrial", "Mixed-use", "Other"]} />}
          </Q>
          <Q label="Gross floor area — estimate is fine (SF)">
            {locked.has("gfa")
              ? <LockedText value={`${parseInt(form.gfa).toLocaleString()} SF`} onEdit={() => unlock("gfa")} />
              : <NumberInput value={form.gfa} onChange={set("gfa")} placeholder="e.g. 150000" />}
          </Q>
          <Q label="Regular occupant count — estimate fine">
            {locked.has("regularOccupants")
              ? <LockedText value={form.regularOccupants} onEdit={() => unlock("regularOccupants")} />
              : <NumberInput value={form.regularOccupants} onChange={set("regularOccupants")} placeholder="e.g. 500" />}
          </Q>
          <Q label="Building management type">
            <Pills value={form.managementType} onChange={set("managementType")}
              options={["Owner-operated", "Professional property management", "Multiple tenants — tenant-managed", "Mixed"]} />
          </Q>
          <Q label="Existing building or new construction?">
            <Pills value={form.existingOrNew} onChange={set("existingOrNew")}
              options={["Existing building", "New construction", "Major renovation"]} />
          </Q>
          <Q label="Has the building previously received any health or safety certification?">
            <Pills value={form.previousCertification} onChange={set("previousCertification")}
              options={["Yes — WELL HSR", "Yes — other (BOMA, LEED O+M, etc.)", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Cleaning & Sanitization */}
        <Section title="Cleaning & Sanitization (SC)"
          note="SC features cover cleaning frequency, product safety, handwashing support, and documented protocols.">
          <Q label="Current cleaning frequency for occupied spaces">
            <Pills value={form.cleaningFrequency} onChange={set("cleaningFrequency")}
              options={["Multiple times per day", "Daily", "Several times per week", "Weekly or less", "Contracted — frequency unknown"]} />
          </Q>
          <Q label="Are EPA Safer Choice or equivalent low-toxicity cleaning products currently used?">
            <Pills value={form.cleaningProducts} onChange={set("cleaningProducts")}
              options={["Yes — Safer Choice or equivalent", "Some products only", "No — standard products", "Unknown"]} />
          </Q>
          <Q label="Are written cleaning and disinfection protocols documented and followed?">
            <Pills value={form.cleaningProtocolsDocumented} onChange={set("cleaningProtocolsDocumented")}
              options={["Yes — fully documented", "Partially documented", "No", "Unknown"]} />
          </Q>
          <Q label="Is handwashing support (soap + single-use towels or air dryers) present at all handwashing stations?">
            <Pills value={form.handwashingSupport} onChange={set("handwashingSupport")}
              options={["Yes — all stations", "Most stations", "Some stations", "No", "Unknown"]} />
          </Q>
          <Q label="Are hand sanitizer dispensers available at building entrances and high-touch areas?">
            <Pills value={form.handSanitizerDispensers} onChange={set("handSanitizerDispensers")}
              options={["Yes", "Partially", "No", "Unknown"]} />
          </Q>
          <Q label="Are cleaning staff trained in current protocols?">
            <Pills value={form.cleaningStaffTrained} onChange={set("cleaningStaffTrained")}
              options={["Yes — documented training", "Informal training only", "No formal training", "Unknown"]} />
          </Q>
        </Section>

        {/* Emergency Preparedness */}
        <Section title="Emergency Preparedness (SE)"
          note="SE features cover emergency plans, staff training, response teams, and supply readiness.">
          <Q label="Does the building have a documented emergency response plan?">
            <Pills value={form.emergencyPlan} onChange={set("emergencyPlan")}
              options={["Yes — fully documented", "In development", "No", "Unknown"]} />
          </Q>
          {form.emergencyPlan === "Yes — fully documented" && (
            <Q label="When was it last reviewed or updated?">
              <Pills value={form.emergencyPlanUpdated} onChange={set("emergencyPlanUpdated")}
                options={["Within the last 12 months", "1–3 years ago", "More than 3 years ago", "Unknown"]} />
            </Q>
          )}
          <Q label="Are building staff trained in emergency procedures?">
            <Pills value={form.emergencyTraining} onChange={set("emergencyTraining")}
              options={["Yes — documented training", "Informal training only", "No", "Unknown"]} />
          </Q>
          <Q label="Is there a designated emergency response team or floor warden structure?">
            <Pills value={form.emergencyResponseTeam} onChange={set("emergencyResponseTeam")}
              options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Are emergency supply kits (first aid, water, flashlights) maintained on-site?">
            <Pills value={form.emergencySupplies} onChange={set("emergencySupplies")}
              options={["Yes — stocked and inspected regularly", "Yes — not regularly inspected", "No", "Unknown"]} />
          </Q>
          <Q label="Is there a business continuity plan for operations disruption?">
            <Pills value={form.businessContinuityPlan} onChange={set("businessContinuityPlan")}
              options={["Yes", "In development", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Health Services */}
        <Section title="Health Services (SH)"
          note="SH features cover on-site health resources, emergency response equipment, and wellness access.">
          <Q label="Are AEDs (automated external defibrillators) installed in the building?">
            <Pills value={form.aeds} onChange={set("aeds")}
              options={["Yes — multiple locations", "Yes — one unit", "No", "Unknown"]} />
          </Q>
          <Q label="Are first aid kits available and regularly restocked?">
            <Pills value={form.firstAidKits} onChange={set("firstAidKits")}
              options={["Yes — maintained and inspected", "Yes — not regularly checked", "No", "Unknown"]} />
          </Q>
          <Q label="Is there a nurse station or health clinic on-site or on campus?">
            <Pills value={form.healthClinic} onChange={set("healthClinic")}
              options={["Yes — on-site clinic", "Yes — nearby campus clinic", "No", "Unknown"]} />
          </Q>
          <Q label="Are CPR and first aid trained staff present during all occupied hours?">
            <Pills value={form.cprTrainedStaff} onChange={set("cprTrainedStaff")}
              options={["Yes", "Some shifts only", "No", "Unknown"]} />
          </Q>
          <Q label="Are mental health resources communicated to occupants?">
            <Pills value={form.mentalHealthResources} onChange={set("mentalHealthResources")}
              options={["Yes — EAP or equivalent promoted", "Partially", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Air Quality */}
        <Section title="Air Quality (SA)"
          note="SA features cover HVAC filtration, ventilation, smoking policy, and indoor air quality management.">
          <Q label="Current HVAC air filtration rating">
            <Pills value={form.hvacFiltration} onChange={set("hvacFiltration")}
              options={["MERV 8 or below", "MERV 13", "MERV 16+", "HEPA", "Unknown"]} />
          </Q>
          <Q label="Are HVAC systems on a documented maintenance and inspection schedule?">
            <Pills value={form.hvacMaintenanceSchedule} onChange={set("hvacMaintenanceSchedule")}
              options={["Yes — documented schedule", "Informal / as-needed", "No", "Unknown"]} />
          </Q>
          <Q label="Is outdoor air quantity meeting or exceeding ASHRAE 62.1 minimum requirements?">
            <Pills value={form.outdoorAirCompliance} onChange={set("outdoorAirCompliance")}
              options={["Yes — confirmed", "Believed to be compliant", "Unknown", "No"]} />
          </Q>
          <Q label="Is smoking prohibited in and immediately around the building?">
            <Pills value={form.smokingProhibited} onChange={set("smokingProhibited")}
              options={["Yes — full property smoke-free", "Designated exterior areas only", "No policy in place", "Unknown"]} />
          </Q>
          <Q label="Is indoor air quality monitoring in place?">
            <Pills value={form.iaqMonitoring} onChange={set("iaqMonitoring")}
              options={["Yes — CO₂ + PM2.5 monitored", "Yes — CO₂ only", "No", "Unknown"]} />
          </Q>
          <Q label="Are combustion appliances present in occupied spaces?">
            <Pills value={form.combustionInSpaces} onChange={set("combustionInSpaces")}
              options={["No — all-electric building", "Yes — gas cooking", "Yes — gas heating", "Yes — fireplace or other", "Unknown"]} />
          </Q>
        </Section>

        {/* Water Quality */}
        <Section title="Water Quality (SS)"
          note="SS features cover water testing, legionella risk management, and drinking water quality.">
          <Q label="Water supply source">
            <Pills value={form.waterSupply} onChange={set("waterSupply")}
              options={["Municipal supply", "Private well", "Mixed / unknown"]} />
          </Q>
          <Q label="When was the last water quality test conducted?">
            <Pills value={form.lastWaterTest} onChange={set("lastWaterTest")}
              options={["Within the last 12 months", "1–3 years ago", "More than 3 years ago", "Never / unknown"]} />
          </Q>
          <Q label="Is there a documented water management plan (legionella prevention)?">
            <Pills value={form.waterManagementPlan} onChange={set("waterManagementPlan")}
              options={["Yes — ASHRAE 188 or equivalent", "In development", "No", "Unknown"]} />
          </Q>
          <Q label="Is a cooling tower present? If yes, is it on a chemical treatment program?">
            <Pills value={form.coolingTower} onChange={set("coolingTower")}
              options={["Yes — on chemical treatment program", "Yes — no formal treatment program", "No cooling tower", "Unknown"]} />
          </Q>
          <Q label="Are water filters installed at drinking water fixtures?">
            <Pills value={form.drinkingWaterFilters} onChange={set("drinkingWaterFilters")}
              options={["Yes", "Partially", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Stakeholder Engagement */}
        <Section title="Stakeholder Engagement (SI)"
          note="SI features cover occupant communication, wellness programming, and health transparency.">
          <Q label="Are regular health and safety communications sent to building occupants?">
            <Pills value={form.occupantCommunications} onChange={set("occupantCommunications")}
              options={["Yes — regular cadence", "Ad hoc only", "No", "Unknown"]} />
          </Q>
          <Q label="Is there a mechanism for occupants to report health or safety concerns?">
            <Pills value={form.occupantFeedbackMechanism} onChange={set("occupantFeedbackMechanism")}
              options={["Yes — dedicated channel", "General maintenance requests only", "No formal mechanism", "Unknown"]} />
          </Q>
          <Q label="Have occupant health or satisfaction surveys been conducted in the last 12 months?">
            <Pills value={form.occupantSurveys} onChange={set("occupantSurveys")}
              options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Are wellness programs or resources actively offered to building occupants?">
            <Pills value={form.wellnessPrograms} onChange={set("wellnessPrograms")}
              options={["Yes — multiple programs", "Yes — one program", "No", "Unknown"]} />
          </Q>
          <Q label="Is a building wellness or health champion identified?">
            <Pills value={form.wellnessChampion} onChange={set("wellnessChampion")}
              options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Is WELL HSR status or health and safety information communicated publicly?">
            <Pills value={form.hsrCommunicated} onChange={set("hsrCommunicated")}
              options={["Yes — signage and/or website", "Internally only", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Project Narrative */}
        <Section title="Project Narrative"
          note="Optional. Describe the building in your own words — age, recent upgrades, operational context, management structure, known health and safety initiatives, or anything else relevant. Claude reads this to provide more accurate analysis.">
          <textarea
            value={form.projectNarrative}
            onChange={(e) => setForm((f) => ({ ...f, projectNarrative: e.target.value }))}
            rows={5}
            placeholder="e.g. 8-story Class B office building built in 1988, renovated in 2015. Managed by an in-house facilities team of 4. HVAC was replaced in 2020 with MERV-11 filters. No previous WELL or LEED certifications. Building has a wellness room but no formal occupant wellness program."
            className="mt-2 w-full text-sm border border-certify-white rounded-xl px-4 py-2.5 text-certify-deep placeholder:text-certify-cool-grey/40 focus:outline-none focus:border-certify-blue/40 bg-white resize-none"
          />
        </Section>

        <button
          onClick={handleContinue}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md group disabled:opacity-60"
        >
          {saving ? "Saving…" : <>Continue <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" /></>}
        </button>
      </div>
    </div>
  );
}
