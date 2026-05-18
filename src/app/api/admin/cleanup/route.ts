/**
 * POST /api/admin/cleanup
 * Triggers the delete-customer-uploads Edge Function.
 * Protected by CLEANUP_SECRET env var — called by scheduled jobs or server-side code.
 */

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cleanup-secret");
  if (!secret || secret !== process.env.CLEANUP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const body = await request.json().catch(() => ({}));
  const orderId = (body as Record<string, string>)?.order_id ?? undefined;

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
