import { execSync } from "child_process";
import * as fs from "fs";

/**
 * Extract plain text from a PDF using macOS Spotlight (mdimport).
 * Returns the text content, or throws if extraction fails.
 *
 * In production (server-side), credit requirements are pre-extracted and
 * stored as requirements.txt in pipeline/credits/<credit-slug>/.
 * This function is used when processing a live PDF (e.g. customer uploads).
 */
export function extractPdfText(filePath: string): string {
  if (!fs.existsSync(filePath)) throw new Error(`PDF not found: ${filePath}`);

  const result = execSync(
    `mdimport -t -d3 "${filePath.replace(/"/g, '\\"')}" 2>&1`,
    { maxBuffer: 10 * 1024 * 1024, timeout: 20000 }
  ).toString("utf-8");

  const marker = 'kMDItemTextContent = "';
  const start = result.indexOf(marker);
  if (start === -1) throw new Error(`kMDItemTextContent not found in mdimport output for: ${filePath}`);

  let end = start + marker.length;
  while (end < result.length) {
    if (result[end] === '"' && result[end - 1] !== "\\") break;
    end++;
  }

  const text = result
    .slice(start + marker.length, end)
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n");

  if (text.length < 100) throw new Error(`Extracted text too short (${text.length} chars) — PDF may be image-only`);
  return text;
}
