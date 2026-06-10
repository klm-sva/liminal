import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, FileText, FileSpreadsheet, ClipboardList, CheckCircle2, Mail, AlertTriangle } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";
import { createClient } from "@/lib/supabase/server";

export default async function DeliveryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ownedOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (!ownedOrder) redirect("/dashboard");
  const [orderRes, runRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, delivered_at, credits(credit_code, credit_name, program, has_calculator, has_form)")
      .eq("id", orderId)
      .single(),
    supabase
      .from("runs")
      .select("output_html_path")
      .eq("order_id", orderId)
      .eq("status", "completed")
      .order("run_number", { ascending: false })
      .limit(1)
      .single(),
  ]);

  if (!orderRes.data) notFound();
  const order = orderRes.data;

  type OrderWithCredit = { id: string; delivered_at: string | null; credits?: { credit_code: string; credit_name: string; program: string; has_calculator: boolean; has_form: boolean } | null };
  const typedOrder = order as unknown as OrderWithCredit;
  const credit = typedOrder?.credits;
  if (!credit) notFound();

  if (!typedOrder.delivered_at) redirect(`/orders/${orderId}`);

  const htmlPath     = runRes.data?.output_html_path ?? null;
  const editablePath = htmlPath ? htmlPath.replace("submission.html", "submission-editable.html") : null;

  // List all files in the outputs folder to find policy drafts
  const outputsFolder = htmlPath ? htmlPath.slice(0, htmlPath.lastIndexOf("/")) : null;
  const KNOWN_FILES   = new Set(["submission.html", "submission-editable.html", "walking-distance-map.png"]);
  const policyFiles: { name: string; path: string }[] = [];
  if (outputsFolder) {
    const { data: storageFiles } = await supabase.storage
      .from("order-outputs")
      .list(outputsFolder);
    for (const f of storageFiles ?? []) {
      if (!KNOWN_FILES.has(f.name) && f.name.endsWith(".html")) {
        policyFiles.push({ name: f.name, path: `${outputsFolder}/${f.name}` });
      }
    }
  }

  function downloadHref(storagePath: string) {
    return `/orders/${orderId}/download?path=${encodeURIComponent(storagePath)}`;
  }

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
              <span className="text-xs font-bold text-certify-white/60 uppercase tracking-wider">LIMINALsva</span>
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
              {!htmlPath ? (
                <p className="text-xs text-certify-cool-grey py-2">
                  Your output files will be emailed to you when ready.
                </p>
              ) : (
                <>
                  {/* Standard HTML output */}
                  <div className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                    <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                      <FileText size={15} className="text-certify-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-certify-deep truncate">{credit.credit_code}_Output.html</p>
                      <p className="text-xs text-certify-cool-grey">Full submission output · HTML</p>
                    </div>
                    <a
                      href={downloadHref(htmlPath)}
                      download
                      className="shrink-0 flex items-center gap-1 text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors"
                    >
                      <Download size={13} />
                      Download
                    </a>
                  </div>

                  {/* Editable HTML */}
                  {editablePath && (
                    <div className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                      <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                        <FileText size={15} className="text-certify-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-certify-deep truncate">{credit.credit_code}_Editable.html</p>
                        <p className="text-xs text-certify-cool-grey">Editable version · click to edit, print to PDF</p>
                      </div>
                      <a
                        href={downloadHref(editablePath)}
                        download
                        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors"
                      >
                        <Download size={13} />
                        Download
                      </a>
                    </div>
                  )}

                  {/* Policy drafts */}
                  {policyFiles.map((f) => (
                    <div key={f.path} className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                      <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                        <FileText size={15} className="text-certify-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-certify-deep truncate">{f.name.replace(".html", "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                        <p className="text-xs text-certify-cool-grey">Policy draft · HTML</p>
                      </div>
                      <a
                        href={downloadHref(f.path)}
                        download
                        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors"
                      >
                        <Download size={13} />
                        Download
                      </a>
                    </div>
                  ))}

                  {/* Calculator — informational note (embedded in HTML output) */}
                  {credit.has_calculator && (
                    <div className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                      <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                        <FileSpreadsheet size={15} className="text-certify-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-certify-deep truncate">Calculator Input Guide</p>
                        <p className="text-xs text-certify-cool-grey">Included in the HTML output above</p>
                      </div>
                    </div>
                  )}

                  {/* Online form — informational note */}
                  {credit.has_form && (
                    <div className="flex items-center gap-3 bg-certify-white/60 rounded-xl px-4 py-3 border border-certify-white">
                      <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center shrink-0">
                        <ClipboardList size={15} className="text-certify-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-certify-deep truncate">
                          {credit.program === "leed_bdc_v41" ? "LEED Online Form Data" : "Online Form Data"}
                        </p>
                        <p className="text-xs text-certify-cool-grey">Pre-filled form data included in HTML output</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <ul className="text-xs text-certify-dark-grey leading-relaxed mb-3 list-disc list-inside space-y-1">
              <li>Open in browser to review</li>
              <li>Drag into Google Drive, then Open With &rarr; Google Docs to edit and print</li>
            </ul>
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
