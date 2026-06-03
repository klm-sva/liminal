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
  regular_occupants:    number | null;
  peak_visitors:        number | null;
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
  certType: string;
  gfa: string;
  floors: string;
  regularOccupants: string;
  peakVisitors: string;
  targetLevel: string;
  wellAp: string;
  ventilationStrategy: string;
  airFiltration: string;
  airQualityMonitoring: string;
  smokingPolicy: string;
  combustionAppliances: string;
  waterSource: string;
  waterFiltration: string;
  legionellaAssessment: string;
  coolingTower: string;
  foodFacilities: string;
  healthyFoodAccess: string;
  vendingMachines: string;
  circanianLighting: string;
  windowViewAccess: string;
  lightingControls: string;
  staircaseDesign: string;
  fitnessAmenities: string;
  showersChanging: string;
  outdoorRecreation: string;
  thermalControl: string;
  radiantSystem: string;
  humidityControl: string;
  acousticStandards: string;
  backgroundNoiseTarget: string;
  acousticWindows: string;
  cleaningProductsPolicy: string;
  hazardousMaterialSurvey: string;
  ipmPolicy: string;
  biophilicDesign: string;
  wellnessSpaces: string;
  mentalHealthPrograms: string;
  universalDesign: string;
  equityPolicy: string;
  communitySpaces: string;
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
  if (project.name && !ff.includes("name"))                                    locked.add("buildingName");
  if (project.address && !ff.includes("address"))                              locked.add("buildingAddress");
  if (project.building_type && !ff.includes("building_type"))                  locked.add("buildingType");
  if (project.gross_sqft != null && !ff.includes("gross_sqft"))                locked.add("gfa");
  if (project.stories != null && !ff.includes("stories"))                      locked.add("floors");
  if (project.regular_occupants != null && !ff.includes("regular_occupants"))  locked.add("regularOccupants");
  if (project.peak_visitors != null && !ff.includes("peak_visitors"))          locked.add("peakVisitors");
  if (project.certification_target && !ff.includes("certification_target"))    locked.add("targetLevel");
  return locked;
}

