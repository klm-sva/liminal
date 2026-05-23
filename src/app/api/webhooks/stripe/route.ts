import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook Error: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { credit_id, customer_id, project_id, is_gap_analysis, order_id } =
        session.metadata ?? {};

      if (!customer_id) break;
      if (!credit_id && is_gap_analysis !== "true") break;

      const supabase  = getServiceClient();
      const paymentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : null;

      let orderId: string | null = null;

      if (order_id) {
        // Normal path: order was pre-created in /api/checkout — just update payment_id
        await supabase
          .from("orders")
          .update({ payment_id: paymentId })
          .eq("id", order_id);
        orderId = order_id;
      } else {
        // Legacy fallback: create the order now (handles any old checkout sessions
        // that were created before the pre-create flow was deployed)
        const { data: legacy } = await supabase
          .from("orders")
          .insert({
            credit_id:   credit_id ?? null,
            customer_id,
            project_id:  project_id ?? null,
            status:      "awaiting_upload",
            payment_id:  paymentId,
          })
          .select("id")
          .single();
        orderId = legacy?.id ?? null;
      }

      // For credits with no required uploads: switch to processing and fire the pipeline
      if (orderId && credit_id && is_gap_analysis !== "true") {
        const { data: credit } = await supabase
          .from("credits")
          .select("required_customer_documents")
          .eq("id", credit_id)
          .single();

        const docs = credit?.required_customer_documents as string[] | null;
        const requiresUploads = Array.isArray(docs) && docs.length > 0;

        if (!requiresUploads) {
          await supabase
            .from("orders")
            .update({ status: "processing" })
            .eq("id", orderId);

          const { data: run } = await supabase
            .from("runs")
            .insert({
              order_id:              orderId,
              run_number:            1,
              attempt_number:        1,
              status:                "pending",
              customer_upload_paths: [],
            })
            .select("id")
            .single();

          if (run?.id) {
            const baseUrl =
              process.env.NODE_ENV === "development"
                ? "http://localhost:3000"
                : process.env.VERCEL_URL
                  ? `https://${process.env.VERCEL_URL}`
                  : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

            fetch(`${baseUrl}/api/internal/process-order`, {
              method:  "POST",
              headers: {
                "Content-Type":     "application/json",
                "x-webhook-secret": process.env.WEBHOOK_SECRET ?? "",
              },
              body: JSON.stringify({ orderId, runId: run.id }),
            }).catch((err) => {
              console.error("[stripe-webhook] auto-process trigger failed:", (err as Error).message);
            });
          }
        }
      }

      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
