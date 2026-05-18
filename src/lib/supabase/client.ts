import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function isConfigured() {
  try { new URL(url); return url.length > 0 && key.length > 0; }
  catch { return false; }
}

export function createClient() {
  if (!isConfigured()) return null;
  return createBrowserClient<Database>(url, key);
}
