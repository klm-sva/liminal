/**
 * pipeline/lib/calculator.ts
 *
 * Universal LEED calculator generation.
 *
 * Flow:
 *   1. Find the right template file by matching the credit against the schema
 *   2. Make one Claude call to extract structured data_json from project HTML/drawings
 *   3. Call populate_calculator.py via Python child process
 *   4. Return CalculatorResult
 *
 * populate_calculator.py handles all Excel writing — no cell references here.
 * All calculator knowledge lives in leed_v41_calculator_schemas.json.
 */

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";

const CALCULATORS_DIR = path.resolve(__dirname, "../calculators");
const SCHEMA_PATH     = path.resolve(__dirname, "../reference/leed/leed_v41_calculator_schemas.json");
const PY_SCRIPT       = path.resolve(__dirname, "populate_calculator.py");

export interface CalculatorResult {
  outputPath:   string;
  calcName:     string;
  cellsWritten: number;
  skipped:      boolean;
  skipReason?:  string;
}

interface CalcSchema {
  id:       string;
  name:     string;
  credits:  string[];
  tabs:     string[];
  [key: string]: unknown;
}

// ── Schema resolution ─────────────────────────────────────────────────────────

function cc(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function loadAllSchemas(): Record<string, CalcSchema> {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8")).calculators ?? {};
}

function findSchemaForCredit(creditName: string): CalcSchema | null {
  const schemas  = loadAllSchemas();
  const nameNorm = cc(creditName);

  // Pass 1 — strict: credit code from schema.credits must appear in the credit name.
  // e.g. "eqprereq1minimumindoorairqualityperformance" contains "eqprereq1"
  // This is the authoritative match and must run before any fuzzy fallbacks.
  for (const schema of Object.values(schemas)) {
    if (schema.credits.some((c) => nameNorm.includes(cc(c)))) return schema;
  }

  // Pass 2 — fallback: schema id or name keywords appear in the credit name.
  // Only reached when no schema has a matching credit code.
  for (const schema of Object.values(schemas)) {
    if (nameNorm.includes(cc(schema.id))) return schema;
    const schemaWords = schema.name.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
    if (schemaWords.some((w) => nameNorm.includes(w))) return schema;
  }

  return null;
}

// ── Template file resolution ───────────────────────────────────────────────────
// Keywords are derived from the schema (id + name words) — nothing hardcoded here.

function findTemplateFile(schema: CalcSchema): string | null {
  if (!fs.existsSync(CALCULATORS_DIR)) return null;

  const files = fs.readdirSync(CALCULATORS_DIR).filter((f) =>
    /\.(xlsx|xlsm|xls)$/i.test(f)
  );
  if (files.length === 0) return null;

  // Derive keyword candidates from schema id and name
  const keywords = [
    schema.id,
    ...schema.name.toLowerCase().split(/\W+/).filter((w) => w.length > 3),
    ...schema.credits.flatMap((c) => c.toLowerCase().split(/\W+/).filter((w) => w.length > 2)),
  ].filter(Boolean);

  for (const file of files) {
    const fl = file.toLowerCase();
    if (keywords.some((kw) => fl.includes(kw))) {
      return path.join(CALCULATORS_DIR, file);
    }
  }
  return null;
}

// ── Data extraction (Claude call) ─────────────────────────────────────────────
// Produces structured data_json that populate_calculator.py writes to Excel.

async function extractDataJson(
  client:      Anthropic,
  schema:      CalcSchema,
  projectData: string,
  usage:       { input: number; output: number },
): Promise<Record<string, unknown>> {

  // Primary input tabs (skip Instructions / Summary / Lookups / Reference)
  const skipTabs   = new Set(["instructions", "lookups", "reference", "summary"]);
  const inputTabs  = schema.tabs.filter((t) => !skipTabs.has(t.toLowerCase()));

  // Collect all input field lists from the schema for context
  const fieldContext = Object.entries(schema)
    .filter(([k, v]) => k.toLowerCase().includes("input") && Array.isArray(v))
    .map(([k, v]) => `${k}:\n${(v as string[]).map((f) => `  - ${f}`).join("\n")}`)
    .join("\n\n");

  const prompt = `You are extracting structured calculator inputs for the LEED ${schema.name}.

CALCULATOR SCHEMA — input fields this calculator requires:
${fieldContext}

PRIMARY INPUT TABS:
${inputTabs.join(", ")}

PROJECT SOURCE DATA:
${projectData.slice(0, 50000)}

Return ONLY a valid JSON object (no markdown, no explanation) with this structure:

{
  "project": {
    "<field label>": "<value>"
  },
  "tabs": {
    "<exact tab name>": {
      "static_fields": {
        "<field label matching schema>": <value>
      },
      "rows": [
        { "<column header>": <value> }
      ]
    }
  }
}

For tabs with multiple repeating systems (each system has header info PLUS its own rows):
  Use "systems" instead of "rows":
  "<tab name>": {
    "systems": [
      {
        "static_fields": { "<system-level field>": <value> },
        "rows": [ { "<row field>": <value> } ]
      }
    ]
  }

Rules:
- Use field labels that closely match the schema's input field descriptions
- Include EVERY zone / fixture / material / space / event found in the source data
- Numbers without quotes; strings in quotes; omit null values
- Focus on the primary input tabs listed above — skip Instructions, Summary, Lookups
- Do NOT include calculated or formula fields — those auto-calculate in Excel
- Match tab names exactly as listed in PRIMARY INPUT TABS
- For OCCUPANCY CATEGORY fields: you MUST use the exact string from the validOccupancyCategoryInputs list above (including trailing spaces). The Excel VLOOKUP will fail silently if the string does not match exactly. Pick the closest matching category — for example: a gym/exercise area → "Health club / aerobics", a multi-purpose room → "Multi-purpose assembly ", a lobby → "Main entry lobbies " or "Lobbies ", an office → "Office space ", a conference room → "Conference / meeting "
- For ZONE NAME fields: use the actual zone/room name from the mechanical drawings`;

  const response = await client.messages.create({
    model:       "claude-sonnet-4-6",
    max_tokens:  8000,
    temperature: 0,
    messages:    [{ role: "user", content: prompt }],
  });

  usage.input  += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;

  const text  = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Calculator data extraction: Claude did not return valid JSON");
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(`Calculator data extraction: JSON parse failed — ${text.slice(start, start + 200)}`);
  }
}

