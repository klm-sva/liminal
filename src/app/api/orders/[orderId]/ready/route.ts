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
import { waitUntil }           from "@vercel/functions";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 300;
import {
  sendDocumentsRequestedEmail,
  sendProcessingStartedEmail,
  sendUploadConfirmationEmail,
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
    console.log("[ready] insert attempted with orderId:", orderId, "attemptNumber:", attemptNumber);
    console.error("[ready] run insert failed:", JSON.stringify(runError, null, 2));
    return NextResponse.json(
      { error: "Failed to create run", details: runError?.message },
      { status: 500 }
    );
  }

  // Load customer and credit for emails
  const [customerRes, creditRes] = await Promise.all([
    serviceClient.from("customers").select("email, name").eq("id", order.customer_id).single(),
    serviceClient.from("credits").select("credit_name, credit_code").eq("id", order.credit_id!).single(),
  ]);

  const customerEmail = customerRes.data?.email ?? "";
  const customerName  = customerRes.data?.name ?? "there";
  const creditName    = creditRes.data?.credit_name ?? "your credit";
  const creditCode    = creditRes.data?.credit_code ?? "";

  // Send upload confirmation email now that files are in Storage
  if (customerEmail && creditCode && order.project_id) {
    const attemptFolder = `${order.customer_id}/${order.project_id}/orders/${orderId}-${creditCode}/attempt-${attemptNumber}`;
    const { data: storageFiles } = await serviceClient.storage
      .from("customer-uploads")
      .list(attemptFolder);
    const fileCount = (storageFiles ?? []).filter((f) => f.name && !f.name.endsWith("/")).length;
    if (fileCount > 0) {
      await sendUploadConfirmationEmail({
        to:         customerEmail,
        name:       customerName,
        creditName,
        orderId,
        fileCount,
      }).catch((e) => console.error("[ready] sendUploadConfirmationEmail failed:", e));
    }
  }

  // Notify customer that processing has started
  await sendProcessingStartedEmail({
    to:         customerEmail,
    name:       customerName,
    creditName,
  }).catch((e) => console.error("[ready] sendProcessingStartedEmail failed:", e));

  // Fire the pipeline in the background — response returns immediately so the
  // customer lands on the processing page without waiting for pipeline completion.
  waitUntil(
    import("../../../../../../pipeline/process-order").then(({ processOrder }) =>
      processOrder(orderId, run.id).then(async (result) => {
        if (result.status === "documents_requested") {
          await sendDocumentsRequestedEmail({
            to:         customerEmail,
            name:       customerName,
            creditName,
            orderId,
            issues:     result.issues ?? [],
          });
        }
        // complete: QA email already sent inside processOrder; delivery email sent by cron
      }).catch(async (err) => {
        const message = (err as Error).message;
        console.error("[ready] pipeline failed:", message);
        await serviceClient.from("runs").update({
          status:        "failed",
          error_message: message,
          completed_at:  new Date().toISOString(),
        }).eq("id", run.id);
        await serviceClient.from("orders").update({ status: "failed" }).eq("id", orderId);
      })
    )
  );

  return NextResponse.json({ status: "processing", run_id: run.id });
}
