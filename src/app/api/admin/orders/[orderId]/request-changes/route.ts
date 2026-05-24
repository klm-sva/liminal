/**
 * POST /api/admin/orders/[orderId]/request-changes
 *
 * Body: { token: string, instructions: string }
 *
 * Saves QA instructions, regenerates output with additionalInstructions passed
 * to Claude, then sends a new QA review email with updated output links.
 */

import { NextResponse }        from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyQaToken }       from "@/lib/qa-token";

export const maxDuration = 800;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const body         = await request.json().catch(() => ({})) as Record<string, string>;
  const token        = body.token ?? "";
  const instructions = (body.instructions ?? "").trim();

  if (!verifyQaToken(orderId, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  if (!instructions) {
    return NextResponse.json({ error: "Instructions are required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id, status, runs_used, credit_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "complete") {
    return NextResponse.json(
      { error: `Order is not complete (status: ${order.status})` },
      { status: 409 },
    );
  }

  // Mark QA status
  await supabase
    .from("orders")
    .update({
      qa_status:                "changes_requested",
      qa_changes_requested_at:  new Date().toISOString(),
      qa_instructions:          instructions,
    })
    .eq("id", orderId);

  // Find the most recent completed run — reuse it so we use the same upload folder
  const { data: existingRun } = await supabase
    .from("runs")
    .select("id, attempt_number, run_number")
    .eq("order_id", orderId)
    .eq("status", "completed")
    .order("run_number", { ascending: false })
    .limit(1)
    .single();

  if (!existingRun) {
    return NextResponse.json({ error: "No completed run found for this order" }, { status: 404 });
  }

  // Reset run to pending so processOrder can re-run it
  await supabase
    .from("runs")
    .update({ status: "pending", completed_at: null, error_message: null })
    .eq("id", existingRun.id);

  // Re-run the pipeline with the QA instructions injected into the system prompt
  try {
    const { processOrder } = await import("../../../../../../../pipeline/process-order");
    const result = await processOrder(orderId, existingRun.id, instructions);

    if (result.status !== "complete") {
      return NextResponse.json(
        { error: "Regeneration did not complete", details: result.issues },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success:      true,
      message:      "Output regenerated. New QA review email sent.",
      output_paths: result.outputPaths,
    });
  } catch (err) {
    const message = (err as Error).message;
    console.error("[request-changes] Pipeline error:", message);
    return NextResponse.json(
      { error: "Regeneration failed", details: message },
      { status: 500 },
    );
  }
}
