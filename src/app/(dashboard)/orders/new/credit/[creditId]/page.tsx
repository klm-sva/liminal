import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ArrowRight, Info } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";
import ProgramChip from "@/components/dashboard/ProgramChip";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Credit Details" };

const STEPS = ["Program", "Credit", "Details", "Documents", "Payment"];

export default async function CreditDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ creditId: string }>;
  searchParams: Promise<{ program?: string; project_id?: string }>;
}) {
  const { creditId }  = await params;
  const { project_id } = await searchParams;

  const supabase = await createServiceClient();
  const { data: credit } = await supabase
    .from("credits")
    .select("*")
    .eq("id", creditId)
    .single();

  if (!credit) notFound();

  const continueHref = `/orders/new/documents?credit_id=${credit.id}${project_id ? `&project_id=${project_id}` : ""}`;

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={STEPS} current={2} />
        </div>

        <Link
          href={`/orders/new/credit?program=${credit.program}`}
          className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors"
        >
          ← Credits
        </Link>

        {/* Eyebrow + headline */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-bold text-certify-cool-grey uppercase tracking-wider">{credit.credit_code}</span>
            <span className="text-xs text-certify-cool-grey">·</span>
            <span className="text-xs text-certify-cool-grey">{credit.category}</span>
            <ProgramChip program={credit.program} />
          </div>
          <h1 className="font-serif text-4xl text-certify-deep leading-tight mb-3">{credit.credit_name}</h1>

          {/* Points + automation badge */}
          <div className="flex items-center gap-3 flex-wrap">
            {credit.points_available !== null && credit.points_available > 0 && (
              <div className="bg-certify-beige border border-certify-sand/30 rounded-xl px-3 py-1.5">
                <span className="text-certify-deep font-bold text-sm">{credit.points_available}</span>
                <span className="text-certify-cool-grey text-xs ml-1">points available</span>
              </div>
            )}
            {credit.points_available === 0 && (
              <div className="bg-certify-beige border border-certify-sand/30 rounded-xl px-3 py-1.5">
                <span className="text-certify-dark-grey text-xs font-medium">Prerequisite (no points, required)</span>
              </div>
            )}
          </div>
        </div>

        {/* What this order produces — sage box */}
        <div className="bg-certify-sage/12 border border-certify-sage/30 rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-bold text-certify-teal uppercase tracking-wider mb-2">What this order produces</p>
          <p className="text-sm text-certify-teal leading-relaxed">{credit.deliverable_description}</p>
        </div>

        {/* Disclaimer — grey box */}
        <div className="flex items-start gap-2.5 bg-certify-white border border-certify-cool-grey/20 rounded-xl px-4 py-3 mb-4">
          <Info size={14} className="text-certify-cool-grey shrink-0 mt-0.5" />
          <p className="text-xs text-certify-cool-grey leading-relaxed">
            Liminal produces output based exclusively on the files and information you provide. The quality of the output depends entirely on the quality of the information you provide. We will provide feedback on any outstanding issues and allow you to upload additional information before processing.
          </p>
        </div>

        {/* Included */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-5 mb-4">
          <p className="text-xs font-bold text-certify-deep/70 uppercase tracking-wider mb-3">Included</p>
          <ul className="space-y-2">
            {[
              "Compliance narrative (editable output)",
              ...(credit.has_form  ? ["Pre-filled sample online form"] : []),
              ...(credit.has_calculator ? ["Calculator inputs provided (.xlsx)"] : []),
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-certify-dark-grey">
                <CheckCircle2 size={14} className="text-certify-teal shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between bg-certify-beige border border-certify-sand/40 rounded-xl px-5 py-4 mb-4">
          <div>
            <p className="font-serif text-2xl text-certify-deep">${(credit.price / 100).toFixed(0)}</p>
            <p className="text-xs text-certify-cool-grey">per credit order · pilot price</p>
          </div>
          <Link
            href={continueHref}
            className="inline-flex items-center gap-1.5 bg-certify-blue hover:bg-certify-teal text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md text-sm group"
          >
            Continue <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <p className="text-xs text-certify-cool-grey text-center">Required documents listed on the next screen</p>
      </div>
    </div>
  );
}
