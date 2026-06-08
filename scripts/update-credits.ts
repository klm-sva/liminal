/**
 * Update existing credits in the database from MOCK_CREDITS in src/lib/mock-data.ts.
 *
 * Updates: price, required_customer_documents, deliverable_description, partial_notes
 * Matches on: credit_code
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/update-credits.ts
 */

import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ───────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MOCK_CREDITS } = require("../src/lib/mock-data");

function mapDocs(docs: Array<{ text: string; condition?: string }>): string[] {
  return docs.map((d) =>
    d.condition ? `${d.text} (${d.condition})` : d.text
  );
}

async function main() {
  console.log(`\nUpdating ${MOCK_CREDITS.length} credits...\n${"─".repeat(60)}`);

  let updated = 0;
  let failed  = 0;

  for (const credit of MOCK_CREDITS) {
    const { error } = await supabase
      .from("credits")
      .update({
        price:                       credit.price,
        required_customer_documents: mapDocs(credit.required_customer_documents ?? []),
        deliverable_description:     credit.deliverable_description,
        partial_notes:               credit.partial_notes ?? null,
      })
      .eq("credit_code", credit.credit_code);

    if (error) {
      console.error(`✗  [${credit.credit_code}] ${error.message}`);
      failed++;
    } else {
      console.log(`✓  [${credit.credit_code}] ${credit.credit_name} — $${(credit.price / 100).toFixed(0)}`);
      updated++;
    }
  }

  console.log(`${"─".repeat(60)}\nDone. Updated: ${updated}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
