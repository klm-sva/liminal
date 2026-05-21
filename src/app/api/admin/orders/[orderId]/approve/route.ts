/**
 * GET /api/admin/orders/[orderId]/approve?token=[signed]
 *
 * Marks the QA status as approved. Output will be delivered by the 47h cron.
 * Returns an HTML confirmation page so clicking the link in the email works directly.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { verifyQaToken }       from "@/lib/qa-token";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const url         = new URL(request.url);
  const token       = url.searchParams.get("token") ?? "";

  if (!verifyQaToken(orderId, token)) {
    return new Response(html("Error", "#c0392b", "Invalid or missing token."), {
      status:  403,
      headers: { "Content-Type": "text/html" },
    });
  }

  const supabase = await createServiceClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, qa_status, delivery_scheduled_at, credit_id, project_id")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return new Response(html("Error", "#c0392b", "Order not found."), {
      status:  404,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (order.qa_status === "approved") {
    const deliveryTime = order.delivery_scheduled_at
      ? new Date(order.delivery_scheduled_at).toLocaleString("en-US", { timeZone: "America/New_York" })
      : "scheduled time";
    return new Response(
      html("Already Approved", "#27ae60", `This order was already approved. Output will deliver at ${deliveryTime} ET.`),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  await supabase
    .from("orders")
    .update({ qa_status: "approved", qa_approved_at: new Date().toISOString() })
    .eq("id", orderId);

  const deliveryTime = order.delivery_scheduled_at
    ? new Date(order.delivery_scheduled_at).toLocaleString("en-US", { timeZone: "America/New_York" })
    : "the scheduled time";

  return new Response(
    html("Approved", "#27ae60", `Order <code>${orderId.slice(0, 8).toUpperCase()}</code> approved. Output will be delivered to the customer at ${deliveryTime} ET.`),
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
}

function html(title: string, color: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9f9f9;}
.card{background:#fff;border-radius:8px;padding:40px 48px;box-shadow:0 2px 12px rgba(0,0,0,.08);max-width:480px;text-align:center;}
h1{color:${color};margin-bottom:12px;}p{color:#555;line-height:1.6;}code{background:#f0f0f0;padding:2px 6px;border-radius:3px;}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}
