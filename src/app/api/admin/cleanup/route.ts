/**
 * GET  /api/admin/cleanup  — called by Vercel cron (Authorization: Bearer CRON_SECRET)
 * POST /api/admin/cleanup  — manual trigger (x-cleanup-secret header)
 *
 * Steps:
 *  1. Find runs with deletion_scheduled_at within the next 48 hours
 *     where the order's deletion_warning_sent = false — send warning emails.
 *  2. Call the Supabase Edge Function to delete expired customer uploads.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendDeletionWarningEmail } from "@/lib/resend";

async function runCleanupTasks(orderId?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // ── Step 1: Send 48-hour deletion warning emails ─────────────────────────
  try {
    const serviceClient = await createServiceClient();
    const now     = new Date();
    const in48h   = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: expiringRuns } = await serviceClient
      .from("runs")
      .select("id, order_id, deletion_scheduled_at")
      .gte("deletion_scheduled_at", now.toISOString())
      .lte("deletion_scheduled_at", in48h.toISOString());

    for (const run of (expiringRuns ?? [])) {
      const { data: order } = await serviceClient
        .from("orders")
        .select("id, customer_id, credit_id, deletion_warning_sent")
        .eq("id", run.order_id)
        .single();

      if (!order || order.deletion_warning_sent) continue;

      const [customerRes, creditRes] = await Promise.all([
        serviceClient.from("customers").select("email, name").eq("id", order.customer_id).single(),
        serviceClient.from("credits").select("credit_name").eq("id", order.credit_id).single(),
      ]);

      if (customerRes.data && creditRes.data) {
        await sendDeletionWarningEmail({
          to:         customerRes.data.email,
          name:       customerRes.data.name ?? "there",
          creditName: creditRes.data.credit_name,
          orderId:    order.id,
        });

        await serviceClient
          .from("orders")
          .update({ deletion_warning_sent: true })
          .eq("id", order.id);
      }
    }
  } catch (e) {
    console.error("[cleanup] Deletion warning step failed:", e);
  }

  // ── Step 2: Call Edge Function to delete expired uploads ─────────────────
  const res = await fetch(
    `${supabaseUrl}/functions/v1/delete-customer-uploads`,
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(orderId ? { order_id: orderId } : {}),
    }
  );

  const result = await res.json();
  return NextResponse.json(result, { status: res.status });
}

// GET — Vercel cron (Authorization: Bearer CRON_SECRET)
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return runCleanupTasks();
}

// POST — manual trigger with x-cleanup-secret
export async function POST(request: Request) {
  const secret = request.headers.get("x-cleanup-secret");
  if (!secret || secret !== process.env.CLEANUP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body    = await request.json().catch(() => ({}));
  const orderId = (body as Record<string, string>)?.order_id ?? undefined;
  return runCleanupTasks(orderId);
}
