import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import UploadClient from "./_upload-client";

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

  const supabase = await createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, credit_id, credits(credit_code, credit_name, required_customer_documents)")
    .eq("id", orderId)
    .single();

  if (!order && !isGapAnalysis) notFound();

  type OrderWithCredit = { id: string; credits?: { credit_code: string; credit_name: string; required_customer_documents: string[] } | null };
  const credit = (order as unknown as OrderWithCredit)?.credits ?? null;
  const requiredDocs = isGapAnalysis
    ? GAP_ANALYSIS_DOCS
    : (credit?.required_customer_documents ?? []);

  return (
    <UploadClient
      orderId={orderId}
      creditCode={credit?.credit_code}
      creditName={credit?.credit_name}
      requiredDocs={requiredDocs}
      isGapAnalysis={isGapAnalysis}
    />
  );
}
