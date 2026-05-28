"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";

const DOCS = [
  {
    name: "Site plan or survey",
    description: "Site area, footprint, parking count, open space — sharpens LT and SS estimates",
  },
  {
    name: "Floor plans",
    description: "GFA, glazing presence, occupancy layout — improves WE, EQ, daylight estimates",
  },
  {
    name: "Building program or space plan",
    description: "If no floor plans yet — area and occupancy by use type",
  },
  {
    name: "Landscape plan",
    description: "Irrigation intent, planting approach, open space areas",
  },
  {
    name: "Any equipment schedule",
    description: "Mechanical, plumbing, or electrical — refrigerant types, fixture flow rates, PV system size",
  },
  {
    name: "Energy model report",
    description: "Replaces all energy estimates with a confirmed EA Credit 2 point count",
  },
  {
    name: "Outline spec or spec table of contents",
    description: "Confirms intent on ESC, materials, commissioning, waste, low-emitting products",
  },
];

function DocumentsContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const projectId   = searchParams.get("project_id");

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link href="/orders/gap-analysis/questionnaire" className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors">
          ← Questionnaire
        </Link>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Documents you upload</h1>
        <p className="text-certify-cool-grey mb-8 leading-relaxed">
          <strong className="text-certify-deep">All optional.</strong> Upload what exists. If you have nothing yet, the questionnaire is enough to get started. You&apos;ll provide these after payment.
        </p>

        <div className="bg-white border border-certify-white rounded-2xl shadow-card overflow-hidden mb-6">
          {DOCS.map((doc, i) => (
            <div key={doc.name}
              className={`px-6 py-4 flex items-start gap-4 ${i < DOCS.length - 1 ? "border-b border-certify-white" : ""}`}>
              <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                <FileText size={13} className="text-certify-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-certify-deep">{doc.name}</p>
                <p className="text-xs text-certify-cool-grey mt-0.5 leading-relaxed">{doc.description}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push(`/orders/new/payment?type=gap-analysis&program=leed_bd_c&price=49900${projectId ? `&project_id=${projectId}` : ""}`)}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md group"
        >
          Continue to payment <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

export default function GapAnalysisDocumentsPage() {
  return <Suspense><DocumentsContent /></Suspense>;
}
