/**
 * Pipeline-local Supabase service client.
 * Uses env vars directly — no Next.js cookies dependency.
 * Only use for service-role operations (DB reads/writes, storage).
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient<Database>(url, key);
}
