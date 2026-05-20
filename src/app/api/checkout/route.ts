import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { credit_id, project_id } = await req.json();

    if (!credit_id) {
      return NextResponse.json({ error: "credit_id required" }, { status: 400 });
    }

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();
    const { data: credit } = await supabase
      .from("credits")
      .select("id, credit_name, credit_code, stripe_price_id, price")
      .eq("id", credit_id)
      .eq("is_active", true)
      .single();

    if (!credit?.stripe_price_id) {
      return NextResponse.json({ error: "Credit not found or not configured for checkout" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const cancelParams = new URLSearchParams({ credit_id });
    if (project_id) cancelParams.set("project_id", project_id);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: credit.stripe_price_id, quantity: 1 }],
      success_url: `${appUrl}/dashboard?payment_success=1`,
      cancel_url: `${appUrl}/orders/new/payment?${cancelParams.toString()}`,
      metadata: {
        credit_id: credit.id,
        customer_id: user.id,
        ...(project_id ? { project_id } : {}),
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
