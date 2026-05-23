/**
 * POST /api/orders/[orderId]/ready
 *
 * Customer signals their documents are ready for review.
 * Validates ownership and order state, then kicks off the processing pipeline.
 *
 * State transitions:
 *   awaiting_upload      → under_review (attempt 1, first submission)
 *   awaiting_ready       → under_review (attempt 1, after upload confirmation)
 *   documents_requested  → under_review (attempt 2 re-submission)
 *   awaiting_ready_final → under_review (attempt 2, after upload confirmation)
 */

import { NextResponse }        from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  sendDocumentsRequestedEmail,
  sendProcessingStartedEmail,
} from "@/lib/resend";

const READY_STATUSES = new Set([
  "awaiting_upload",
  "awaiting_ready",
  "documents_requested",
  "awaiting_ready_final",
]);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch order — must belong to this customer
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id, status, runs_used, runs_remaining, credit_id, project_id")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!READY_STATUSES.has(order.status)) {
    return NextResponse.json(
      { error: `Order cannot be submitted in status '${order.status}'.` },
      { status: 409 }
    );
  }

  if (order.runs_remaining <= 0) {
    return NextResponse.json(
      { error: "No runs remaining for this order." },
      { status: 409 }
    );
  }

  const serviceClient = await createServiceClient();
  const attemptNumber = order.runs_used + 1;

  // Create a run record for this attempt
  const { data: run, error: runError } = await serviceClient
    .from("runs")
    .insert({
      order_id:       orderId,
      run_number:     attemptNumber,
      attempt_number: attemptNumber,
      status:         "pending",
      // customer_upload_paths resolved by process-order from Storage listing
      customer_upload_paths: [],
    })
    .select()
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: "Failed to create run", details: runError?.message },
      { status: 500 }
    );
  }

  // Load customer and credit for emails
  const [customerRes, creditRes] = await Promise.all([
    serviceClient.from("customers").select("email, name").eq("id", order.customer_id).single(),
    serviceClient.from("credits").select("credit_name").eq("id", order.credit_id!).single(),
  ]);

  const customerEmail = customerRes.data?.email ?? "";
  const customerName  = customerRes.data?.name ?? "there";
  const creditName    = creditRes.data?.credit_name ?? "your credit";

  // Notify customer that processing has started
  await sendProcessingStartedEmail({
    to:         customerEmail,
    name:       customerName,
    creditName,
  }).catch((e) => console.error("[ready] sendProcessingStartedEmail failed:", e));

  // Run the pipeline — this is synchronous in development; in production this
  // should be handed off to a background worker / Edge Function.
  // We intentionally do not await here if you use a queue; for simplicity we
  // await inline and handle the result to send the appropriate email.
  try {
    const { processOrder } = await import("../../../../../../pipeline/process-order");
    const result = await processOrder(orderId, run.id);

    if (result.status === "documents_requested") {
      await sendDocumentsRequestedEmail({
        to:         customerEmail,
        name:       customerName,
        creditName,
        orderId,
        issues:     result.issues ?? [],
      });
      return NextResponse.json({
        status:  "documents_requested",
        run_id:  run.id,
        issues:  result.issues,
      });
    }

    if (result.status === "complete") {
      // Output is held for QA review — delivery email sent by the 47h cron.
      // QA review email already sent inside processOrder (Step 18.5).
      return NextResponse.json({
        status:       "complete",
        run_id:       run.id,
        output_paths: result.outputPaths,
      });
    }
  } catch (err) {
    const message = (err as Error).message;
    await serviceClient.from("runs").update({
      status:        "failed",
      error_message: message,
      completed_at:  new Date().toISOString(),
    }).eq("id", run.id);

    await serviceClient.from("orders").update({ status: "failed" }).eq("id", orderId);

    return NextResponse.json(
      { error: "Pipeline failed", details: message },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "processing", run_id: run.id });
}
