import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "LEED Gap Analysis" };

const INCLUDED = [
  "Current points estimate based on your project data",
  "Gap to your certification target threshold",
  "Category-by-category score breakdown",
  "Prioritized list of credits with the highest point return",
  "Downloadable report with your roadmap to a successful certification",
];

export default async function GapAnalysisDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { project_id: projectId } = await searchParams;
  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link href="/dashboard" className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors">
          ← Back
        </Link>

        {/* Header */}
        <div className="mb-8">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-certify-blue mb-3">LEED Gap Analysis</span>
          <h1 className="font-serif text-4xl text-certify-deep mb-3">LEED Gap Analysis Report</h1>
          <p className="text-certify-cool-grey leading-relaxed">
            Start with a gap analysis for the best path to certification. We do the analysis and provide a step by step process for you. Everything you need to do in one report. You&apos;ll receive a scored baseline for your project that shows where you stand today, where the gaps are, and which credits to pursue first to reach your certification target.
          </p>
        </div>

        {/* What it produces — dark gradient card */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 mb-6"
          style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)" }}
        >
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
          />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-widest text-certify-light/50 mb-3">What this produces</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                "Overall score estimate",
                "Certification level gap",
                "Recommended credit list",
                "Downloadable report",
              ].map((label) => (
                <div key={label} className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #388fa6, #1c5e70)", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.2)" }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  </div>
                  <span className="text-xs font-medium text-white">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Included checklist */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-serif text-lg text-certify-deep mb-4">Everything included</h3>
          <ul className="space-y-2.5">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-certify-teal shrink-0 mt-0.5" />
                <span className="text-sm text-certify-dark-grey">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing */}
        <div className="flex items-center justify-between bg-certify-beige border border-certify-sand/40 rounded-xl px-5 py-4 mb-6">
          <div>
            <p className="font-serif text-2xl text-certify-deep">$499 <span className="text-base text-certify-cool-grey font-sans font-normal">pilot price</span></p>
            <p className="text-xs text-certify-cool-grey mt-0.5">One-time fee · delivered within 48 hours</p>
          </div>
          <Link
            href={`/orders/gap-analysis/questionnaire${projectId ? `?project_id=${projectId}` : ""}`}
            className="inline-flex items-center gap-1.5 bg-certify-blue hover:bg-certify-teal text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md text-sm group"
          >
            Continue <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <p className="text-xs text-certify-cool-grey text-center">
          Available for LEED BD+C v4.1 New Construction.
        </p>
      </div>
    </div>
  );
}
