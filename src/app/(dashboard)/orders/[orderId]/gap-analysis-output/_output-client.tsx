"use client";

import { useState }   from "react";
import Link           from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import type { GapAnalysisData } from "./page";

type Props = {
  orderId:      string;
  programLabel: string;
  program:      string;
  results:      GapAnalysisData | null;
  htmlContent:  string | null;
};

export default function GapAnalysisOutputClient({
  orderId,
  programLabel,
  program,
  results,
  htmlContent,
}: Props) {
  const [view, setView] = useState<"dashboard" | "report">("dashboard");

  const creditOrderUrl = program === "well_v2"  ? "/orders/gap-analysis-well-v2"
                       : program === "well_hsr" ? "/orders/gap-analysis-well-hsr"
                       : "/orders/gap-analysis";

  function handleDownload() {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "gap-analysis-report.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Report iframe view ──────────────────────────────────────────────────────
  if (view === "report") {
    return (
      <div className="flex flex-col" style={{ height: "100vh" }}>
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-certify-white shrink-0">
          <button
            onClick={() => setView("dashboard")}
            className="inline-flex items-center gap-1.5 text-xs text-certify-cool-grey hover:text-certify-blue transition-colors"
          >
            <ArrowLeft size={13} /> Back to results
          </button>
          <span className="text-xs font-semibold text-certify-deep">{programLabel} Gap Analysis Report</span>
          {htmlContent ? (
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors"
            >
              <Download size={13} /> Download HTML
            </button>
          ) : (
            <span />
          )}
        </div>
        {htmlContent ? (
          <iframe
            srcDoc={htmlContent}
            className="flex-1 w-full border-0"
            title={`${programLabel} Gap Analysis Report`}
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-certify-white">
            <p className="text-certify-cool-grey text-sm">Report not available.</p>
          </div>
        )}
      </div>
    );
  }

  // ── Dashboard view ──────────────────────────────────────────────────────────
  const sections = results?.categories ?? results?.concepts ?? [];
  const gapToTarget = results ? results.target_score - results.overall_score : 0;
  const maxPossible = results?.max_possible ?? (program === "leed_bd_c" ? 110 : 110);

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-certify-cool-grey hover:text-certify-blue mb-6 transition-colors"
        >
          <ArrowLeft size={13} /> Back to dashboard
        </Link>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Gap Analysis Report</h1>
        <p className="text-certify-cool-grey text-sm mb-8">
          {programLabel} · Order #{orderId.slice(-6).toUpperCase()}
        </p>

        {results ? (
          <>
            {/* Main score card */}
            <div
              className="relative overflow-hidden rounded-2xl p-7 mb-6"
              style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)" }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              <div className="relative">
                {/* Score row */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-certify-light/50 mb-1">
                      Current estimate
                    </p>
                    <p className="font-serif text-6xl text-white leading-none">{results.overall_score}</p>
                    <p className="text-white/50 text-sm mt-1">
                      / {maxPossible} estimated points · {programLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="bg-certify-sand/20 border border-certify-sand/30 rounded-xl px-4 py-3">
                      <p className="text-certify-sand font-bold text-lg">{results.target_score} pts</p>
                      <p className="text-certify-sand/60 text-xs">
                        {results.certification_level ? `${results.certification_level} target` : "target"}
                      </p>
                    </div>
                    <p className="text-certify-sage text-xs font-semibold mt-2">
                      {gapToTarget > 0
                        ? `${gapToTarget} pts to reach ${results.certification_level ?? "target"}`
                        : "Target met"}
                    </p>
                  </div>
                </div>

                {/* Category/concept bars */}
                {sections.length > 0 && (
                  <div className="space-y-3">
                    {sections.map((sec) => {
                      const pct   = Math.round((sec.score / sec.max) * 100);
                      const isRec = sec.recommended.length > 0;
                      return (
                        <div key={sec.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={`font-medium ${isRec ? "text-certify-sage" : "text-white/70"}`}>
                              {sec.name}
                              {isRec && (
                                <span className="ml-2 opacity-70 text-certify-sage">↑ opportunity</span>
                              )}
                            </span>
                            <span className="text-white/45">
                              {sec.score} / {sec.max} pts
                            </span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width:           `${pct}%`,
                                backgroundColor: isRec ? "#5fa8bb" : "#388fa6",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Recommended priorities */}
            {sections.some((s) => s.recommended.length > 0) && (
              <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-6">
                <h3 className="font-serif text-xl text-certify-deep mb-4">Recommended credit priorities</h3>
                <div className="space-y-3">
                  {sections
                    .filter((s) => s.recommended.length > 0)
                    .map((sec) => (
                      <div
                        key={sec.name}
                        className="flex items-start gap-3 pb-3 border-b border-certify-white last:border-0 last:pb-0"
                      >
                        <div className="w-2 h-2 rounded-full bg-certify-sage shrink-0 mt-1.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-certify-deep">{sec.name}</p>
                          <p className="text-xs text-certify-cool-grey mt-0.5">
                            Currently {sec.score}/{sec.max} pts · Recommended: {sec.recommended.join(", ")}
                          </p>
                        </div>
                        <div
                          className="flex gap-1.5 shrink-0 flex-wrap justify-end"
                          style={{ maxWidth: "160px" }}
                        >
                          {sec.recommended.map((code) => (
                            <Link
                              key={code}
                              href={`/orders/new/credit?program=${
                                program === "leed_bd_c" ? "leed_bdc_v41" : program
                              }&filter=${encodeURIComponent(sec.name)}`}
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
            )}
          </>
        ) : (
          <div className="bg-white border border-certify-white rounded-2xl shadow-card p-8 mb-6 text-center">
            <p className="text-certify-cool-grey text-sm">Score data unavailable. View the full report below.</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={() => setView("report")}
            className="flex-1 flex items-center justify-center gap-2 bg-certify-deep hover:bg-certify-navy text-white font-semibold py-3 rounded-xl transition-colors shadow-md text-sm"
          >
            <FileText size={15} /> View full report
          </button>
          <button
            onClick={handleDownload}
            disabled={!htmlContent}
            className="flex-1 flex items-center justify-center gap-2 bg-certify-white hover:bg-certify-beige text-certify-deep border border-certify-white font-semibold py-3 rounded-xl transition-colors text-sm disabled:opacity-40"
          >
            <Download size={15} /> Download HTML
          </button>
        </div>

        <div className="flex justify-between items-center">
          <Link
            href="/dashboard"
            className="text-sm text-certify-blue hover:text-certify-teal transition-colors font-medium"
          >
            ← Back to dashboard
          </Link>
          <Link
            href={creditOrderUrl}
            className="text-sm text-certify-cool-grey hover:text-certify-blue transition-colors"
          >
            Order credits based on this report →
          </Link>
        </div>
      </div>
    </div>
  );
}
