import type { Metadata } from "next";
import Link from "next/link";
import { DownloadCloud, ArrowLeft } from "lucide-react";
import { MOCK_GAP_ANALYSIS } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Gap Analysis Results" };

export default function GapAnalysisOutputPage() {
  const gap = MOCK_GAP_ANALYSIS;
  const gapToTarget = gap.target_score - gap.overall_score;

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link href="/projects/proj_river" className="inline-flex items-center gap-1.5 text-xs text-certify-cool-grey hover:text-certify-blue mb-6 transition-colors">
          <ArrowLeft size={13} /> Back to project
        </Link>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Gap Analysis Report</h1>
        <p className="text-certify-cool-grey text-sm mb-8">Riverside Tower · LEED BD+C v4.1 · Delivered {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        {/* Main results card */}
        <div
          className="relative overflow-hidden rounded-2xl p-7 mb-6"
          style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)" }}
        >
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
          />
          <div className="relative">
            {/* Score row */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-certify-light/50 mb-1">Current estimate</p>
                <p className="font-serif text-6xl text-white leading-none">{gap.overall_score}</p>
                <p className="text-white/50 text-sm mt-1">/ 110 estimated points · LEED BD+C v4.1</p>
              </div>
              <div className="text-right">
                <div className="bg-certify-sand/20 border border-certify-sand/30 rounded-xl px-4 py-3">
                  <p className="text-certify-sand font-bold text-lg">{gap.target_score} pts</p>
                  <p className="text-certify-sand/60 text-xs">Gold target</p>
                </div>
                <p className="text-certify-sage text-xs font-semibold mt-2">
                  {gapToTarget > 0 ? `${gapToTarget} pts to reach Gold` : "Target met"}
                </p>
              </div>
            </div>

            {/* Category bars */}
            <div className="space-y-3">
              {gap.categories.map((cat) => {
                const pct = Math.round((cat.score / cat.max) * 100);
                const isRec = cat.recommended.length > 0;
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-medium ${isRec ? "text-certify-sage" : "text-white/70"}`}>
                        {cat.name}
                        {isRec && <span className="ml-2 opacity-70 text-certify-sage">↑ opportunity</span>}
                      </span>
                      <span className="text-white/45">{cat.score} / {cat.max} pts</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: isRec ? "#5fa8bb" : "#388fa6" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category summary list */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-serif text-xl text-certify-deep mb-4">Recommended credit priorities</h3>
          <div className="space-y-3">
            {gap.categories.filter((c) => c.recommended.length > 0).map((cat) => (
              <div key={cat.name} className="flex items-start gap-3 pb-3 border-b border-certify-white last:border-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-certify-sage shrink-0 mt-1.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-certify-deep">{cat.name}</p>
                  <p className="text-xs text-certify-cool-grey mt-0.5">
                    Currently {cat.score}/{cat.max} pts · Recommended: {cat.recommended.join(", ")}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {cat.recommended.map((code) => (
                    <Link
                      key={code}
                      href={`/orders/new/credit?program=leed_bdc_v41&filter=${cat.name}`}
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
          href="/projects/proj_river"
          className="block text-center text-sm text-certify-blue hover:text-certify-teal transition-colors font-medium"
        >
          ← Back to project dashboard
        </Link>
      </div>
    </div>
  );
}
