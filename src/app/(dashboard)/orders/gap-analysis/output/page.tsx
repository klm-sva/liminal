import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import GapAnalysisOutputClient from "./_output-client";

export const metadata: Metadata = { title: "Gap Analysis Report" };

export default async function GapAnalysisOutputPage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = await createServiceClient();

  let htmlContent: string | null = null;

  if (user) {
    // Find all orders for this customer
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("customer_id", user.id);

    const orderIds = (orders ?? []).map((o) => o.id);

    if (orderIds.length > 0) {
      // Find the most recent completed run with HTML output
      const { data: run } = await supabase
        .from("runs")
        .select("id, output_html_path, completed_at")
        .in("order_id", orderIds)
        .eq("status", "completed")
        .not("output_html_path", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (run?.output_html_path) {
        const { data: signed } = await supabase.storage
          .from("order-outputs")
          .createSignedUrl(run.output_html_path, 3600);

        if (signed?.signedUrl) {
          try {
            const res = await fetch(signed.signedUrl);
            if (res.ok) htmlContent = await res.text();
          } catch {
            // Storage fetch failed — fall through to empty state
          }
        }
      }
    }
  }

  return (
    <GapAnalysisOutputClient
      htmlContent={htmlContent}
      backHref="/dashboard"
      programLabel="LEED BD+C v4.1"
    />
  );
}
