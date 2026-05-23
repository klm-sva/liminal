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
      const { credit_id, customer_id, project_id, is_gap_analysis } = session.metadata ?? {};

      if (customer_id && (credit_id || is_gap_analysis === "true")) {
        const supabase = getServiceClient();

        // Determine whether the credit requires customer document uploads
        let requiresUploads = true; // default: upload flow
        if (credit_id && is_gap_analysis !== "true") {
          const { data: credit } = await supabase
            .from("credits")
            .select("required_customer_documents")
            .eq("id", credit_id)
            .single();
          const docs = credit?.required_customer_documents as string[] | null;
          requiresUploads = Array.isArray(docs) && docs.length > 0;
        }

        const initialStatus = requiresUploads ? "awaiting_upload" : "processing";

        const { data: order } = await supabase
          .from("orders")
          .insert({
            credit_id:  credit_id ?? null,
            customer_id,
            project_id: project_id ?? null,
            status:     initialStatus,
            payment_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
          })
          .select("id")
          .single();

        // No uploads required — create the first run and trigger the pipeline
        if (!requiresUploads && order?.id) {
          const { data: run } = await supabase
            .from("runs")
            .insert({
              order_id:              order.id,
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
              body: JSON.stringify({ orderId: order.id, runId: run.id }),
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
