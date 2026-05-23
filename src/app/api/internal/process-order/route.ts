/**
 * POST /api/internal/process-order
 *
 * Internal endpoint: runs the pipeline for a no-upload order.
 * Called fire-and-forget from the Stripe webhook after it creates
 * a pending run for a credit that requires no customer documents.
 *
 * Protected by x-webhook-secret header.
 */

import { NextResponse }        from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  sendProcessingStartedEmail,
  sendDocumentsRequestedEmail,
} from "@/lib/resend";

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId, runId } = (await request.json()) as { orderId: string; runId: string };

  if (!orderId || !runId) {
    return NextResponse.json({ error: "orderId and runId are required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("customer_id, credit_id")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const [customerRes, creditRes] = await Promise.all([
    supabase.from("customers").select("email, name").eq("id", order.customer_id).single(),
    order.credit_id
      ? supabase.from("credits").select("credit_name").eq("id", order.credit_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const customerEmail = customerRes.data?.email ?? "";
  const customerName  = customerRes.data?.name  ?? "there";
  const creditName    = (creditRes as { data: { credit_name: string } | null }).data?.credit_name ?? "your credit";

  await sendProcessingStartedEmail({ to: customerEmail, name: customerName, creditName })
    .catch((e) => console.error("[auto-process] sendProcessingStartedEmail failed:", e));

  try {
    const { processOrder } = await import("../../../../../pipeline/process-order");
    const result = await processOrder(orderId, runId);

    if (result.status === "documents_requested") {
      await sendDocumentsRequestedEmail({
        to:         customerEmail,
        name:       customerName,
        creditName,
        orderId,
        issues:     result.issues ?? [],
      }).catch((e) => console.error("[auto-process] sendDocumentsRequestedEmail failed:", e));
    }

    return NextResponse.json({ status: result.status });
  } catch (err) {
    const message = (err as Error).message;
    console.error("[auto-process] pipeline failed:", message);

    await supabase
      .from("runs")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", runId);

    await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);

    return NextResponse.json({ error: "Pipeline failed", details: message }, { status: 500 });
  }
}
