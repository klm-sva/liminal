/**
 * Seed the credits table from MOCK_CREDITS in src/lib/mock-data.ts.
 *
 * - Skips any credit that already exists by credit_code (safe to re-run)
 * - Maps required_customer_documents {text, condition?}[] → text[]
 * - Fills placeholder values for prompt_text and requirements_pdf_path
 * - For LEED credits with has_calculator=true, also sets calculator_path
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/seed-credits.ts
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

// ── Validate env ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Import mock data ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MOCK_CREDITS } = require("../src/lib/mock-data");

// ── Path helpers ──────────────────────────────────────────────────────────────

function programDir(program: string): string {
  switch (program) {
    case "leed_bdc_v41": return "leed";
    case "well_v2":      return "well-v2";
    case "well_hsr":     return "well-hsr";
    default:             return program;
  }
}

function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[&]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Map required_customer_documents ──────────────────────────────────────────

function mapDocs(docs: Array<{ text: string; condition?: string }>): string[] {
  return docs.map((d) =>
    d.condition ? `${d.text} (${d.condition})` : d.text
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Fetch existing credit codes to skip duplicates
  const { data: existing, error: fetchError } = await supabase
    .from("credits")
    .select("credit_code");

  if (fetchError) {
    console.error("ERROR fetching existing credits:", fetchError.message);
    process.exit(1);
  }

  const existingCodes = new Set((existing ?? []).map((r: { credit_code: string }) => r.credit_code));

  console.log(`\nFound ${existingCodes.size} existing credits in the database.`);
  console.log(`Total credits in mock-data.ts: ${MOCK_CREDITS.length}`);
  console.log("─".repeat(60));

  let inserted = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const credit of MOCK_CREDITS) {
    if (existingCodes.has(credit.credit_code)) {
      skipped++;
      continue;
    }

    const prog   = programDir(credit.program);
    const cat    = categorySlug(credit.category);
    const code   = credit.credit_code;

    const requirementsPdfPath = `${prog}/${cat}/${code}/requirements.pdf`;
    const calculatorPath      = credit.has_calculator
      ? `${prog}/${cat}/${code}/calculator.xlsx`
      : null;

    const row: Record<string, unknown> = {
      program:                     credit.program,
      category:                    credit.category,
      credit_code:                 credit.credit_code,
      credit_name:                 credit.credit_name,
      points_available:            credit.points_available ?? null,
      automation_type:             credit.automation_type,
      requirements_pdf_path:       requirementsPdfPath,
      has_leed_form:               credit.has_leed_form ?? false,
      has_calculator:              credit.has_calculator ?? false,
      calculator_path:             calculatorPath,
      prompt_text:                 `TODO: add prompt text for ${credit.credit_code}`,
      required_customer_documents: mapDocs(credit.required_customer_documents ?? []),
      deliverable_description:     credit.deliverable_description,
      partial_notes:               credit.partial_notes ?? null,
      price:                       credit.price,
      is_active:                   true,
    };

    const { error } = await supabase.from("credits").insert(row);

    if (error) {
      console.error(`✗  [${code}] ${credit.credit_name}`);
      console.error(`   ERROR: ${error.message}`);
      failed++;
    } else {
      console.log(`✓  [${code}] ${credit.credit_name} — $${(credit.price / 100).toFixed(2)}`);
      inserted++;
    }
  }

  console.log("─".repeat(60));
  console.log(`Done. Inserted: ${inserted}  Skipped: ${skipped}  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
