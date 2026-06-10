import { notFound, redirect } from "next/navigation";
import Link                   from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, status, delivered_at, project_id, credits(credit_name, credit_code)")
    .eq("id", orderId)
    .single();

  if (!order) notFound();

  type OrderRow = typeof order & { customer_id: string; delivered_at: string | null; project_id: string | null; credits?: { credit_name: string; credit_code: string } | null };
  const typed = order as unknown as OrderRow;

  if (typed.customer_id !== user.id) redirect("/dashboard");

  const status  = typed.status;
  const shortId = orderId.slice(-6).toUpperCase();

  // Fetch latest run error message for failed states
  const { data: latestRun } = await supabase
    .from("runs")
    .select("error_message")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const runError = latestRun?.error_message as string | null ?? null;

  if (status === "documents_requested") {
    const { data: run } = await supabase
      .from("runs")
      .select("review_issues")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const issues: string[] = (run?.review_issues as string[] | null) ?? [];

    return (
      <div className="min-h-screen bg-certify-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
          <h1 className="font-serif text-3xl text-certify-deep mb-2">Additional documents needed</h1>
          <p className="text-sm text-certify-cool-grey mb-8">Order #{shortId}</p>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <p className="text-sm font-semibold text-amber-800 mb-3">Our review found the following issues with your submission:</p>
            {issues.length > 0 ? (
              <ul className="space-y-2">
                {issues.map((issue, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-amber-700">Please upload the required documents and resubmit.</p>
            )}
          </div>

          <Link
            href={`/orders/${orderId}/upload`}
            className="w-full flex items-center justify-center bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md"
          >
            Upload missing documents
          </Link>
        </div>
      </div>
    );
  }

  if (status === "processing" || status === "under_review") {
    return (
      <div className="min-h-screen bg-certify-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="font-serif text-3xl text-certify-deep mb-2">Processing your order</h1>
          <p className="text-sm text-certify-cool-grey mb-6">Order #{shortId}</p>
          <p className="text-sm text-certify-cool-grey">
            We are working on your submission. You will receive an email when it is ready — typically within a few minutes.
          </p>
        </div>
      </div>
    );
  }

  if (status === "complete" && !typed.delivered_at) {
    return (
      <div className="min-h-screen bg-certify-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="font-serif text-3xl text-certify-deep mb-2">Processing your order</h1>
          <p className="text-sm text-certify-cool-grey mb-6">Order #{shortId}</p>
          <p className="text-sm text-certify-cool-grey">
            We are working on your submission. You will receive an email when it is ready.
          </p>
        </div>
      </div>
    );
  }

  if (status === "complete" || status === "delivered") {
    return (
      <div className="min-h-screen bg-certify-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="font-serif text-3xl text-certify-deep mb-2">Your output is ready</h1>
          <p className="text-sm text-certify-cool-grey mb-8">Order #{shortId}</p>
          <Link
            href={`/orders/${orderId}/delivery`}
            className="inline-flex items-center justify-center bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 px-8 rounded-xl transition-all shadow-md"
          >
            View your output
          </Link>
        </div>
      </div>
    );
  }

  if (status === "address_invalid") {
    return (
      <div className="min-h-screen bg-certify-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
          <h1 className="font-serif text-3xl text-certify-deep mb-2">Address needs correction</h1>
          <p className="text-sm text-certify-cool-grey mb-6">Order #{shortId}</p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <p className="text-sm font-semibold text-amber-800 mb-2">We could not verify your project address</p>
            <p className="text-sm text-amber-700">
              {runError ?? "The project address could not be found. Please update it and resubmit."}
            </p>
          </div>
          {typed.project_id && (
            <Link
              href={`/projects/${typed.project_id}/edit`}
              className="w-full flex items-center justify-center bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md mb-4"
            >
              Update project address
            </Link>
          )}
          <p className="text-xs text-certify-cool-grey text-center">
            No additional charge will apply when you resubmit after correcting the address.
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="min-h-screen bg-certify-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
          <h1 className="font-serif text-3xl text-certify-deep mb-2">Processing failed</h1>
          <p className="text-sm text-certify-cool-grey mb-6">Order #{shortId}</p>
          {runError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
              <p className="text-sm text-red-700">{runError}</p>
            </div>
          )}
          <p className="text-sm text-certify-cool-grey mb-4">
            {runError
              ? "Please contact support and reference your order number if you need assistance."
              : "Something went wrong processing your order. Please contact support and reference your order number."}
          </p>
          <a
            href="mailto:support@liminalsva.com"
            className="text-certify-blue hover:text-certify-teal transition-colors text-sm"
          >
            Contact support →
          </a>
        </div>
      </div>
    );
  }

  // Any other status (awaiting_upload, awaiting_ready, etc.) — redirect to upload page
  redirect(`/orders/${orderId}/upload`);
}
