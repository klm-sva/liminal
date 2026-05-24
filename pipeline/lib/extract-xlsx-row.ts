import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const AUTOMATION_XLSX = path.join(process.cwd(), "pipeline/reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx");

// ─── Column indices in the automation analysis spreadsheet ────────────────────
// Row 1 (index 1) is the header row. Data rows start at index 2.
const COL = {
  creditNumber:       0,
  creditName:         1,
  ptsAvailable:       2,
  ptsAuto:            3,
  automatable:        4,
  docTier:            5,
  allDocuments:       6,   // full combined list
  customerUploads:    7,   // Column 1: Project Team Must Upload
  claudeRetrieves:    8,   // Column 2: Claude Auto-Retrieves
  claudeOutputs:      9,   // Column 4: Outputs Generated
  gbciVerification:   10,
  blockerNotes:       11,
  formLink:           12,  // Column 3 partial: LEED Online Form Link
  calculatorInfo:     13,  // Column 3 partial: Calculator / Worksheet
};

export interface CreditData {
  creditNumber:     string;
  creditName:       string;
  ptsAvailable:     string;
  automatable:      string;
  docTier:          string;
  // The four pipeline-driving columns
  customerUploads:  string[];   // Column 1: what project team provides
  claudeRetrieves:  string[];   // Column 2: what Claude fetches automatically
  platformFiles:    PlatformFiles; // Column 3: what comes from Supabase Storage
  outputs:          string[];   // Column 4: what gets generated
  // Additional metadata
  gbciVerification: string;
  blockerNotes:     string;
}

export interface PlatformFiles {
  formLink:       string | null;
  calculatorInfo: string | null;
  // requirements.txt and other credit-specific files are resolved by credit_code
}

function parseList(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  // Split on semicolons or newlines, trim each item, filter blanks
  return raw
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadWorkbook(): { rows: any[][]; headers: string[] } {
  if (!fs.existsSync(AUTOMATION_XLSX)) {
    throw new Error(`Automation analysis XLSX not found: ${AUTOMATION_XLSX}`);
  }
  const workbook = XLSX.readFile(AUTOMATION_XLSX);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const headers = (rows[1] as string[]).map((h) => String(h ?? "").replace(/\n/g, " ").trim());
  return { rows, headers };
}

/**
 * Extract all four pipeline-driving data columns for a specific credit.
 * This is the single source of truth for the pipeline — called at runtime,
 * never hardcoded.
 */
export function extractCreditData(creditName: string): CreditData {
  const { rows } = loadWorkbook();
  const needle = creditName.toLowerCase();

  const dataRow = rows.slice(2).find((row) => {
    const name = String(row[COL.creditName] ?? "").toLowerCase();
    const num  = String(row[COL.creditNumber] ?? "").toLowerCase();
    return name.includes(needle) || num.includes(needle);
  });

  if (!dataRow) {
    throw new Error(`Credit "${creditName}" not found in automation analysis spreadsheet`);
  }

  const get = (col: number) => String(dataRow[col] ?? "").trim();

  return {
    creditNumber:    get(COL.creditNumber),
    creditName:      get(COL.creditName),
    ptsAvailable:    get(COL.ptsAvailable),
    automatable:     get(COL.automatable),
    docTier:         get(COL.docTier),
    customerUploads: parseList(get(COL.customerUploads)),
    claudeRetrieves: parseList(get(COL.claudeRetrieves)),
    platformFiles: {
      formLink:       get(COL.formLink)       || null,
      calculatorInfo: get(COL.calculatorInfo) || null,
    },
    outputs:          parseList(get(COL.claudeOutputs)),
    gbciVerification: get(COL.gbciVerification),
    blockerNotes:     get(COL.blockerNotes),
  };
}

/**
 * Format a CreditData record as a prompt-ready text block.
 * Used when injecting credit metadata into the API call.
 */
export function formatCreditDataForPrompt(data: CreditData): string {
  const lines: string[] = [
    `Credit: ${data.creditNumber} — ${data.creditName}`,
    `Automatable: ${data.automatable} | Tier: ${data.docTier}`,
    "",
    "DOCUMENTS TO COLLECT FROM PROJECT TEAM:",
    ...data.customerUploads.map((d) => `  - ${d}`),
    "",
    "DOCUMENTS CLAUDE RETRIEVES AUTOMATICALLY:",
    ...data.claudeRetrieves.map((d) => `  - ${d}`),
    "",
    "OUTPUTS TO GENERATE FOR THIS CREDIT:",
    ...data.outputs.map((o) => `  - ${o}`),
    "",
    `LEED Online Form: ${data.platformFiles.formLink ?? "N/A"}`,
    ...(data.platformFiles.calculatorInfo ? [`Calculator: ${data.platformFiles.calculatorInfo}`] : []),
    ...(data.blockerNotes ? [`Notes: ${data.blockerNotes}`] : []),
  ];
  return lines.join("\n");
}

/**
 * Load a pre-saved automation.json (from pipeline/credits/<slug>/) as CreditData.
 * Used by run-credit.ts for local testing without hitting the XLSX at runtime.
 */
export function loadAutomationJson(jsonPath: string): string {
  if (!fs.existsSync(jsonPath)) throw new Error(`automation.json not found: ${jsonPath}`);
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<string, string>;
  const lines = [`Credit Automation Analysis — ${raw["Credit Number"]}: ${raw["Credit Name"]}`];
  for (const [key, val] of Object.entries(raw)) {
    if (key !== "Credit Number" && key !== "Credit Name" && val) {
      lines.push(`  ${key.trim()}: ${val.trim()}`);
    }
  }
  return lines.join("\n");
}

/**
 * Extract the single row for a named credit from the automation analysis XLSX.
 * Returns a formatted text block. Used by run-credit.ts directly.
 */
export function extractXlsxCreditRow(filePath: string, creditName: string): string {
  if (!fs.existsSync(filePath)) throw new Error(`XLSX not found: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const headers: string[] = (rows[1] as string[]) ?? [];
  const needle = creditName.toLowerCase();
  const dataRow = rows.slice(2).find((row) => {
    const name = String(row[1] ?? "").toLowerCase();
    const num  = String(row[0] ?? "").toLowerCase();
    return name.includes(needle) || num.includes(needle);
  });
  if (!dataRow) throw new Error(`Credit "${creditName}" not found in ${filePath}`);
  const lines: string[] = [`Credit Automation Analysis — ${dataRow[0]}: ${dataRow[1]}`];
  for (let i = 2; i < headers.length; i++) {
    const val = dataRow[i];
    if (val !== undefined && val !== "") {
      lines.push(`  ${String(headers[i]).replace(/\n/g, " ").trim()}: ${String(val).replace(/\n/g, " ").trim()}`);
    }
  }
  return lines.join("\n");
}
