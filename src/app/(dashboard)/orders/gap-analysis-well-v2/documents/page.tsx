"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";

const DOCS = [
  {
    name: "Floor plans or space plans",
    description: "Occupant count by zone, window-to-wall ratio, and space layout — improves Air, Light, Movement, and Thermal estimates",
  },
  {
    name: "Mechanical system schedule or basis of design",
    description: "HVAC type, ventilation rates, filtration specification, and humidity controls — directly scores Air and Thermal Comfort features",
  },
  {
    name: "Reflected ceiling plan or lighting schedule",
    description: "Fixture types, control zones, and daylighting approach — improves Light concept accuracy",
  },
  {
    name: "Outline specification or spec table of contents",
    description: "Confirms intent on materials, cleaning products, low-VOC approach, and IPM policy",
  },
  {
    name: "Food service or amenity program",
    description: "Cafeteria, pantry, or food service scope — used to score Nourishment features",
  },
  {
    name: "Acoustic report or design criteria",
    description: "Background noise targets and reverberation goals — directly scores Sound features",
  },
  {
    name: "Site plan or landscape plan",
    description: "Outdoor recreation spaces, active design features, and bicycle storage — improves Movement estimates",
  },
  {
    name: "Any existing wellness or operational policies",
    description: "Smoking policy, cleaning protocols, IPM plan, or mental health programs already in place",
  },
];

function DocumentsContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const projectId   = searchParams.get("project_id");

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link href="/orders/gap-analysis-well-v2/questionnaire" className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors">
          ← Questionnaire
        </Link>

        <span className="inline-block text-xs font-bold uppercase tracking-widest text-certify-blue mb-3">WELL v2 Gap Analysis</span>
        <h1 className="font-serif text-3xl text-certify-deep mb-2">Documents you upload</h1>
        <p className="text-certify-cool-grey mb-8 leading-relaxed">
          <strong className="text-certify-deep">All optional.</strong> Upload what exists. If you have nothing yet, the questionnaire alone is enough to get started. You&apos;ll provide these after payment.
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
          onClick={() => router.push(`/orders/new/payment?type=gap-analysis&program=well_v2&price=49900${projectId ? `&project_id=${projectId}` : ""}`)}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md group"
        >
          Continue to payment <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

export default function WellV2GapAnalysisDocumentsPage() {
  return <Suspense><DocumentsContent /></Suspense>;
}
