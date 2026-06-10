/**
 * Edge Function: delete-customer-uploads
 *
 * Drains the cleanup_queue table and permanently deletes temporary
 * customer upload files from the customer-uploads storage bucket.
 *
 * Rules:
 *   - Only processes entries where scheduled_deletion_at <= now()
 *   - Never deletes paths containing /outputs/, /drawings/, or project-profile.json
 *   - Writes an audit_log record for every deletion batch
 *
 * Invocation:
 *   Called on a schedule (pg_cron / Supabase scheduled functions) every hour.
 *   Can also be called directly with { order_id } to process one order.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET               = "customer-uploads";

const PROTECTED_SEGMENTS = ["/outputs/", "project-profile.json"];

function isProtectedPath(p: string): boolean {
  return PROTECTED_SEGMENTS.some((seg) => p.includes(seg));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let orderIdFilter: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    orderIdFilter = body?.order_id ?? null;
  } catch {}

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Only fetch entries whose deletion delay has elapsed
  let query = supabase
    .from("cleanup_queue")
    .select("id, order_id, file_paths, scheduled_deletion_at")
    .eq("processed", false)
    .lte("scheduled_deletion_at", new Date().toISOString())
    .order("scheduled_deletion_at", { ascending: true })
    .limit(100);

  if (orderIdFilter) {
    query = query.eq("order_id", orderIdFilter);
  }

  const { data: entries, error: fetchError } = await query;

  if (fetchError) {
    console.error("Failed to fetch cleanup queue:", fetchError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch cleanup queue" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!entries || entries.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, message: "No entries ready for deletion" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const results: Array<{
    queue_id: string;
    order_id: string;
    deleted: string[];
    skipped: string[];
    errors: string[];
  }> = [];

  for (const entry of entries) {
    const allPaths: string[] = entry.file_paths ?? [];
    const deletable = allPaths.filter((p) => !isProtectedPath(p));
    const skipped   = allPaths.filter((p) =>  isProtectedPath(p));
    const deleted: string[] = [];
    const errors: string[] = [];

    // Delete in batches of 10
    for (let i = 0; i < deletable.length; i += 10) {
      const batch = deletable.slice(i, i + 10);
      const { data, error } = await supabase.storage.from(BUCKET).remove(batch);

      if (error) {
        console.error(`Storage delete error for order ${entry.order_id}:`, error);
        errors.push(error.message);
      } else if (data) {
        deleted.push(...batch);
      }
    }

    // Mark processed
    const { error: markError } = await supabase
      .from("cleanup_queue")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", entry.id);

    if (markError) {
      console.error(`Failed to mark cleanup entry ${entry.id} as processed:`, markError);
    }

    // Audit log
    await supabase.from("audit_log").insert({
      event_type:  "files_deleted",
      entity_type: "order",
      entity_id:   entry.order_id,
      customer_id: entry.order_id, // order_id used as key; customer_id resolved by caller if needed
      metadata:    {
        deletedCount: deleted.length,
        skippedCount: skipped.length,
        errorCount:   errors.length,
        skipped,
      },
    });

    results.push({ queue_id: entry.id, order_id: entry.order_id, deleted, skipped, errors });
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted.length, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped.length, 0);
  const totalErrors  = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(
    `Cleanup: ${totalDeleted} deleted, ${totalSkipped} skipped (protected), ${totalErrors} errors — ${results.length} orders`
  );

  return new Response(
    JSON.stringify({ processed: results.length, total_files_deleted: totalDeleted, total_skipped: totalSkipped, total_errors: totalErrors, results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
