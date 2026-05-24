/**
 * POST /api/orders/[orderId]/confirm-upload
 *
 * Called once after all files have been uploaded in a session.
 * Upload confirmation email is sent by the /ready route after the run is
 * created and files are confirmed in Storage.
 */

import { NextResponse }        from "next/server";
import { createClient }        from "@/lib/supabase/server";

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
    .select("id")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ confirmed: true });
}
