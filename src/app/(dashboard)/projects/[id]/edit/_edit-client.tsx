"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, AlertTriangle } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

interface ProjectData {
  id:            string;
  name:          string;
  address:       string | null;
  gross_sqft:    number | null;
  stories:       number | null;
  building_type: string | null;
  occupancy:     string | null;
  description:   string | null;
  flagged_fields: string[];
}

export default function EditProjectClient({ project }: { project: ProjectData }) {
  const router = useRouter();

  const [name,      setName]      = useState(project.name);
  const [address,   setAddress]   = useState(project.address ?? "");
  const [sqft,      setSqft]      = useState(String(project.gross_sqft ?? ""));
  const [stories,   setStories]   = useState(String(project.stories ?? ""));
  const [bldgType,  setBldgType]  = useState(project.building_type ?? "");
  const [occupancy, setOccupancy] = useState(project.occupancy ?? "");
  const [desc,      setDesc]      = useState(project.description ?? "");
  const [saving,    setSaving]    = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address:       address      || null,
          gross_sqft:    sqft         ? Number(sqft)    : null,
          stories:       stories      ? Number(stories) : null,
          building_type: bldgType     || null,
          occupancy:     occupancy    || null,
          description:   desc         || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to save");
      }
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const flagged = project.flagged_fields ?? [];

  return (
    <>
      <DashboardHeader
        title="Edit Project"
        subtitle={project.name}
        backHref={`/projects/${project.id}`}
        backLabel={project.name}
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Project info note */}
        <div className="flex items-start gap-3 bg-certify-sage/15 border border-certify-sage/30 rounded-xl px-4 py-3.5 mb-6">
          <Info size={15} className="text-certify-teal shrink-0 mt-0.5" />
          <p className="text-sm text-certify-teal leading-relaxed">
            Project information might have been automatically extracted from your uploaded drawing set. Review all fields and correct anything that doesn&apos;t look right before continuing.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-white rounded-2xl border border-certify-white shadow-card p-6 space-y-5">
            <h3 className="font-serif text-lg text-certify-deep">Project Details</h3>

            <Field label="Project name" required flagged={flagged.includes("name")}>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" />
            </Field>

            <Field label="Building address" flagged={flagged.includes("address")}>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" placeholder="415 Mission St, San Francisco, CA" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Gross sq ft" flagged={flagged.includes("gross_sqft")}>
                <input type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" placeholder="142000" />
              </Field>
              <Field label="Stories" flagged={flagged.includes("stories")}>
                <input type="number" value={stories} onChange={(e) => setStories(e.target.value)} className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" placeholder="18" />
              </Field>
            </div>

            <Field label="Building type" flagged={flagged.includes("building_type")}>
              <select value={bldgType} onChange={(e) => setBldgType(e.target.value)} className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15">
                <option value="">Select type…</option>
                {["Office", "Retail", "Multi-Family Residential", "Mixed-Use", "Laboratory / Life Sciences", "Healthcare", "Education", "Hospitality", "Industrial", "Other"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Occupancy description" flagged={flagged.includes("occupancy")} flagNote="Could not be determined from drawings. Please enter this manually.">
              <input value={occupancy} onChange={(e) => setOccupancy(e.target.value)} className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" placeholder="Class A Commercial Office" />
            </Field>

            <Field label="Project description" flagged={flagged.includes("description")} flagNote="Description could not be extracted. Enter a brief summary for processing context.">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="input-style resize-none"
                placeholder="18-story commercial office tower in San Francisco's South of Market district…"
              />
            </Field>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Link href={`/projects/${project.id}`} className="flex-1 text-center py-3 border border-certify-cool-grey/20 text-certify-dark-grey text-sm font-medium rounded-xl hover:bg-certify-white transition-colors">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 shadow-md"
            >
              {saving ? (
                <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
              ) : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({
  label, required, flagged, flagNote, children,
}: {
  label: string; required?: boolean; flagged?: boolean; flagNote?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-certify-deep/70 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-certify-blue">*</span>}
        {flagged && (
          <span className="ml-2 inline-flex items-center gap-1 text-certify-sand/90 font-normal lowercase tracking-normal">
            <AlertTriangle size={10} /> flagged
          </span>
        )}
      </label>
      {children}
      {flagged && flagNote && (
        <p className="text-xs text-certify-sand mt-1.5 bg-certify-sand/15 border border-certify-sand/30 rounded-lg px-3 py-1.5">
          {flagNote}
        </p>
      )}
    </div>
  );
}
