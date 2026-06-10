import { notFound }             from "next/navigation";
import { createClient }  from "@/lib/supabase/server";
import UploadClient             from "./_upload-client";
import AutoSubmit               from "./_auto-submit";

const GAP_ANALYSIS_DOCS = [
  "Project drawings (site plan, floor plans)",
  "Current project specifications",
  "Geotechnical or site assessment report",
  "Mechanical / HVAC system narrative",
  "Landscape plan or site coverage diagram",
];

export default async function UploadPage({
  params,
  searchParams,
}: {
  params:       Promise<{ orderId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { orderId } = await params;
  const { type }    = await searchParams;
  const isGapAnalysis = type === "gap-analysis";

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, project_id, credit_id, status, credits(credit_code, credit_name, required_customer_documents)")
    .eq("id", orderId)
    .single();

  if (!order && !isGapAnalysis) notFound();

  type OrderWithCredit = {
    id: string;
    project_id: string | null;
    status: string;
    credits?: { credit_code: string; credit_name: string; required_customer_documents: string[] } | null;
  };
  const typedOrder = order as unknown as OrderWithCredit;
  const credit = typedOrder?.credits ?? null;
  const requiredDocs = isGapAnalysis
    ? GAP_ANALYSIS_DOCS
    : (credit?.required_customer_documents ?? []);

  // Zero-doc credit with no prior request — trigger pipeline immediately without
  // showing the upload UI. The AutoSubmit component calls ready client-side so
  // the user's auth session is available, then redirects to /processing.
  if (!isGapAnalysis && requiredDocs.length === 0 && typedOrder?.status === "awaiting_upload") {
    return <AutoSubmit orderId={orderId} />;
  }

  // For non-awaiting_upload zero-doc statuses (documents_requested etc.) fall through
  // to the normal upload UI so the customer can resubmit.

  // Fetch review issues from the most recent failed run when docs were requested
  let reviewIssues: string[] = [];
  if (typedOrder?.status === "documents_requested") {
    const { data: latestRun } = await supabase
      .from("runs")
      .select("review_issues")
      .eq("order_id", orderId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    reviewIssues = (latestRun?.review_issues as string[] | null) ?? [];
  }

  // Check whether any previous completed orders exist for the same project
  let hasPreviousOrders = false;
  if (typedOrder?.project_id) {
    const { data: prev } = await supabase
      .from("orders")
      .select("id")
      .eq("project_id", typedOrder.project_id)
      .eq("status", "complete")
      .neq("id", orderId)
      .limit(1);
    hasPreviousOrders = (prev?.length ?? 0) > 0;
  }

  return (
    <UploadClient
      orderId={orderId}
      creditCode={credit?.credit_code}
      creditName={credit?.credit_name}
      requiredDocs={requiredDocs}
      reviewIssues={reviewIssues}
      isGapAnalysis={isGapAnalysis}
      hasPreviousOrders={hasPreviousOrders}
    />
  );
}
