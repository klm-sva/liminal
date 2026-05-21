/**
 * GET /api/admin/deliver — called by Vercel cron every 5 minutes
 *
 * For each order where:
 *   - status = 'complete'
 *   - delivery_scheduled_at <= now()
 *   - delivered_at IS NULL
 *   - delay_email_sent = false
 *
 * Outcomes:
 *   - qa_status = 'approved' or 'pending_review' → send delivery email, set delivered_at
 *   - qa_status = 'changes_requested'            → send delay email, set delay_email_sent = true
 */

import { NextResponse }           from "next/server";
import { createServiceClient }    from "@/lib/supabase/server";
import {
  sendOutputDeliveryEmail,
  sendCustomerDelayEmail,
} from "@/lib/resend";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const supabase = await createServiceClient();
  const now      = new Date().toISOString();

  // Orders past their 47h delivery window, not yet delivered, not yet delay-notified
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, customer_id, credit_id, qa_status, delivery_scheduled_at")
    .eq("status", "complete")
    .lte("delivery_scheduled_at", now)
    .is("delivered_at", null)
    .eq("delay_email_sent", false);

  if (error) {
    console.error("[deliver] Query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { orderId: string; action: string }[] = [];

  for (const order of (orders ?? [])) {
    try {
      const [customerRes, creditRes, runRes] = await Promise.all([
        supabase.from("customers").select("email, name").eq("id", order.customer_id).single(),
        supabase.from("credits").select("credit_name").eq("id", order.credit_id).single(),
        supabase
          .from("runs")
          .select("output_html_path")
          .eq("order_id", order.id)
          .eq("status", "completed")
          .order("run_number", { ascending: false })
          .limit(1)
          .single(),
      ]);

      const customerEmail = customerRes.data?.email ?? "";
      const customerName  = customerRes.data?.name  ?? "there";
      const creditName    = creditRes.data?.credit_name ?? "your credit";

      if (order.qa_status === "changes_requested") {
        // Changes requested but not approved — send delay email
        await sendCustomerDelayEmail({
          to:         customerEmail,
          name:       customerName,
          creditName,
        });

        await supabase
          .from("orders")
          .update({ delay_email_sent: true })
          .eq("id", order.id);

        results.push({ orderId: order.id, action: "delay_email_sent" });
        console.log(`[deliver] Delay email → order ${order.id}`);
      } else {
        // approved or pending_review — deliver to customer
        const htmlPath      = runRes.data?.output_html_path ?? "";
        const editablePath  = htmlPath.replace("submission.html", "submission-editable.html");
        const outputPaths   = [htmlPath, editablePath].filter(Boolean);

        await sendOutputDeliveryEmail({
          to:          customerEmail,
          name:        customerName,
          creditName,
          orderId:     order.id,
          outputPaths,
        });

        await supabase
          .from("orders")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", order.id);

        results.push({ orderId: order.id, action: "delivered" });
        console.log(`[deliver] Delivery email → order ${order.id} (qa_status: ${order.qa_status})`);
      }
    } catch (e) {
      console.error(`[deliver] Failed for order ${order.id}:`, (e as Error).message);
      results.push({ orderId: order.id, action: `error: ${(e as Error).message}` });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
