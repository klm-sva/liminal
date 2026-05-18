import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";
import ProgramChip from "@/components/dashboard/ProgramChip";
import { MOCK_CREDITS } from "@/lib/mock-data";
import type { ProgramType } from "@/types/database";

const GAP_ANALYSIS_CONFIG: Record<ProgramType, { href: string; description: string }> = {
  leed_bdc_v41: {
    href: "/orders/gap-analysis",
    description: "Scored inventory of every applicable LEED credit, gap to your certification target, and a prioritized credit shortlist by effort and impact.",
  },
  well_v2: {
    href: "/orders/gap-analysis-well-v2",
    description: "Concept-by-concept score estimate across all 10 WELL v2 concepts, gap to your certification level, and a prioritized feature shortlist.",
  },
  well_hsr: {
    href: "/orders/gap-analysis-well-hsr",
    description: "Category-by-category score across all 6 WELL HSR concepts, gap to the rating threshold, and a prioritized action plan.",
  },
};

export const metadata: Metadata = { title: "Choose Credit" };

const STEPS = ["Program", "Credit", "Details", "Documents", "Payment"];

const CATEGORIES: Record<ProgramType, string[]> = {
  leed_bdc_v41: ["All Categories", "Location & Transportation", "Sustainable Sites", "Water Efficiency", "Energy & Atmosphere", "Materials & Resources", "Indoor Environmental Quality"],
  well_v2:      ["All Concepts", "Air", "Water", "Nourishment", "Light", "Movement", "Thermal Comfort", "Sound", "Materials", "Mind", "Community"],
  well_hsr:     ["All Categories", "Cleaning & Sanitization", "Emergency Preparedness", "Health Service Resources", "Air & Water Quality", "Stakeholder Engagement"],
};

export default async function ChooseCreditPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; filter?: string; project_id?: string }>;
}) {
  const { program: programParam, filter, project_id } = await searchParams;
  const program   = (programParam ?? "leed_bdc_v41") as ProgramType;
  const categories = CATEGORIES[program] ?? CATEGORIES.leed_bdc_v41;

  const credits = MOCK_CREDITS.filter(
    (c) => c.program === program && (filter && filter !== categories[0] ? c.category === filter : true)
  );

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={STEPS} current={1} />
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl text-certify-deep">Choose a credit</h1>
            <p className="text-certify-cool-grey text-sm mt-1">
              <ProgramChip program={program} />
            </p>
          </div>
          <Link href="/orders/new/program" className="text-xs text-certify-cool-grey hover:text-certify-blue transition-colors">← Change program</Link>
        </div>

        {/* Gap analysis card */}
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-certify-cool-grey/50 mb-2" style={{ letterSpacing: "0.14em" }}>
            Recommended first step
          </p>
          <Link
            href={`${GAP_ANALYSIS_CONFIG[program].href}${project_id ? `?project_id=${project_id}` : ""}`}
            className="group flex items-center gap-4 bg-white border border-certify-blue/20 rounded-2xl px-5 hover:border-certify-blue/40 hover:shadow-glass transition-all duration-200"
            style={{ minHeight: "128px" }}
          >
            <div className="flex-1 min-w-0 py-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded"
                  style={{ background: "#388fa6", letterSpacing: "0.1em" }}
                >
                  Gap Analysis
                </span>
              </div>
              <p className="font-semibold text-certify-deep text-sm group-hover:text-certify-teal transition-colors mb-1.5">
                Start with a gap analysis
              </p>
              <p className="text-xs text-certify-cool-grey leading-relaxed" style={{ maxWidth: "440px" }}>
                {GAP_ANALYSIS_CONFIG[program].description}
              </p>
            </div>
            <div className="shrink-0 text-right pl-4 py-5">
              <p className="font-serif text-lg text-certify-deep">$499</p>
              <p className="text-[10px] text-certify-cool-grey mt-0.5">pilot price</p>
              <ArrowRight size={14} className="text-certify-cool-grey/30 group-hover:text-certify-blue transition-colors ml-auto mt-2 group-hover:translate-x-1" />
            </div>
          </Link>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-6">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/orders/new/credit?program=${program}&filter=${encodeURIComponent(cat)}${project_id ? `&project_id=${project_id}` : ""}`}
              className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                (filter ?? categories[0]) === cat
                  ? "bg-certify-blue text-white border-certify-blue"
                  : "bg-white text-certify-cool-grey border-certify-white hover:border-certify-blue/30"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* Credit list */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-certify-cool-grey/50 mb-3" style={{ letterSpacing: "0.14em" }}>
          Or choose an individual credit
        </p>
        <div className="space-y-3 mb-8">
          {credits.map((credit) => (
            <Link
              key={credit.id}
              href={`/orders/new/credit/${credit.id}?program=${program}${project_id ? `&project_id=${project_id}` : ""}`}
              className="group flex items-center gap-4 bg-white border border-certify-white rounded-2xl px-5 py-4 hover:border-certify-blue/30 hover:shadow-glass transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold text-certify-cool-grey">{credit.credit_code}</span>
                  <span className="font-semibold text-certify-deep text-sm group-hover:text-certify-teal transition-colors">{credit.credit_name}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-certify-cool-grey">{credit.category}</span>
                  {credit.points_available !== null && (
                    <span className="text-xs text-certify-cool-grey">· {credit.points_available} pts</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-serif text-lg text-certify-deep">${(credit.price / 100).toFixed(0)}</p>
                <ArrowRight size={14} className="text-certify-cool-grey/30 group-hover:text-certify-blue transition-colors ml-auto mt-1 group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
