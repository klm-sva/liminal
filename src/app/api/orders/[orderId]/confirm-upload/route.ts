/**
 * POST /api/orders/[orderId]/confirm-upload
 *
 * Called once after all files have been uploaded in a session.
 * Sends a single upload confirmation email with the total file count,
 * and updates the most recent run's customer_upload_paths with the
 * accumulated UploadThing URLs.
 */

import { NextResponse }        from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendUploadConfirmationEmail } from "@/lib/resend";

export const maxDuration = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id, credit_id")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const serviceClient = await createServiceClient();

  // Find the most recent run for this order
  const { data: latestRun } = await serviceClient
    .from("runs")
    .select("id, customer_upload_paths")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // The upload paths are UploadThing CDN URLs accumulated by onUploadComplete per-file
  const uploadPaths = (latestRun?.customer_upload_paths ?? []) as string[];
  const fileCount   = uploadPaths.length;

  // Persist the final deduplicated list back to the run
  if (latestRun && uploadPaths.length > 0) {
    await serviceClient
      .from("runs")
      .update({ customer_upload_paths: [...new Set(uploadPaths)] })
      .eq("id", latestRun.id);
  }

  // Send one consolidated upload confirmation email
  const [customerRes, creditRes] = await Promise.all([
    serviceClient.from("customers").select("email, name").eq("id", user.id).single(),
    order.credit_id
      ? serviceClient.from("credits").select("credit_name").eq("id", order.credit_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const customerEmail = customerRes.data?.email;
  const customerName  = customerRes.data?.name  ?? "there";
  const creditName    = (creditRes as { data: { credit_name: string } | null }).data?.credit_name ?? "your credit";

  if (customerEmail && fileCount > 0) {
    await sendUploadConfirmationEmail({
      to:         customerEmail,
      name:       customerName,
      creditName,
      orderId,
      fileCount,
    }).catch((e) => console.error("[confirm-upload] sendUploadConfirmationEmail failed:", e));
  }

  return NextResponse.json({ confirmed: true, fileCount });
}
