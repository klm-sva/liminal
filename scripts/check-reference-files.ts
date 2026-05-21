/**
 * Check which credit requirements PDFs are present in pipeline/reference/
 * against every credit in the Supabase credits table.
 *
 * Run with:
 *   npx ts-node scripts/check-reference-files.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Load env from .env.local
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const REF_BASE  = path.resolve(__dirname, "../pipeline/reference");

const PROGRAM_REF_SUBDIR: Record<string, string> = {
  leed_bdc_v41: "leed",
  well_v2:      "well-v2",
  well_hsr:     "well-hsr",
};

function buildExpectedPdfName(program: string, creditCode: string, creditName: string): string {
  const code = creditCode.replace(/β/g, "beta");
  const name = creditName.replace(/β/g, "beta");
  if (program === "leed_bdc_v41") {
    const m = code.match(/^([A-Z]+)(c|p)\d+$/i);
    const catAbbrev = m ? m[1].toUpperCase() : code.replace(/[^A-Z]/gi, "").toUpperCase();
    return `LEED_${catAbbrev}_${name}.pdf`;
  }
  if (program === "well_v2")  return `WELL_V2_${code}_${name}.pdf`;
  return `WELL_HSR_${code}_${name}.pdf`;
}

// Mirrors findCategoryFolder() in pipeline/process-order.ts exactly.
function findCategoryFolder(programDir: string, category: string, creditCode: string): string | undefined {
  const allDirs = fs.existsSync(programDir)
    ? fs.readdirSync(programDir).filter((d) => {
        try { return fs.statSync(path.join(programDir, d)).isDirectory(); } catch { return false; }
      })
    : [];

  const categoryLower = category.toLowerCase();

  const exact = allDirs.find((d) => d.toLowerCase() === categoryLower);
  if (exact) return exact;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalised = allDirs.find((d) => norm(d) === norm(category));
  if (normalised) return normalised;

  const prefixMatch = creditCode.match(/^([A-Z]+)/i);
  const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : null;
  if (prefix) {
    const byPrefix = allDirs.find((d) => {
      const words = d.trim().toUpperCase().split(/\s+/);
      return words.includes(prefix);
    });
    if (byPrefix) return byPrefix;
  }

  return undefined;
}

interface CheckResult {
  program:      string;
  category:     string;
  creditCode:   string;
  creditName:   string;
  expectedName: string;
  searchedDir:  string;
  found:        boolean;
  resolvedFile: string | null;
  filesPresent: string[];
}

function checkCredit(credit: {
  program:     string;
  category:    string;
  credit_code: string;
  credit_name: string;
}): CheckResult {
  const { program, category, credit_code, credit_name } = credit;
  const subdir       = PROGRAM_REF_SUBDIR[program];
  const expectedName = buildExpectedPdfName(program, credit_code, credit_name);

  const base: Omit<CheckResult, "found" | "resolvedFile" | "filesPresent" | "searchedDir"> = {
    program,
    category,
    creditCode:  credit_code,
    creditName:  credit_name,
    expectedName,
  };

  if (!subdir) {
    return { ...base, found: false, searchedDir: "(unknown program)", resolvedFile: null, filesPresent: [] };
  }

  const programDir  = path.join(REF_BASE, subdir);
  const categoryDir = findCategoryFolder(programDir, category, credit_code);

  const searchedDir = categoryDir
    ? path.join(`pipeline/reference/${subdir}`, categoryDir)
    : path.join(`pipeline/reference/${subdir}`, category);

  if (!categoryDir) {
    return { ...base, found: false, searchedDir, resolvedFile: null, filesPresent: [] };
  }

  const folderPath = path.join(programDir, categoryDir);
  const allFiles   = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith(".pdf"));

  // Strategy 1: exact case-insensitive filename match
  const exact = allFiles.find((f) => f.toLowerCase() === expectedName.toLowerCase());
  if (exact) {
    return { ...base, found: true, searchedDir, resolvedFile: path.join(searchedDir, exact), filesPresent: allFiles };
  }

  // Strategy 2: exact credit code substring OR full credit name substring
  const creditNameLower = credit_name.toLowerCase();
  const match =
    allFiles.find((f) => f.includes(credit_code)) ??
    allFiles.find((f) => f.toLowerCase().includes(creditNameLower));

  if (match) {
    return { ...base, found: true, searchedDir, resolvedFile: path.join(searchedDir, match), filesPresent: allFiles };
  }

  return { ...base, found: false, searchedDir, resolvedFile: null, filesPresent: allFiles };
}

async function main() {
  console.log("\nLiminal — Reference PDF Coverage Check\n");

  const { data: credits, error } = await supabase
    .from("credits")
    .select("program, category, credit_code, credit_name, is_active")
    .order("program")
    .order("category")
    .order("credit_code");

  if (error) {
    console.error("Failed to fetch credits:", error.message);
    process.exit(1);
  }

  if (!credits || credits.length === 0) {
    console.log("No credits found in the database.");
    return;
  }

  const results = credits.map(checkCredit);
  const found   = results.filter((r) => r.found);
  const missing = results.filter((r) => !r.found);

  // ── FOUND ────────────────────────────────────────────────────────────────────
  console.log(`${"─".repeat(70)}`);
  console.log(`  FOUND (${found.length} of ${results.length})`);
  console.log(`${"─".repeat(70)}`);

  let lastProgram = "";
  for (const r of found) {
    if (r.program !== lastProgram) {
      console.log(`\n  ${r.program}`);
      lastProgram = r.program;
    }
    console.log(`  ✓  ${r.creditCode.padEnd(8)}  ${r.resolvedFile}`);
  }

  // ── MISSING ──────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  MISSING (${missing.length} of ${results.length})`);
  console.log(`${"─".repeat(70)}`);

  if (missing.length === 0) {
    console.log("\n  All PDFs are present. Ready to go live.\n");
  } else {
    lastProgram = "";
    for (const r of missing) {
      if (r.program !== lastProgram) {
        console.log(`\n  ${r.program}`);
        lastProgram = r.program;
      }
      console.log(`  ✗  ${r.creditCode.padEnd(8)}  ${r.creditName}`);
      console.log(`     Expected file : ${r.expectedName}`);
      console.log(`     In directory  : ${r.searchedDir}/`);
      if (r.filesPresent.length > 0) {
        console.log(`     Files present : ${r.filesPresent.join(", ")}`);
      } else {
        console.log(`     Files present : (directory empty or not found)`);
      }
    }
    console.log();
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  console.log(`${"─".repeat(70)}`);
  console.log(`  Total   : ${results.length}`);
  console.log(`  Found   : ${found.length}`);
  console.log(`  Missing : ${missing.length}`);
  console.log(`${"─".repeat(70)}\n`);

  if (missing.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
