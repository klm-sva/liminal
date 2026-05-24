import { NextResponse }        from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const OUTPUTS_BUCKET = "order-outputs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const url  = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path parameter required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the customer owns this order
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = await createServiceClient();
  const { data: signedData, error: signError } = await serviceClient.storage
    .from(OUTPUTS_BUCKET)
    .createSignedUrl(path, 3600);

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.redirect(signedData.signedUrl);
}
