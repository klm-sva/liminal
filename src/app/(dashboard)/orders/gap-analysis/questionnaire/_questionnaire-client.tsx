"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";

interface ProjectPrefill {
  id:                   string;
  name:                 string;
  address:              string | null;
  building_type:        string | null;
  gross_sqft:           number | null;
  stories:              number | null;
  total_parking:        number | null;
  certification_target: string | null;
  flagged_fields:       string[];
}

interface Props {
  project: ProjectPrefill | null;
}

type Form = {
  buildingName: string;
  buildingAddress: string;
  buildingType: string;
  gfa: string;
  floors: string;
  parking: string;
  targetLevel: string;
  leedAp: string;
  energyTarget: string;
  heatingFuel: string;
  coolingSystem: string;
  renewableEnergy: string;
  renewableDetail: string;
  enhancedCommissioning: string;
  refrigerantApproach: string;
  irrigation: string;
  waterReuse: string[];
  coolingTower: string;
  fixtureIntent: string;
  previouslyDeveloped: string;
  existingStructure: string;
  siteArea: string;
  bicycleStorage: string;
  evCharging: string;
  exteriorLighting: string;
  epds: string;
  fscWood: string;
  wasteManagement: string;
  lowEmitting: string;
  ventilation: string;
  daylighting: string;
  acoustic: string;
  constructionIaq: string;
  charrette: string;
  cxAuthority: string;
  contractorSelected: string;
  contractorLeedExperience: string;
};

const WATER_REUSE_OPTS = ["Rainwater harvesting", "Greywater reuse", "Blackwater treatment", "None", "Unknown"];

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
  if (project.name && !ff.includes("name"))                              locked.add("buildingName");
  if (project.address && !ff.includes("address"))                        locked.add("buildingAddress");
  if (project.building_type && !ff.includes("building_type"))            locked.add("buildingType");
  if (project.gross_sqft != null && !ff.includes("gross_sqft"))          locked.add("gfa");
  if (project.stories != null && !ff.includes("stories"))                locked.add("floors");
  if (project.total_parking != null && !ff.includes("total_parking"))    locked.add("parking");
  if (project.certification_target && !ff.includes("certification_target")) locked.add("targetLevel");
  return locked;
}

