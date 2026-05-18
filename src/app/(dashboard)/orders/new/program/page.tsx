import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";

export const metadata: Metadata = { title: "Choose Program" };

const STEPS = ["Program", "Credit", "Details", "Documents", "Payment"];

const PROGRAMS = [
  {
    id: "leed_bdc_v41",
    label: "LEED BD+C v4.1",
    full:  "Building Design + Construction",
    body:  "The world's most widely used green building rating system. Covers 7 categories from Location & Transportation to Indoor Environmental Quality.",
    color: "#388fa6",
    bg:    "#388fa610",
    border:"#388fa630",
    credits: "70+ credits",
    levels: ["Certified", "Silver", "Gold", "Platinum"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    id: "well_v2",
    label: "WELL v2",
    full:  "Building Standard",
    body:  "Performance-based certification focused on occupant health and wellbeing. 10 concepts ranging from Air and Water to Mind and Community.",
    color: "#a3bfa1",
    bg:    "#a3bfa110",
    border:"#a3bfa130",
    credits: "100+ features",
    levels: ["Bronze", "Silver", "Gold", "Platinum"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    ),
  },
  {
    id: "well_hsr",
    label: "WELL Health-Safety",
    full:  "Operational Rating",
    body:  "A streamlined rating for facilities demonstrating health and safety protocols for occupants. 22 required features across 6 categories.",
    color: "#edc299",
    bg:    "#edc29910",
    border:"#edc29930",
    credits: "22 features",
    levels: ["Annual Seal"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
      </svg>
    ),
  },
];

export default function ChooseProgramPage() {
  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Step progress */}
        <div className="mb-10">
          <StepProgress steps={STEPS} current={0} />
        </div>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Choose a certification program</h1>
        <p className="text-certify-cool-grey mb-8 leading-relaxed">
          Select the program you&apos;re documenting. You can order credits from multiple programs across the same project.
        </p>

        <div className="grid grid-cols-1 gap-4">
          {PROGRAMS.map((prog) => (
            <Link
              key={prog.id}
              href={`/orders/new/credit?program=${prog.id}`}
              className="group flex items-start gap-5 bg-white border rounded-2xl p-6 transition-all duration-200 hover:shadow-glass hover:-translate-y-0.5"
              style={{ borderColor: prog.border, backgroundColor: prog.bg }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${prog.color}25`, color: prog.color }}>
                {prog.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl text-certify-deep group-hover:text-certify-teal transition-colors">{prog.label}</h3>
                    <p className="text-xs text-certify-cool-grey font-medium mt-0.5 uppercase tracking-wide">{prog.full}</p>
                  </div>
                  <span className="text-xs font-medium text-certify-cool-grey shrink-0 mt-1">{prog.credits}</span>
                </div>
                <p className="text-sm text-certify-dark-grey mt-2 leading-relaxed">{prog.body}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {prog.levels.map((l) => (
                    <span key={l} className="text-[10px] font-semibold px-2 py-0.5 rounded border" style={{ color: prog.color, borderColor: prog.border, backgroundColor: `${prog.color}10` }}>{l}</span>
                  ))}
                </div>
              </div>
              <ArrowRight size={16} className="text-certify-cool-grey/30 group-hover:text-certify-blue group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
