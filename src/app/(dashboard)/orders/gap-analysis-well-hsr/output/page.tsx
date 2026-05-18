import type { Metadata } from "next";
import Link from "next/link";
import { DownloadCloud, ArrowLeft } from "lucide-react";
import { MOCK_GAP_ANALYSIS_WELL_HSR } from "@/lib/mock-data";

export const metadata: Metadata = { title: "WELL HSR Gap Analysis Results" };

export default function WellHsrGapAnalysisOutputPage() {
  const gap = MOCK_GAP_ANALYSIS_WELL_HSR;
  const gapToTarget = gap.target_score - gap.overall_score;
  const pctOfMax = Math.round((gap.overall_score / gap.max_possible) * 100);
  const awarded = gap.overall_score >= gap.target_score;

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link href="/projects/proj_mesa" className="inline-flex items-center gap-1.5 text-xs text-certify-cool-grey hover:text-certify-blue mb-6 transition-colors">
          <ArrowLeft size={13} /> Back to project
        </Link>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">WELL HSR Gap Analysis Report</h1>
        <p className="text-certify-cool-grey text-sm mb-8">
          Mesa Verde Corporate Campus · WELL Health-Safety Rating · Delivered {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        {/* Main results card */}
        <div
          className="relative overflow-hidden rounded-2xl p-7 mb-6"
          style={{ background: "linear-gradient(135deg, #c4a882 0%, #a8895e 100%)" }}
        >
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
          />
          <div className="relative">
            {/* Score row */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">Current estimate</p>
                <p className="font-serif text-6xl text-white leading-none">{gap.overall_score}</p>
                <p className="text-white/50 text-sm mt-1">/ {gap.max_possible} possible points · {pctOfMax}% · WELL HSR</p>
              </div>
              <div className="text-right">
                <div className="bg-white/15 border border-white/20 rounded-xl px-4 py-3">
                  <p className="text-white font-bold text-lg">{gap.target_score} pts</p>
                  <p className="text-white/50 text-xs">rating threshold</p>
                </div>
                <p className="text-white/70 text-xs font-semibold mt-2">
                  {awarded ? "Rating threshold met" : `${gapToTarget} pts to earn the rating`}
                </p>
              </div>
            </div>

            {/* Concept bars */}
            <div className="space-y-3">
              {gap.concepts.map((concept) => {
                const pct = Math.round((concept.score / concept.max) * 100);
                const isRec = concept.recommended.length > 0;
                return (
                  <div key={concept.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-medium ${isRec ? "text-certify-sage" : "text-white/70"}`}>
                        {concept.name}
                        {isRec && <span className="ml-2 opacity-70 text-certify-sage">↑ opportunity</span>}
                      </span>
                      <span className="text-white/45">{concept.score} / {concept.max} pts</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: isRec ? "#a3bfa1" : "rgba(255,255,255,0.55)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category priority list */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-serif text-xl text-certify-deep mb-4">Recommended feature priorities</h3>
          <div className="space-y-3">
            {gap.concepts.filter((c) => c.recommended.length > 0).map((concept) => (
              <div key={concept.name} className="flex items-start gap-3 pb-3 border-b border-certify-white last:border-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-certify-sage shrink-0 mt-1.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-certify-deep">{concept.name}</p>
                  <p className="text-xs text-certify-cool-grey mt-0.5">
                    Currently {concept.score}/{concept.max} pts · Recommended: {concept.recommended.join(", ")}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap justify-end" style={{ maxWidth: "140px" }}>
                  {concept.recommended.map((code) => (
                    <Link
                      key={code}
                      href={`/orders/new/credit?program=well_hsr&filter=${concept.name}`}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-certify-sage/15 border border-certify-sage/30 text-certify-teal hover:bg-certify-sage/25 transition-colors"
                    >
                      {code}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What the rating means */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-serif text-lg text-certify-deep mb-3">About the WELL Health-Safety Rating</h3>
          <p className="text-sm text-certify-cool-grey leading-relaxed mb-3">
            The WELL Health-Safety Rating is awarded when a building achieves the required point threshold across all six concepts. Unlike WELL v2, there are no tiered certification levels — the rating is earned or not.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl px-4 py-3 text-center"
              style={{ background: gap.overall_score < gap.target_score ? "rgba(43,64,68,0.03)" : "rgba(163,191,161,0.12)", border: `1px solid ${gap.overall_score < gap.target_score ? "rgba(43,64,68,0.08)" : "rgba(163,191,161,0.40)"}` }}
            >
              <p className="text-sm font-semibold text-certify-deep">Not yet awarded</p>
              <p className="text-xs text-certify-cool-grey mt-0.5">Below {gap.target_score} pts</p>
            </div>
            <div
              className="rounded-xl px-4 py-3 text-center"
              style={{ background: gap.overall_score >= gap.target_score ? "rgba(163,191,161,0.12)" : "rgba(43,64,68,0.03)", border: `1px solid ${gap.overall_score >= gap.target_score ? "rgba(163,191,161,0.40)" : "rgba(43,64,68,0.08)"}` }}
            >
              <p className="text-sm font-semibold text-certify-deep">Rating awarded</p>
              <p className="text-xs text-certify-cool-grey mt-0.5">{gap.target_score}+ pts</p>
            </div>
          </div>
        </div>

        {/* Download row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button className="flex-1 flex items-center justify-center gap-2 bg-certify-deep hover:bg-certify-navy text-white font-semibold py-3 rounded-xl transition-colors shadow-md text-sm">
            <DownloadCloud size={15} /> Download editable output
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 bg-certify-white hover:bg-certify-beige text-certify-deep border border-certify-white font-semibold py-3 rounded-xl transition-colors text-sm">
            <DownloadCloud size={15} /> Download HTML
          </button>
        </div>

        <Link
          href="/projects/proj_mesa"
          className="block text-center text-sm text-certify-blue hover:text-certify-teal transition-colors font-medium"
        >
          ← Back to project dashboard
        </Link>
      </div>
    </div>
  );
}
