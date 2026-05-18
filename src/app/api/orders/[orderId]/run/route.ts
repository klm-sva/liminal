/**
 * POST /api/orders/[orderId]/run
 * Creates a new run for an order (max 2 per order).
 * Validates ownership, run budget, and upload paths before writing.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.object({
  customer_upload_paths: z
    .array(z.string().min(1))
    .min(1, "At least one upload path is required")
    .max(20, "Maximum 20 files per run"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  // Authenticate the caller
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: (err as Error).message },
      { status: 400 }
    );
  }

  // Fetch order — must belong to this customer
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id, status, runs_used, runs_remaining, credit_id")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Guard: only allow new runs when pending_upload or failed
  if (!["pending_upload", "failed"].includes(order.status)) {
    return NextResponse.json(
      { error: `Cannot start a new run. Order status is '${order.status}'.` },
      { status: 409 }
    );
  }

  // Guard: run budget
  if (order.runs_remaining <= 0) {
    return NextResponse.json(
      { error: "No runs remaining for this order (maximum 2 used)." },
      { status: 409 }
    );
  }

  // Validate that all upload paths belong to this customer's folder
  const invalidPaths = body.customer_upload_paths.filter(
    (p) => !p.startsWith(`${user.id}/`)
  );
  if (invalidPaths.length > 0) {
    return NextResponse.json(
      { error: "Upload paths must be in your customer folder.", invalid: invalidPaths },
      { status: 400 }
    );
  }

  const runNumber = order.runs_used + 1;

  // Insert run — triggers decrement_order_runs automatically
  const serviceClient = await createServiceClient();
  const { data: run, error: runError } = await serviceClient
    .from("runs")
    .insert({
      order_id:              orderId,
      run_number:            runNumber,
      customer_upload_paths: body.customer_upload_paths,
      status:                "pending",
    })
    .select()
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: "Failed to create run", details: runError?.message },
      { status: 500 }
    );
  }

  // Update order status to processing
  await serviceClient
    .from("orders")
    .update({ status: "processing" })
    .eq("id", orderId);

  return NextResponse.json({
    run_id:    run.id,
    run_number: run.run_number,
    status:    run.status,
  }, { status: 201 });
}
