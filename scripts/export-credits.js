/**
 * scripts/export-credits.js
 *
 * Reads all active credits from Supabase and writes them to src/data/credits.json.
 * Run this whenever credit data changes, then commit and redeploy.
 *
 * Usage:  node scripts/export-credits.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

supabase
  .from("credits")
  .select("*")
  .eq("is_active", true)
  .order("credit_code")
  .then(({ data, error }) => {
    if (error) {
      console.error("Supabase error:", error.message);
      process.exit(1);
    }
    const outPath = path.resolve(__dirname, "../src/data/credits.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`✓ Wrote ${data.length} credits to src/data/credits.json`);
  });