export default function GapAnalysisQuestionnaireClient({ project }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Form>({
    buildingName:             project?.name ?? "",
    buildingAddress:          project?.address ?? "",
    buildingType:             project?.building_type ?? "",
    gfa:                      project?.gross_sqft != null ? String(project.gross_sqft) : "",
    floors:                   project?.stories != null ? String(project.stories) : "",
    parking:                  project?.total_parking != null ? String(project.total_parking) : "",
    targetLevel:              project?.certification_target ?? "",
    leedAp:                   "",
    energyTarget:             "",
    heatingFuel:              "",
    coolingSystem:            "",
    renewableEnergy:          "",
    renewableDetail:          "",
    enhancedCommissioning:    "",
    refrigerantApproach:      "",
    irrigation:               "",
    waterReuse:               [],
    coolingTower:             "",
    fixtureIntent:            "",
    previouslyDeveloped:      "",
    existingStructure:        "",
    siteArea:                 "",
    bicycleStorage:           "",
    evCharging:               "",
    exteriorLighting:         "",
    epds:                     "",
    fscWood:                  "",
    wasteManagement:          "",
    lowEmitting:              "",
    ventilation:              "",
    daylighting:              "",
    acoustic:                 "",
    constructionIaq:          "",
    charrette:                "",
    cxAuthority:              "",
    contractorSelected:       "",
    contractorLeedExperience: "",
  });

  const [locked, setLocked] = useState<Set<string>>(() => initLocked(project));
  const unlock = (field: string) => setLocked((prev) => { const s = new Set(prev); s.delete(field); return s; });

  const set = (key: keyof Omit<Form, "waterReuse">) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const toggleWaterReuse = (opt: string) =>
    setForm((f) => ({
      ...f,
      waterReuse: f.waterReuse.includes(opt)
        ? f.waterReuse.filter((v) => v !== opt)
        : [...f.waterReuse, opt],
    }));

  async function handleContinue() {
    setSaving(true);
    try {
      if (project) {
        const updates: Record<string, unknown> = {};
        if (form.buildingName)    updates.name                 = form.buildingName;
        if (form.buildingAddress) updates.address              = form.buildingAddress;
        if (form.buildingType)    updates.building_type        = form.buildingType;
        if (form.gfa)             updates.gross_sqft           = parseInt(form.gfa, 10);
        if (form.floors)          updates.stories              = parseInt(form.floors, 10);
        if (form.parking)         updates.total_parking        = parseInt(form.parking, 10);
        if (form.targetLevel)     updates.certification_target = form.targetLevel;

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
        body:    JSON.stringify({ program: "leed_bd_c", responses: form }),
      });
    } finally {
      setSaving(false);
    }
    router.push(`/orders/gap-analysis/documents${project ? `?project_id=${project.id}` : ""}`);
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link href="/orders/gap-analysis" className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors">
          ← LEED Gap Analysis
        </Link>

        <div className="mb-8">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-certify-blue mb-3">LEED Gap Analysis</span>
          <h1 className="font-serif text-3xl text-certify-deep mb-2">Intake questionnaire</h1>
          <p className="text-certify-cool-grey leading-relaxed">
            These are things only your team knows. Everything we can look up from your address and building type, we will.
          </p>
        </div>

        {/* Project summary card */}
        {project && (
          <div className="bg-certify-blue/5 border border-certify-blue/15 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
            <Building2 size={14} className="text-certify-blue shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-certify-deep truncate">{project.name}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {project.address      && <span className="text-xs text-certify-cool-grey">{project.address}</span>}
                {project.building_type && <span className="text-xs text-certify-cool-grey">{project.building_type}</span>}
                {project.gross_sqft   && <span className="text-xs text-certify-cool-grey">{project.gross_sqft.toLocaleString()} SF</span>}
              </div>
            </div>
          </div>
        )}

        {/* Project Basics */}
        <Section title="Project Basics">
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
                  options={["Office", "Multifamily", "Retail", "Mixed-use", "Lab", "Healthcare", "School", "Other"]} />}
          </Q>
          <Q label="Gross floor area — estimate is fine (SF)">
            {locked.has("gfa")
              ? <LockedText value={`${parseInt(form.gfa).toLocaleString()} SF`} onEdit={() => unlock("gfa")} />
              : <NumberInput value={form.gfa} onChange={set("gfa")} placeholder="e.g. 150000" />}
          </Q>
          <Q label="Number of above-grade floors">
            {locked.has("floors")
              ? <LockedText value={form.floors} onEdit={() => unlock("floors")} />
              : <NumberInput value={form.floors} onChange={set("floors")} placeholder="e.g. 12" />}
          </Q>
          <Q label="Number of parking spaces planned — estimate fine (enter 0 if no parking)">
            {locked.has("parking")
              ? <LockedText value={form.parking} onEdit={() => unlock("parking")} />
              : <NumberInput value={form.parking} onChange={set("parking")} placeholder="e.g. 200" />}
          </Q>
          <Q label="Target certification level, if set">
            {locked.has("targetLevel")
              ? <LockedPill value={form.targetLevel} onEdit={() => unlock("targetLevel")} />
              : <Pills value={form.targetLevel} onChange={set("targetLevel")}
                  options={["Certified", "Silver", "Gold", "Platinum", "Not sure yet"]} />}
          </Q>
          <Q label="Is a LEED AP on the project team?">
            <Pills value={form.leedAp} onChange={set("leedAp")} options={["Yes", "No", "Not yet"]} />
          </Q>
        </Section>

        {/* Energy & Mechanical */}
        <Section title="Energy & Mechanical"
          note="We'll look up your climate zone, grid emission factor, and solar potential automatically. These are things only your team knows.">
          <Q label="What is your current energy performance target, if any?">
            <Pills value={form.energyTarget} onChange={set("energyTarget")}
              options={["ASHRAE 90.1 baseline", "10–14% better", "15–19% better", "20–29% better", "30%+ better", "Net zero", "No target set yet"]} />
          </Q>
          <Q label="Primary heating fuel">
            <Pills value={form.heatingFuel} onChange={set("heatingFuel")}
              options={["Electric", "Natural gas", "District steam or hot water", "Mixed", "Unknown"]} />
          </Q>
          <Q label="Primary cooling system type">
            <Pills value={form.coolingSystem} onChange={set("coolingSystem")}
              options={["Chilled water plant", "DX", "VRF", "District chilled water", "Mixed", "Unknown"]} />
          </Q>
          <Q label="Is on-site renewable energy (solar PV) planned?">
            <Pills value={form.renewableEnergy} onChange={set("renewableEnergy")}
              options={["Yes — size or % offset known", "Yes — considering it", "No", "Unknown"]} />
          </Q>
          {form.renewableEnergy === "Yes — size or % offset known" && (
            <Q label="Approximate DC system size (kW) or target offset (% of annual consumption)">
              <TextInput value={form.renewableDetail} onChange={set("renewableDetail")} placeholder="e.g. 250 kW or 30%" />
            </Q>
          )}
          <Q label="Is enhanced commissioning planned or contracted?">
            <Pills value={form.enhancedCommissioning} onChange={set("enhancedCommissioning")}
              options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Refrigerant approach">
            <Pills value={form.refrigerantApproach} onChange={set("refrigerantApproach")}
              options={["Natural refrigerants", "Low-GWP synthetics", "Standard — no specific requirement", "Unknown"]} />
          </Q>
        </Section>

        {/* Water */}
        <Section title="Water"
          note="We'll look up your climate zone's evapotranspiration rate and WaterSense standards automatically.">
          <Q label="Is irrigation planned for this project?">
            <Pills value={form.irrigation} onChange={set("irrigation")}
              options={["No irrigation", "High-efficiency drip or micro", "Conventional spray", "Unknown"]} />
          </Q>
          <Q label="Are any of the following water reuse systems planned?">
            <div className="mt-2 flex flex-wrap gap-2">
              {WATER_REUSE_OPTS.map((opt) => {
                const selected = form.waterReuse.includes(opt);
                return (
                  <button key={opt} type="button" onClick={() => toggleWaterReuse(opt)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      selected
                        ? "border-certify-blue bg-certify-blue/5 text-certify-blue"
                        : "border-certify-white text-certify-cool-grey hover:border-certify-blue/30 bg-white"
                    }`}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </Q>
          <Q label="Is a cooling tower included in the mechanical system?">
            <Pills value={form.coolingTower} onChange={set("coolingTower")} options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Fixture specification intent">
            <Pills value={form.fixtureIntent} onChange={set("fixtureIntent")}
              options={["WaterSense minimum", "High-efficiency beyond WaterSense", "Net zero water approach", "No specific requirement yet"]} />
          </Q>
        </Section>

        {/* Site & Building */}
        <Section title="Site & Building"
          note="We'll retrieve flood zone, wetlands, brownfield status, transit, density, and cycling network automatically from your address.">
          <Q label="Is this a previously developed site?">
            <Pills value={form.previouslyDeveloped} onChange={set("previouslyDeveloped")} options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Is any existing structure being retained or reused?">
            <Pills value={form.existingStructure} onChange={set("existingStructure")}
              options={["No — full demolition or new site", "Partial structural reuse", "Full adaptive reuse"]} />
          </Q>
          <Q label="Approximate site area (acres) — estimate fine">
            <NumberInput value={form.siteArea} onChange={set("siteArea")} placeholder="e.g. 2.5" />
          </Q>
          <Q label="Is dedicated bicycle storage planned?">
            <Pills value={form.bicycleStorage} onChange={set("bicycleStorage")} options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Is EV charging infrastructure planned?">
            <Pills value={form.evCharging} onChange={set("evCharging")} options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Exterior lighting approach">
            <Pills value={form.exteriorLighting} onChange={set("exteriorLighting")}
              options={["Full cutoff fixtures specified", "Dark-sky compliant design intent", "Standard — no specific requirement", "Unknown"]} />
          </Q>
        </Section>

        {/* Materials */}
        <Section title="Materials"
          note="We don't need product names here — just intent. We'll cross-reference specs if you upload them.">
          <Q label="Is the team actively specifying products with Environmental Product Declarations (EPDs)?">
            <Pills value={form.epds} onChange={set("epds")} options={["Yes", "No", "Considering it", "Unknown"]} />
          </Q>
          <Q label="Is sustainably sourced or FSC-certified wood being specified?">
            <Pills value={form.fscWood} onChange={set("fscWood")} options={["Yes", "No", "Considering it", "Unknown"]} />
          </Q>
          <Q label="Is a construction waste management plan included in the project scope?">
            <Pills value={form.wasteManagement} onChange={set("wasteManagement")} options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Low-emitting materials approach">
            <Pills value={form.lowEmitting} onChange={set("lowEmitting")}
              options={["Specified for all interior products", "Specified for some", "Not yet addressed", "Unknown"]} />
          </Q>
        </Section>

        {/* Indoor Environment */}
        <Section title="Indoor Environment"
          note="We'll retrieve ASHRAE ventilation requirements for your building type automatically.">
          <Q label="Ventilation strategy">
            <Pills value={form.ventilation} onChange={set("ventilation")}
              options={["ASHRAE 62.1 baseline", "Enhanced with ERV or HRV", "Dedicated outdoor air system (DOAS)", "Natural ventilation", "Unknown"]} />
          </Q>
          <Q label="Is daylighting a stated design priority?">
            <Pills value={form.daylighting} onChange={set("daylighting")}
              options={["Yes — modeled or designed for it", "Yes — intent only", "No", "Unknown"]} />
          </Q>
          <Q label="Are acoustic performance requirements part of the program?">
            <Pills value={form.acoustic} onChange={set("acoustic")} options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Is a construction IAQ management plan planned?">
            <Pills value={form.constructionIaq} onChange={set("constructionIaq")} options={["Yes", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Team & Process */}
        <Section title="Team & Process">
          <Q label="Has a pre-design sustainability charrette or goal-setting session occurred?">
            <Pills value={form.charrette} onChange={set("charrette")} options={["Yes", "No"]} />
          </Q>
          <Q label="Is a commissioning authority engaged or identified?">
            <Pills value={form.cxAuthority} onChange={set("cxAuthority")} options={["Yes", "No", "Not yet"]} />
          </Q>
          <Q label="Is the contractor selected?">
            <Pills value={form.contractorSelected} onChange={set("contractorSelected")} options={["Yes", "No"]} />
          </Q>
          {form.contractorSelected === "Yes" && (
            <Q label="Does the contractor have documented LEED project experience?">
              <Pills value={form.contractorLeedExperience} onChange={set("contractorLeedExperience")}
                options={["Yes", "No", "Unknown"]} />
            </Q>
          )}
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
