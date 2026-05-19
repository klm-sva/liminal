"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

export default function GapAnalysisOutputClient({
  htmlContent,
  backHref,
  programLabel,
}: {
  htmlContent: string | null;
  backHref: string;
  programLabel: string;
}) {
  function handleDownload() {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gap-analysis-report.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-certify-white shrink-0">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-certify-cool-grey hover:text-certify-blue transition-colors"
        >
          <ArrowLeft size={13} /> Back to dashboard
        </Link>
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

      {/* Content area */}
      {htmlContent ? (
        <iframe
          srcDoc={htmlContent}
          className="flex-1 w-full border-0"
          title={`${programLabel} Gap Analysis Report`}
          sandbox="allow-same-origin"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-certify-white">
          <div className="text-center max-w-sm px-6">
            <div className="w-14 h-14 rounded-2xl bg-certify-blue/10 border border-certify-blue/20 flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-certify-blue">
                <path d="M9 12h6M9 16h4M5 8h14M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="font-serif text-xl text-certify-deep mb-2">No report available yet</h2>
            <p className="text-sm text-certify-cool-grey leading-relaxed">
              Your gap analysis report will appear here once the analysis is complete.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
