"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

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
  // Air
  ventilationStrategy: string;
  airFiltration: string;
  airQualityMonitoring: string;
  smokingPolicy: string;
  combustionAppliances: string;
  // Water
  waterSource: string;
  waterFiltration: string;
  legionellaAssessment: string;
  coolingTower: string;
  // Nourishment
  foodFacilities: string;
  healthyFoodAccess: string;
  vendingMachines: string;
  // Light
  circanianLighting: string;
  windowViewAccess: string;
  lightingControls: string;
  // Movement
  staircaseDesign: string;
  fitnessAmenities: string;
  showersChanging: string;
  outdoorRecreation: string;
  // Thermal
  thermalControl: string;
  radiantSystem: string;
  humidityControl: string;
  // Sound
  acousticStandards: string;
  backgroundNoiseTarget: string;
  acousticWindows: string;
  // Materials
  cleaningProductsPolicy: string;
  hazardousMaterialSurvey: string;
  ipmPolicy: string;
  // Mind
  biophilicDesign: string;
  wellnessSpaces: string;
  mentalHealthPrograms: string;
  // Community
  universalDesign: string;
  equityPolicy: string;
  communitySpaces: string;
};

const INIT: Form = {
  buildingName: "", buildingAddress: "", buildingType: "", certType: "",
  gfa: "", floors: "", regularOccupants: "", peakVisitors: "",
  targetLevel: "", wellAp: "",
  ventilationStrategy: "", airFiltration: "", airQualityMonitoring: "", smokingPolicy: "", combustionAppliances: "",
  waterSource: "", waterFiltration: "", legionellaAssessment: "", coolingTower: "",
  foodFacilities: "", healthyFoodAccess: "", vendingMachines: "",
  circanianLighting: "", windowViewAccess: "", lightingControls: "",
  staircaseDesign: "", fitnessAmenities: "", showersChanging: "", outdoorRecreation: "",
  thermalControl: "", radiantSystem: "", humidityControl: "",
  acousticStandards: "", backgroundNoiseTarget: "", acousticWindows: "",
  cleaningProductsPolicy: "", hazardousMaterialSurvey: "", ipmPolicy: "",
  biophilicDesign: "", wellnessSpaces: "", mentalHealthPrograms: "",
  universalDesign: "", equityPolicy: "", communitySpaces: "",
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

export default function WellV2QuestionnairePage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(INIT);
  const set = (key: keyof Form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

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

        {/* Project Basics */}
        <Section title="Project Basics">
          <Q label="Building name">
            <TextInput value={form.buildingName} onChange={set("buildingName")} placeholder="e.g. One Market Plaza" />
          </Q>
          <Q label="Building address">
            <TextInput value={form.buildingAddress} onChange={set("buildingAddress")} placeholder="Street, city, state, zip" />
          </Q>
          <Q label="Building type">
            <Pills value={form.buildingType} onChange={set("buildingType")}
              options={["Office", "Multifamily", "Retail", "Mixed-use", "Healthcare", "Education", "Other"]} />
          </Q>
          <Q label="Certification type">
            <Pills value={form.certType} onChange={set("certType")}
              options={["New & Existing Buildings", "New & Existing Interiors", "Core & Shell", "Not sure yet"]} />
          </Q>
          <Q label="Gross floor area — estimate is fine (SF)">
            <NumberInput value={form.gfa} onChange={set("gfa")} placeholder="e.g. 150000" />
          </Q>
          <Q label="Number of above-grade floors">
            <NumberInput value={form.floors} onChange={set("floors")} placeholder="e.g. 12" />
          </Q>
          <Q label="Regular occupant count — estimate fine">
            <NumberInput value={form.regularOccupants} onChange={set("regularOccupants")} placeholder="e.g. 500" />
          </Q>
          <Q label="Peak visitor count — estimate fine">
            <NumberInput value={form.peakVisitors} onChange={set("peakVisitors")} placeholder="e.g. 100" />
          </Q>
          <Q label="Target certification level">
            <Pills value={form.targetLevel} onChange={set("targetLevel")}
              options={["Silver", "Gold", "Platinum", "Not sure yet"]} />
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

        <button
          onClick={() => router.push("/orders/gap-analysis-well-v2/documents")}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md group"
        >
          Continue <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
