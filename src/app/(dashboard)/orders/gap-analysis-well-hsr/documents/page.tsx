"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";

const DOCS = [
  {
    name: "Existing cleaning and disinfection protocols",
    description: "Any documented cleaning schedules, product lists, or service contracts — directly scores SC features",
  },
  {
    name: "Emergency response plan or business continuity plan",
    description: "Current emergency procedures, floor warden structure, and evacuation plans — scores SE features",
  },
  {
    name: "HVAC maintenance records or service schedule",
    description: "Filter change logs, inspection reports, and ventilation testing — scores SA features",
  },
  {
    name: "Water management plan or most recent water quality test",
    description: "Legionella risk assessment, cooling tower treatment records, or potable water test results — scores SS features",
  },
  {
    name: "Current health and safety policies",
    description: "Smoking policy, indoor air quality policy, wellness program descriptions — scores multiple concepts",
  },
  {
    name: "Occupant communications or wellness program materials",
    description: "Newsletters, health notices, survey results, or wellness initiatives — scores SI features",
  },
  {
    name: "AED inspection records or first aid kit inventory",
    description: "Confirms presence and maintenance of health service resources — scores SH features",
  },
];

export default function WellHsrGapAnalysisDocumentsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link href="/orders/gap-analysis-well-hsr/questionnaire" className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors">
          ← Questionnaire
        </Link>

        <span className="inline-block text-xs font-bold uppercase tracking-widest text-certify-blue mb-3">WELL HSR Gap Analysis</span>
        <h1 className="font-serif text-3xl text-certify-deep mb-2">Documents you upload</h1>
        <p className="text-certify-cool-grey mb-8 leading-relaxed">
          <strong className="text-certify-deep">All optional.</strong> Upload existing policies and records where you have them. The questionnaire alone is enough to begin — you&apos;ll provide documents after payment.
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
          onClick={() => router.push("/orders/new/payment?type=gap-analysis&program=well_hsr&price=49900")}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md group"
        >
          Continue to payment <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