export default function WellV2QuestionnaireClient({ project }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Form>({
    buildingName:           project?.name ?? "",
    buildingAddress:        project?.address ?? "",
    buildingType:           project?.building_type ?? "",
    certType:               "",
    gfa:                    project?.gross_sqft != null ? String(project.gross_sqft) : "",
    floors:                 project?.stories != null ? String(project.stories) : "",
    regularOccupants:       project?.regular_occupants != null ? String(project.regular_occupants) : "",
    peakVisitors:           project?.peak_visitors != null ? String(project.peak_visitors) : "",
    targetLevel:            project?.certification_target ?? "",
    wellAp:                 "",
    ventilationStrategy:    "",
    airFiltration:          "",
    airQualityMonitoring:   "",
    smokingPolicy:          "",
    combustionAppliances:   "",
    waterSource:            "",
    waterFiltration:        "",
    legionellaAssessment:   "",
    coolingTower:           "",
    foodFacilities:         "",
    healthyFoodAccess:      "",
    vendingMachines:        "",
    circanianLighting:      "",
    windowViewAccess:       "",
    lightingControls:       "",
    staircaseDesign:        "",
    fitnessAmenities:       "",
    showersChanging:        "",
    outdoorRecreation:      "",
    thermalControl:         "",
    radiantSystem:          "",
    humidityControl:        "",
    acousticStandards:      "",
    backgroundNoiseTarget:  "",
    acousticWindows:        "",
    cleaningProductsPolicy: "",
    hazardousMaterialSurvey:"",
    ipmPolicy:              "",
    biophilicDesign:        "",
    wellnessSpaces:         "",
    mentalHealthPrograms:   "",
    universalDesign:        "",
    equityPolicy:           "",
    communitySpaces:        "",
    projectNarrative:       "",
  });

  const [locked, setLocked] = useState<Set<string>>(() => initLocked(project));
  const unlock = (field: string) => setLocked((prev) => { const s = new Set(prev); s.delete(field); return s; });
  const set = (key: keyof Form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  async function handleContinue() {
    setSaving(true);
    try {
      if (project) {
        const updates: Record<string, unknown> = {};
        if (form.buildingName)      updates.name                 = form.buildingName;
        if (form.buildingAddress)   updates.address              = form.buildingAddress;
        if (form.buildingType)      updates.building_type        = form.buildingType;
        if (form.gfa)               updates.gross_sqft           = parseInt(form.gfa, 10);
        if (form.floors)            updates.stories              = parseInt(form.floors, 10);
        if (form.regularOccupants)  updates.regular_occupants    = parseInt(form.regularOccupants, 10);
        if (form.peakVisitors)      updates.peak_visitors        = parseInt(form.peakVisitors, 10);
        if (form.targetLevel)       updates.certification_target = form.targetLevel;

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
        body:    JSON.stringify({ program: "well_v2", responses: form }),
      });
    } finally {
      setSaving(false);
    }
    router.push(`/orders/gap-analysis-well-v2/documents${project ? `?project_id=${project.id}` : ""}`);
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link href="/orders/gap-analysis-well-v2" className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors">
          ← WELL v2 Gap Analysis
        </Link>

        <div className="mb-8">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-certify-blue mb-3">WELL v2 Gap Analysis</span>
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
                {project.address       && <span className="text-xs text-certify-cool-grey">{project.address}</span>}
                {project.building_type && <span className="text-xs text-certify-cool-grey">{project.building_type}</span>}
                {project.gross_sqft    && <span className="text-xs text-certify-cool-grey">{project.gross_sqft.toLocaleString()} SF</span>}
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
                  options={["Office", "Multifamily", "Retail", "Mixed-use", "Healthcare", "Education", "Other"]} />}
          </Q>
          <Q label="Certification type">
            <Pills value={form.certType} onChange={set("certType")}
              options={["New & Existing Buildings", "New & Existing Interiors", "Core & Shell", "Not sure yet"]} />
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
          <Q label="Regular occupant count — estimate fine">
            {locked.has("regularOccupants")
              ? <LockedText value={form.regularOccupants} onEdit={() => unlock("regularOccupants")} />
              : <NumberInput value={form.regularOccupants} onChange={set("regularOccupants")} placeholder="e.g. 500" />}
          </Q>
          <Q label="Peak visitor count — estimate fine">
            {locked.has("peakVisitors")
              ? <LockedText value={form.peakVisitors} onEdit={() => unlock("peakVisitors")} />
              : <NumberInput value={form.peakVisitors} onChange={set("peakVisitors")} placeholder="e.g. 100" />}
          </Q>
          <Q label="Target certification level">
            {locked.has("targetLevel")
              ? <LockedPill value={form.targetLevel} onEdit={() => unlock("targetLevel")} />
              : <Pills value={form.targetLevel} onChange={set("targetLevel")}
                  options={["Silver", "Gold", "Platinum", "Not sure yet"]} />}
          </Q>
          <Q label="Is a WELL AP on the project team?">
            <Pills value={form.wellAp} onChange={set("wellAp")} options={["Yes", "No", "Not yet"]} />
          </Q>
        </Section>

        {/* Air */}
        <Section title="Air (Concept A)"
          note="We'll retrieve outdoor air quality data, climate zone, and ASHRAE 62.1 ventilation minimums from your address.">
          <Q label="Ventilation strategy">
            <Pills value={form.ventilationStrategy} onChange={set("ventilationStrategy")}
              options={["ASHRAE 62.1 baseline", "Enhanced with ERV or HRV", "Dedicated outdoor air system (DOAS)", "Natural ventilation", "Unknown"]} />
          </Q>
          <Q label="Air filtration level">
            <Pills value={form.airFiltration} onChange={set("airFiltration")}
              options={["MERV 8", "MERV 13", "MERV 16+", "HEPA", "Unknown"]} />
          </Q>
          <Q label="Is indoor air quality monitoring planned?">
            <Pills value={form.airQualityMonitoring} onChange={set("airQualityMonitoring")}
              options={["Yes — CO₂ + PM2.5 + VOCs", "Yes — CO₂ only", "Considering it", "No", "Unknown"]} />
          </Q>
          <Q label="Smoking policy">
            <Pills value={form.smokingPolicy} onChange={set("smokingPolicy")}
              options={["Prohibited on entire property", "Designated exterior areas only", "No policy yet", "Unknown"]} />
          </Q>
          <Q label="Are combustion appliances planned in occupied spaces?">
            <Pills value={form.combustionAppliances} onChange={set("combustionAppliances")}
              options={["No — all-electric", "Yes — gas cooking", "Yes — gas heating", "Yes — fireplace or other", "Unknown"]} />
          </Q>
        </Section>

        {/* Water */}
        <Section title="Water (Concept W)"
          note="We'll retrieve local water utility quality reports and WaterSense standards automatically.">
          <Q label="Water source">
            <Pills value={form.waterSource} onChange={set("waterSource")}
              options={["Municipal supply", "Private well", "Mixed / unknown"]} />
          </Q>
          <Q label="Is point-of-use water filtration planned at drinking water fixtures?">
            <Pills value={form.waterFiltration} onChange={set("waterFiltration")}
              options={["Yes", "Considering it", "No", "Unknown"]} />
          </Q>
          <Q label="Has a legionella risk assessment been conducted or planned?">
            <Pills value={form.legionellaAssessment} onChange={set("legionellaAssessment")}
              options={["Yes — completed", "Yes — planned", "No", "Unknown"]} />
          </Q>
          <Q label="Is a cooling tower included in the mechanical system?">
            <Pills value={form.coolingTower} onChange={set("coolingTower")} options={["Yes", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Nourishment */}
        <Section title="Nourishment (Concept N)"
          note="We'll retrieve nearby grocery stores, farmer's markets, and food access data from your address.">
          <Q label="Are food service facilities planned or existing?">
            <Pills value={form.foodFacilities} onChange={set("foodFacilities")}
              options={["Full cafeteria or café", "Pantry or break room only", "None planned", "Unknown"]} />
          </Q>
          <Q label="Will fresh, healthy food options be regularly available on-site?">
            <Pills value={form.healthyFoodAccess} onChange={set("healthyFoodAccess")}
              options={["Yes — catered or stocked daily", "Partially", "No", "Unknown"]} />
          </Q>
          <Q label="Are vending machines planned?">
            <Pills value={form.vendingMachines} onChange={set("vendingMachines")}
              options={["Yes — standard", "Yes — healthy options required", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Light */}
        <Section title="Light (Concept L)"
          note="We'll retrieve local climate and solar data automatically. Window-to-wall ratio can be extracted from drawings if uploaded.">
          <Q label="Is circadian or tunable white lighting being specified?">
            <Pills value={form.circanianLighting} onChange={set("circanianLighting")}
              options={["Yes — full circadian system", "Yes — in key areas only", "Considering it", "No", "Unknown"]} />
          </Q>
          <Q label="Approximate % of workstations with access to windows and exterior views">
            <Pills value={form.windowViewAccess} onChange={set("windowViewAccess")}
              options={["Less than 25%", "25–50%", "50–75%", "75–90%", "90%+", "Unknown"]} />
          </Q>
          <Q label="Lighting control type">
            <Pills value={form.lightingControls} onChange={set("lightingControls")}
              options={["Individual occupant control", "Zone control", "Automated (occupancy + daylight)", "No controls beyond code", "Unknown"]} />
          </Q>
        </Section>

        {/* Movement */}
        <Section title="Movement (Concept V)"
          note="We'll retrieve Walk Score, Transit Score, and active transportation infrastructure from your address.">
          <Q label="Are enhanced staircases (visible, accessible, prominently located) planned?">
            <Pills value={form.staircaseDesign} onChange={set("staircaseDesign")}
              options={["Yes", "Code minimum only", "Unknown"]} />
          </Q>
          <Q label="Fitness amenities on-site">
            <Pills value={form.fitnessAmenities} onChange={set("fitnessAmenities")}
              options={["Full fitness center", "Fitness equipment only", "Outdoor fitness area", "None planned", "Unknown"]} />
          </Q>
          <Q label="Are showers and changing facilities available for active commuters?">
            <Pills value={form.showersChanging} onChange={set("showersChanging")}
              options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Is outdoor recreation space available on or adjacent to the site?">
            <Pills value={form.outdoorRecreation} onChange={set("outdoorRecreation")}
              options={["Yes — dedicated outdoor space", "Yes — nearby park within walking distance", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Thermal Comfort */}
        <Section title="Thermal Comfort (Concept T)"
          note="We'll retrieve ASHRAE 55 thresholds for your climate zone automatically.">
          <Q label="Individual thermal control available to occupants">
            <Pills value={form.thermalControl} onChange={set("thermalControl")}
              options={["Operable windows", "Personal fans or heaters", "Individual thermostat zones", "Zone control only", "No individual control", "Unknown"]} />
          </Q>
          <Q label="Is radiant heating or cooling included?">
            <Pills value={form.radiantSystem} onChange={set("radiantSystem")}
              options={["Yes", "No", "Unknown"]} />
          </Q>
          <Q label="Are humidity sensors and controls specified?">
            <Pills value={form.humidityControl} onChange={set("humidityControl")}
              options={["Yes — monitored and controlled", "Monitored only", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Sound */}
        <Section title="Sound (Concept S)"
          note="We'll retrieve ambient noise levels from traffic and transit data at your address.">
          <Q label="Are acoustic performance standards part of the project program?">
            <Pills value={form.acousticStandards} onChange={set("acousticStandards")}
              options={["Yes — specified", "Considering it", "No", "Unknown"]} />
          </Q>
          <Q label="Background noise level target in occupied spaces">
            <Pills value={form.backgroundNoiseTarget} onChange={set("backgroundNoiseTarget")}
              options={["Below 35 dBA", "35–40 dBA", "No specific target", "Unknown"]} />
          </Q>
          <Q label="Are high-performance acoustic windows specified? (relevant if near road, rail, or airport)">
            <Pills value={form.acousticWindows} onChange={set("acousticWindows")}
              options={["Yes", "Standard glazing", "Unknown"]} />
          </Q>
        </Section>

        {/* Materials */}
        <Section title="Materials (Concept X)"
          note="We don't need product names — just intent and policy status.">
          <Q label="Is a low-VOC or EPA Safer Choice cleaning products policy planned or in place?">
            <Pills value={form.cleaningProductsPolicy} onChange={set("cleaningProductsPolicy")}
              options={["Yes — policy in place", "Yes — in development", "No", "Unknown"]} />
          </Q>
          <Q label="Has a hazardous materials survey been conducted? (for existing buildings or renovations)">
            <Pills value={form.hazardousMaterialSurvey} onChange={set("hazardousMaterialSurvey")}
              options={["Yes — Phase I or II complete", "Planned", "Not applicable — new construction", "No", "Unknown"]} />
          </Q>
          <Q label="Is an integrated pest management (IPM) policy planned or in place?">
            <Pills value={form.ipmPolicy} onChange={set("ipmPolicy")}
              options={["Yes — policy in place", "Yes — in development", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Mind */}
        <Section title="Mind (Concept M)">
          <Q label="Is biophilic design (plants, natural materials, nature views) a stated design goal?">
            <Pills value={form.biophilicDesign} onChange={set("biophilicDesign")}
              options={["Yes — formal biophilic design strategy", "Yes — informal intent", "No", "Unknown"]} />
          </Q>
          <Q label="Are dedicated wellness spaces planned? (meditation room, quiet zones, restorative spaces)">
            <Pills value={form.wellnessSpaces} onChange={set("wellnessSpaces")}
              options={["Yes", "Considering it", "No", "Unknown"]} />
          </Q>
          <Q label="Are mental health programs or resources planned for occupants?">
            <Pills value={form.mentalHealthPrograms} onChange={set("mentalHealthPrograms")}
              options={["Yes — EAP or equivalent", "Partially", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Community */}
        <Section title="Community (Concept C)">
          <Q label="Are universal design or enhanced accessibility features planned beyond code minimums?">
            <Pills value={form.universalDesign} onChange={set("universalDesign")}
              options={["Yes", "Code minimum only", "Unknown"]} />
          </Q>
          <Q label="Is a health equity or diversity and inclusion policy planned or in place?">
            <Pills value={form.equityPolicy} onChange={set("equityPolicy")}
              options={["Yes — policy in place", "In development", "No", "Unknown"]} />
          </Q>
          <Q label="Are community or shared-use spaces included in the building program?">
            <Pills value={form.communitySpaces} onChange={set("communitySpaces")}
              options={["Yes", "No", "Unknown"]} />
          </Q>
        </Section>

        {/* Project Narrative */}
        <Section title="Project Narrative"
          note="Optional. Provide a general project description including intended occupancy, overall building context, and any other relevant characteristics of the project available at this stage of design. Describe the building's anticipated HVAC, lighting, and electrical systems to the extent currently known, noting any decisions still pending. Include planned base building systems and controls, and describe the current project scope of work. You also have the option of uploading a document of the narrative on the next page.">
          <textarea
            value={form.projectNarrative}
            onChange={(e) => setForm((f) => ({ ...f, projectNarrative: e.target.value }))}
            rows={5}
            placeholder="e.g. 12-story mixed-use building completed in 2017. Full DOAS ventilation with MERV-13 filtration. All occupants are long-term tenants. Building has a green roof and on-site fitness center. WELL v1 Silver was previously achieved."
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
