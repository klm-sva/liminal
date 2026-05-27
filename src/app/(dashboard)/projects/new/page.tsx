"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, PenLine, X } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { createClient } from "@/lib/supabase/client";
import type { ProgramType } from "@/types/database";
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/lib/uploadthing";

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

const PROGRAMS = [
  { id: "leed_bdc_v41", label: "LEED BD+C v4.1", desc: "Building Design + Construction" },
  { id: "well_v2",      label: "WELL v2",          desc: "Building Standard"           },
  { id: "well_hsr",     label: "WELL Health-Safety", desc: "Operational Rating"        },
];

const TARGETS: Record<string, string[]> = {
  leed_bdc_v41: ["Certified (40+ pts)", "Silver (50+ pts)", "Gold (60+ pts)", "Platinum (80+ pts)"],
  well_v2:      ["Bronze", "Silver", "Gold", "Platinum"],
  well_hsr:     ["Annual Seal"],
};

type Method = "upload" | "manual";

export default function NewProjectPage() {
  const router = useRouter();
  const [method,        setMethod]        = useState<Method>("upload");
  const [programs,      setPrograms]      = useState<string[]>(["leed_bdc_v41"]);
  const [target,        setTarget]        = useState("");
  const [dragOver,      setDragOver]      = useState(false);
  const [drawingFile,   setDrawingFile]   = useState<File | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error,         setError]         = useState<string | null>(null);
  const projectIdRef = useRef<string>("");

  const { startUpload, isUploading } = useUploadThing("drawingSet", {
    headers:          () => ({ "x-project-id": projectIdRef.current }),
    onUploadProgress: (p) => setUploadProgress(p),
    onClientUploadComplete: () => {
      router.push(`/projects/${projectIdRef.current}/created`);
    },
    onUploadError: (err) => {
      setError(err.message ?? "Drawing upload failed. Please try again.");
      setSubmitting(false);
    },
  });

  // Manual fields
  const [name,              setName]              = useState("");
  const [address,           setAddress]           = useState("");
  const [sqft,              setSqft]              = useState("");
  const [stories,           setStories]           = useState("");
  const [bldgType,          setBldgType]          = useState("");
  const [occupancy,         setOccupancy]         = useState("");
  const [regularOccupants,  setRegularOccupants]  = useState("");
  const [peakVisitors,      setPeakVisitors]      = useState("");

  function toggleProgram(id: string) {
    setPrograms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Auth service not configured");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const projectName = method === "manual" ? name : (drawingFile?.name ?? "New Project");

      const isManual = method === "manual";
      const { data: project, error: insertError } = await supabase
        .from("projects")
        .insert({
          customer_id:             user.id,
          name:                    projectName,
          programs:                programs as ProgramType[],
          certification_target:    target || null,
          address:                 isManual ? (address || null) : null,
          gross_sqft:              isManual && sqft ? parseInt(sqft, 10) : null,
          stories:                 isManual && stories ? parseInt(stories, 10) : null,
          building_type:           isManual ? (bldgType || null) : null,
          occupancy:               isManual ? (occupancy || null) : null,
          regular_occupants:       isManual && regularOccupants ? parseInt(regularOccupants, 10) : null,
          peak_visitors:           isManual && peakVisitors ? parseInt(peakVisitors, 10) : null,
          // remaining nullable fields — provided explicitly to satisfy ProjectInsert
          net_sqft:                null,
          stories_below_grade:     null,
          primary_occupancy:       null,
          secondary_occupancies:   null,
          description:             null,
          total_parking:           null,
          accessible_parking:      null,
          bicycle_parking:         null,
          site_area_sqft:          null,
          landscaping_sqft:        null,
          impervious_sqft:         null,
          building_footprint_sqft: null,
          dwelling_units:          null,
          occupant_load:           null,
          floor_to_floor_ft:       null,
          floor_to_ceiling_ft:     null,
          window_wall_ratio:       null,
          plumbing_fixtures:       null,
          entrance_count:          null,
          main_entry_description:  null,
          hvac_type:               null,
          lighting_type:           null,
          has_renewable_energy:    null,
          has_water_reuse:         null,
          stormwater_features:     null,
          building_orientation:    null,
          sustainability_notes:    null,
          drawing_data:            null,
          drawings_analyzed_at:    null,
          specs_extracted:         false,
          doc_profiles_extracted:  {},
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      if (method === "upload") {
        if (drawingFile) {
          projectIdRef.current = project.id;
          await startUpload([drawingFile]);
          // redirect handled by onClientUploadComplete
        } else {
          router.push(`/projects/${project.id}/created`);
        }
      } else {
        router.push(`/projects/${project.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  const availableTargets = programs.length === 1
    ? TARGETS[programs[0]] ?? []
    : [];

  return (
    <>
      <DashboardHeader
        title="New Project"
        subtitle="Set up a building project to start running credits and features"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Method toggle */}
        <div className="flex rounded-xl bg-certify-white border border-certify-white p-1 mb-8">
          {([
            { id: "upload", icon: <Upload size={14} />, label: "Upload drawings" },
            { id: "manual", icon: <PenLine size={14} />, label: "Enter manually" },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMethod(opt.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                method === opt.id
                  ? "bg-white text-certify-deep shadow-sm"
                  : "text-certify-cool-grey hover:text-certify-deep"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Upload zone */}
          {method === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) setDrawingFile(file);
              }}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
                dragOver
                  ? "border-certify-blue bg-certify-blue/5"
                  : "border-certify-cool-grey/25 hover:border-certify-blue/40 hover:bg-certify-blue/3"
              }`}
            >
              <input
                type="file"
                accept=".pdf,.dwg,.dxf"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setDrawingFile(file);
                  e.target.value = "";
                }}
              />
              {drawingFile ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-certify-sage/20 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3bfa1" strokeWidth="1.75">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-certify-deep">{drawingFile.name}</p>
                    <p className="text-xs text-certify-sage">Ready to extract project data</p>
                  </div>
                  {!isUploading && (
                    <button type="button" onClick={() => setDrawingFile(null)} className="ml-2 text-certify-cool-grey hover:text-certify-deep">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-certify-blue/10 flex items-center justify-center mx-auto mb-4">
                    <Upload size={24} className="text-certify-blue" />
                  </div>
                  <p className="font-semibold text-certify-deep mb-1">Drop your drawing title page and floor plan here</p>
                  <p className="text-sm text-certify-cool-grey mb-3">or click to browse files</p>
                  <p className="text-xs text-certify-cool-grey/60 mb-2">Please just upload the above sheets. Multiple sheets are not needed at this stage and too many sheets could compromise the output.</p>
                  <p className="text-xs text-certify-cool-grey/60">PDF, DWG, DXF up to 100 MB</p>
                </>
              )}
            </div>
          )}

          {/* Manual fields */}
          {method === "manual" && (
            <div className="bg-white rounded-2xl border border-certify-white shadow-card p-6 space-y-5">
              <h3 className="font-serif text-lg text-certify-deep">Project Details</h3>

              <div>
                <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-certify-deep/70 mb-1.5">Project name <span className="text-certify-blue">*</span></label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Riverside Tower"
                  className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15"
                />
              </div>
              <div>
                <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-certify-deep/70 mb-1.5">Building address</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="415 Mission St, San Francisco, CA" className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-certify-deep/70 mb-1.5">Gross sq ft</label>
                  <input type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="142,000" className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" />
                </div>
                <div>
                  <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-certify-deep/70 mb-1.5">Stories</label>
                  <input type="number" value={stories} onChange={(e) => setStories(e.target.value)} placeholder="18" className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" />
                </div>
              </div>
              <div>
                <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-certify-deep/70 mb-1.5">Building type</label>
                <select value={bldgType} onChange={(e) => setBldgType(e.target.value)} className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15">
                  <option value="">Select type…</option>
                  {["Office", "Retail", "Multi-Family Residential", "Mixed-Use", "Laboratory / Life Sciences", "Healthcare", "Education", "Hospitality", "Industrial", "Other"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-certify-deep/70 mb-1.5">Occupancy description</label>
                <input value={occupancy} onChange={(e) => setOccupancy(e.target.value)} placeholder="Class A Commercial Office" className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" />
              </div>

              <div className="pt-1 border-t border-certify-white">
                <p className="text-[0.65rem] font-semibold tracking-[0.08em] uppercase text-certify-cool-grey mb-3">Occupancy — LEED Registration Data</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-certify-deep/70 mb-1.5">Regular occupants</label>
                    <input
                      type="number"
                      min="0"
                      value={regularOccupants}
                      onChange={(e) => setRegularOccupants(e.target.value)}
                      placeholder="472"
                      className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15"
                    />
                    <p className="text-[0.65rem] text-certify-cool-grey/70 mt-1">FTE students + staff + residents</p>
                  </div>
                  <div>
                    <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-certify-deep/70 mb-1.5">Peak visitors</label>
                    <input
                      type="number"
                      min="0"
                      value={peakVisitors}
                      onChange={(e) => setPeakVisitors(e.target.value)}
                      placeholder="500"
                      className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15"
                    />
                    <p className="text-[0.65rem] text-certify-cool-grey/70 mt-1">Max visitors at any one time</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Certification programs */}
          <div className="bg-white rounded-2xl border border-certify-white shadow-card p-6">
            <h3 className="font-serif text-lg text-certify-deep mb-4">Certification Programs</h3>
            <div className="space-y-2.5">
              {PROGRAMS.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    programs.includes(p.id)
                      ? "border-certify-blue/40 bg-certify-blue/5"
                      : "border-certify-white hover:border-certify-blue/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={programs.includes(p.id)}
                    onChange={() => toggleProgram(p.id)}
                    className="w-4 h-4 accent-certify-blue rounded"
                  />
                  <div>
                    <p className="text-sm font-semibold text-certify-deep">{p.label}</p>
                    <p className="text-xs text-certify-cool-grey">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Target */}
          {availableTargets.length > 0 && (
            <div className="bg-white rounded-2xl border border-certify-white shadow-card p-6">
              <h3 className="font-serif text-lg text-certify-deep mb-4">Certification Target</h3>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15"
              >
                <option value="">Select target level…</option>
                {availableTargets.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm rounded-xl bg-red-50 border border-red-200 text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          {isUploading && (
            <div>
              <div className="flex justify-between text-xs text-certify-cool-grey mb-1.5">
                <span>Uploading drawing…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-certify-white rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%`, background: "linear-gradient(90deg, #388fa6, #1c5e70)" }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || isUploading || programs.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {isUploading ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Uploading {uploadProgress}%…</>
            ) : submitting ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              {method === "upload" ? "Creating project…" : "Creating project…"}</>
            ) : method === "upload" ? (
              "Upload & Extract Data"
            ) : (
              "Create Project"
            )}
          </button>
        </form>
      </div>

    </>
  );
}
