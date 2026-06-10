import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documents Needed" };

const STEPS = ["Program", "Credit", "Details", "Documents", "Payment"];

export default async function DocumentsNeededPage({
  searchParams,
}: {
  searchParams: Promise<{ credit_id?: string; project_id?: string }>;
}) {
  const { credit_id, project_id } = await searchParams;

  if (!credit_id) notFound();

  const supabase = await createClient();
  const { data: credit } = await supabase
    .from("credits")
    .select("id, credit_code, credit_name, required_customer_documents")
    .eq("id", credit_id)
    .single();

  if (!credit) notFound();

  const continueHref = `/orders/new/payment?credit_id=${credit.id}${project_id ? `&project_id=${project_id}` : ""}`;

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={STEPS} current={3} />
        </div>

        <Link
          href={`/orders/new/credit/${credit.id}`}
          className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors"
        >
          ← Credit Details
        </Link>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Documents you&apos;ll need to provide us</h1>
        <p className="text-certify-cool-grey mb-8 leading-relaxed">
          You&apos;ll provide these after payment. Have them ready to go to speed up the process.
        </p>

        {/* Required documents */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-certify-blue/10 flex items-center justify-center">
              <FileText size={14} className="text-certify-blue" />
            </div>
            <h3 className="font-semibold text-certify-deep text-sm">Required documents: {credit.credit_code}</h3>
          </div>
          <ul className="space-y-3">
            {(credit.required_customer_documents ?? []).map((doc, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-certify-blue/10 flex items-center justify-center text-certify-blue text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-certify-dark-grey leading-relaxed flex-1">{doc}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Optional / additional note */}
        <div className="bg-certify-beige border border-certify-sand/30 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs font-semibold text-certify-dark-grey mb-1">Optional</p>
          <p className="text-xs text-certify-cool-grey leading-relaxed mb-2">
            If you have additional supporting materials (photos, supplementary calculations, prior correspondence with the reviewer), you can include them, but they are not required for processing.
          </p>
          <p className="text-xs text-certify-cool-grey leading-relaxed">
            Choose a compliance path, if applicable. If no compliance path is chosen, we will determine the best path for you.
          </p>
        </div>

        {/* Sage confirmation */}
        <div className="flex items-start gap-2.5 bg-certify-sage/12 border border-certify-sage/30 rounded-xl px-4 py-3 mb-8">
          <CheckCircle2 size={14} className="text-certify-teal shrink-0 mt-0.5" />
          <p className="text-xs text-certify-teal leading-relaxed">
            Your files are uploaded to a private, isolated workspace. They are used only to generate documentation for this specific credit and are permanently deleted after your output is delivered.
          </p>
        </div>

        <Link
          href={continueHref}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md group"
        >
          Continue to payment <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