// ── Python subprocess ─────────────────────────────────────────────────────────

function runPythonPopulator(
  templatePath: string,
  creditCode:   string,
  dataJson:     Record<string, unknown>,
  outputPath:   string,
): { cellsWritten: number; calcName: string; warnings: string[] } {

  // Write data_json to a temp file (avoids shell arg-length limits)
  const tmpJson = outputPath.replace(/\.\w+$/, "-calc-data.json");
  fs.writeFileSync(tmpJson, JSON.stringify(dataJson, null, 2));

  const proc = spawnSync("python3", [PY_SCRIPT, templatePath, creditCode, tmpJson, outputPath], {
    encoding: "utf-8",
    timeout:  120_000,
  });

  // Clean up temp json
  try { fs.unlinkSync(tmpJson); } catch { /* ignore */ }

  if (proc.error) {
    throw new Error(`Python process error: ${proc.error.message}`);
  }
  if (proc.status !== 0) {
    const stderr = proc.stderr?.slice(0, 800) ?? "";
    throw new Error(`populate_calculator.py failed (exit ${proc.status}): ${stderr}`);
  }

  const stdout = (proc.stdout ?? "").trim();
  if (!stdout) {
    throw new Error("populate_calculator.py produced no output");
  }

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(stdout);
  } catch {
    throw new Error(`populate_calculator.py returned non-JSON: ${stdout.slice(0, 200)}`);
  }

  if (result.error) {
    throw new Error(`populate_calculator.py error: ${result.error}`);
  }

  return {
    cellsWritten: (result.cells_written as number) ?? 0,
    calcName:     (result.calc_name    as string)  ?? "",
    warnings:     (result.warnings     as string[]) ?? [],
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateCalculator(
  client:      Anthropic,
  creditRow:   string,
  creditName:  string,
  projectData: string,
  outputDir:   string,
  slug:        string,
  usage:       { input: number; output: number },
): Promise<CalculatorResult | null> {

  // If the automation analysis row doesn't mention a calculator, skip
  if (!creditRow.toLowerCase().includes("calculator")) {
    return null;
  }

  // Find schema by matching credit name against the schema registry
  const schema = findSchemaForCredit(creditName);
  if (!schema) {
    const reason = `No calculator schema matched: credit="${creditName}", row prefix="${creditRow.slice(0, 40)}"`;
    console.warn(`  [calculator] ⚠ ${reason}`);
    return { outputPath: "", calcName: creditName, cellsWritten: 0, skipped: true, skipReason: reason };
  }

  console.log(`\n  [calculator] Calculator required for ${creditName}`);
  console.log(`  [calculator] Schema: ${schema.name} (${schema.id})`);

  // Find template file
  const templatePath = findTemplateFile(schema);
  if (!templatePath) {
    const reason = `No template file found in calculators/ for schema "${schema.name}"`;
    console.warn(`  [calculator] ⚠ ${reason}`);
    return { outputPath: "", calcName: schema.name, cellsWritten: 0, skipped: true, skipReason: reason };
  }

  console.log(`  [calculator] Template: ${path.basename(templatePath)}`);

  // Always output .xlsx — strips VBA macros that would otherwise clear inputs on open.
  const outputPath = path.join(outputDir, `${slug}-calculator.xlsx`);

  // Claude call: extract structured data_json from project HTML/drawings
  console.log(`  [calculator] Extracting calculator inputs from project data...`);
  const dataJson = await extractDataJson(client, schema, projectData, usage);

  // Python: write data_json into the template
  console.log(`  [calculator] Populating template via Python/openpyxl...`);
  const { cellsWritten, calcName, warnings } = runPythonPopulator(
    templatePath,
    schema.id,
    dataJson,
    outputPath,
  );

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`  [calculator] warn: ${w}`));
  }

  console.log(`  [calculator] ✓ Completed: ${cellsWritten} cells written → ${path.basename(outputPath)}`);

  return {
    outputPath,
    calcName: calcName || schema.name,
    cellsWritten,
    skipped: false,
  };
}

// ── Checklist HTML helper ─────────────────────────────────────────────────────

export function calculatorChecklistHtml(result: CalculatorResult): string {
  if (result.skipped) {
    return `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:12px;margin:8px 0;">
      <strong style="color:#856404;">⚠ Calculator — Manual Step Required</strong><br/>
      <span style="font-size:12px;color:#6b7e82;">
        ${result.calcName} must be downloaded from the USGBC website and completed manually.<br/>
        Reason: ${result.skipReason}
      </span>
    </div>`;
  }
  return `<div style="background:#d4edda;border:1px solid #c3e6cb;border-radius:4px;padding:12px;margin:8px 0;">
    <strong style="color:#155724;">✓ Calculator Provided — ${result.calcName}</strong><br/>
    <span style="font-size:12px;color:#6b7e82;">
      Completed Excel file: <strong>${path.basename(result.outputPath)}</strong>
      (${result.cellsWritten} input cells filled).<br/>
      Open in Excel to verify formulas recalculate correctly before submitting.
    </span>
  </div>`;
}
