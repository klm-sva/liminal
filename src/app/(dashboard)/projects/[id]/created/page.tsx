import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Project Created" };

export default async function ProjectCreatedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, flagged_fields, auto_extracted")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const flagged = (project.flagged_fields ?? []) as string[];
  const extracted = project.auto_extracted === true;

  return (
    <div className="min-h-screen bg-certify-beige flex flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-md text-center">
        {/* Mint check */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(56,143,166,0.12)", border: "2px solid #388fa6" }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="17" stroke="#388fa6" strokeWidth="2"/>
              <path d="M10 18l5.5 5.5L26 12" stroke="#388fa6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Project created</h1>
        <p className="text-certify-cool-grey leading-relaxed mb-6">
          <strong>{project.name}</strong> has been added to your dashboard.
        </p>

        {/* Extraction result */}
        {extracted ? (
          <div className="text-left bg-white/70 border border-certify-white rounded-xl px-4 py-3 mb-4">
            <p className="text-xs font-semibold text-certify-teal uppercase tracking-wider mb-2">
              ✓ Successfully extracted from drawings
            </p>
            <p className="text-xs text-certify-dark-grey">
              Project details were read from your uploaded drawing set. Review them below to confirm accuracy.
            </p>
          </div>
        ) : (
          <div className="text-left bg-certify-beige border border-certify-sand/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs font-semibold text-certify-cool-grey uppercase tracking-wider mb-1">
              Project details not yet extracted
            </p>
            <p className="text-xs text-certify-dark-grey">
              No drawing analysis has run for this project. Review the project info and fill in any missing fields.
            </p>
          </div>
        )}

        {/* Flagged fields */}
        {flagged.length > 0 && (
          <div className="text-left bg-certify-sand/20 border border-certify-sand/40 rounded-xl px-4 py-3 mb-6 space-y-2">
            <p className="text-xs font-semibold text-certify-teal uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={11} className="text-certify-sand" />
              Needs your input
            </p>
            {flagged.map((f) => (
              <div key={f} className="flex items-start gap-2">
                <AlertTriangle size={11} className="text-certify-sand shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-certify-deep capitalize">{f.replace(/_/g, " ")}</p>
                  <p className="text-xs text-certify-cool-grey">Could not be determined from the drawing set. Please enter this in the edit screen.</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href={`/projects/${project.id}/edit`}
            className="w-full flex items-center justify-center gap-2 bg-certify-deep hover:bg-certify-navy text-white font-semibold py-3.5 rounded-xl transition-all shadow-md"
          >
            Review project info <ArrowRight size={15} />
          </Link>
          <Link
            href={`/projects/${project.id}`}
            className="w-full flex items-center justify-center gap-2 border border-certify-cool-grey/20 text-certify-dark-grey hover:bg-certify-white font-medium py-3.5 rounded-xl transition-colors text-sm"
          >
            Go to project dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
