import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, FileSpreadsheet, ClipboardList, CheckCircle2, Mail, AlertTriangle } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";
import { createServiceClient } from "@/lib/supabase/server";

export default async function DeliveryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  const supabase = await createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, credits(credit_code, credit_name, has_calculator, has_leed_form)")
    .eq("id", orderId)
    .single();

  if (!order) notFound();

  type OrderWithCredit = { id: string; credits?: { credit_code: string; credit_name: string; has_calculator: boolean; has_leed_form: boolean } | null };
  const credit = (order as unknown as OrderWithCredit)?.credits;
  if (!credit) notFound();

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={["Pay", "Upload", "Processing", "Delivery"]} current={3} />
        </div>

        {/* Email preview label */}
        <div className="inline-flex items-center gap-1.5 bg-certify-sand/20 border border-certify-sand/40 rounded-full px-3 py-1 text-xs font-semibold text-certify-dark-grey mb-6">
          <Mail size={11} />
          Email preview — this is what we sent to your inbox
        </div>

        {/* Email frame */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card overflow-hidden mb-5">

          {/* Email header */}
          <div className="bg-certify-navy px-6 py-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-7 h-7 rounded-lg bg-certify-blue/30 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-certify-sage" />
              </div>
              <span className="text-xs font-bold text-certify-white/60 uppercase tracking-wider">Liminal</span>
            </div>
            <h2 className="font-serif text-xl text-certify-white mt-3 mb-0.5">Your output is ready</h2>
            <p className="text-xs text-certify-white/50">
              From: <span className="text-certify-white/70">orders@liminalsva.com</span>
              &nbsp;·&nbsp;
              Subject: <span className="text-certify-white/70">[{credit.credit_code}] Documentation ready: {credit.credit_name}</span>
            </p>
          </div>

          {/* Email body */}
          <div className="px-6 py-6">
            <p className="text-sm text-certify-dark-grey mb-1">Hi there,</p>
            <p className="text-sm text-certify-dark-grey leading-relaxed mb-5">
              Your documentation for <strong className="text-certify-deep">{credit.credit_code}: {credit.credit_name}</strong> is ready. Download your files below.
            </p>

            {/* File download rows */}
            <div className="space-y-2 mb-4">
              {/* Standard HTML output — always */}
              <div className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-certify-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-certify-deep truncate">{credit.credit_code}_Output.html</p>
                  <p className="text-xs text-certify-cool-grey">Full submission output · HTML</p>
                </div>
                <button className="shrink-0 flex items-center gap-1 text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors">
                  <Download size={13} />
                  Download
                </button>
              </div>

              {/* Editable HTML — always */}
              <div className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-certify-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-certify-deep truncate">{credit.credit_code}_Editable.html</p>
                  <p className="text-xs text-certify-cool-grey">Editable version · click to edit, print to PDF</p>
                </div>
                <button className="shrink-0 flex items-center gap-1 text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors">
                  <Download size={13} />
                  Download
                </button>
              </div>

              {/* Calculator — conditional */}
              {credit.has_calculator && (
                <div className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                  <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                    <FileSpreadsheet size={15} className="text-certify-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-certify-deep truncate">{credit.credit_code}_Calculator.xlsx</p>
                    <p className="text-xs text-certify-cool-grey">Calculator inputs provided · Excel</p>
                  </div>
                  <button className="shrink-0 flex items-center gap-1 text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors">
                    <Download size={13} />
                    Download
                  </button>
                </div>
              )}

              {/* LEED form — conditional */}
              {credit.has_leed_form && (
                <div className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                  <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                    <ClipboardList size={15} className="text-certify-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-certify-deep truncate">{credit.credit_code}_LEED_Form.txt</p>
                    <p className="text-xs text-certify-cool-grey">Pre-filled sample online form</p>
                  </div>
                  <button className="shrink-0 flex items-center gap-1 text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors">
                    <Download size={13} />
                    Download
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-certify-dark-grey leading-relaxed mb-3">
              After downloading, to open the HTML file and edit it, right click &rarr; Open With &rarr; choose Microsoft Word. In Word, under View choose Web Layout for ideal formatting.
            </p>
            <p className="text-xs text-certify-dark-grey leading-relaxed mb-4">
              If any additional items are needed for your certification submittal they will be itemized. This might be items that were not included in the provided information or items that only project teams can provide (meeting minutes, photographs, etc.).
            </p>

            {/* Editing disclaimer */}
            <div className="flex gap-2.5 bg-certify-sand/15 border border-certify-sand/40 rounded-xl px-4 py-3 mb-4">
              <AlertTriangle size={14} className="text-certify-sand shrink-0 mt-0.5" />
              <p className="text-xs text-certify-dark-grey leading-relaxed">
                The editable file lets you update narrative text directly in your browser. Editing calculated values, distances, trip counts, or data tables may affect the accuracy of your compliance determination. Review any changes carefully before submitting.
              </p>
            </div>

            {/* Resubmit note */}
            <div className="bg-certify-beige border border-certify-sand/30 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs font-semibold text-certify-dark-grey mb-1">Resubmit available</p>
              <p className="text-xs text-certify-cool-grey">
                Pilot participants receive a discounted rate for all resubmittals. <a href="#" className="underline hover:text-certify-blue transition-colors">Click here to find out more.</a>
              </p>
            </div>

            <p className="text-xs text-certify-cool-grey leading-relaxed">
              Your uploaded files have been permanently deleted from our servers per our data retention policy. This output is the only artifact we retain.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md"
        >
          Back to dashboard
        </Link>

        <Link
          href="/feedback"
          className="block text-center text-xs text-certify-cool-grey hover:text-certify-blue transition-colors mt-4"
        >
          Share feedback on this output →
        </Link>
      </div>
    </div>
  );
}
