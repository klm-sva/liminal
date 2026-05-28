import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import PaymentClient from "./_payment-client";

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ credit_id?: string; project_id?: string; type?: string; program?: string }>;
}) {
  const { credit_id, project_id, type, program } = await searchParams;
  const isGapAnalysis = type === "gap-analysis";

  if (!credit_id && !isGapAnalysis) notFound();

  let creditData = {
    id:        credit_id ?? "",
    credit_name: "Gap Analysis",
    credit_code: "GAP",
    category:  "",
    price:     49900,
  };

  if (credit_id) {
    const supabase = await createServiceClient();
    const { data: credit } = await supabase
      .from("credits")
      .select("id, credit_name, credit_code, category, price")
      .eq("id", credit_id)
      .single();

    if (!credit) notFound();
    creditData = credit;
  }

  return (
    <PaymentClient
      creditId={creditData.id}
      creditName={creditData.credit_name}
      creditCode={creditData.credit_code}
      category={creditData.category}
      price={creditData.price}
      projectId={project_id}
      isGapAnalysis={isGapAnalysis}
      gapAnalysisProgram={program}
    />
  );
}
