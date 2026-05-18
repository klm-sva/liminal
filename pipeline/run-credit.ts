/**
 * pipeline/run-credit.ts
 *
 * Main entry point for AI credit submission packet generation.
 * Reads credit data from pipeline/credits/<slug>/ and writes
 * output to pipeline/output/.
 *
 * Usage:
 *   npx ts-node pipeline/run-credit.ts [customer-file-path]
 *
 * Each credit has its own folder under pipeline/credits/ containing:
 *   requirements.txt  — extracted text from the credit requirements PDF
 *   automation.json   — single row from the automation analysis XLSX
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { Packer } from "docx";
import { htmlToDocx } from "./lib/html-to-docx";
import { loadAutomationJson } from "./lib/extract-xlsx-row";
import { CREDIT_SUBMISSION_PROMPT } from "./prompts/credit-submission";

// ─── Load .env.local ───────────────────────────────────────────────────────────
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

// ─── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  model:      "claude-sonnet-4-6",
  maxTokens:  64000,
  creditSlug: "lt-access-to-quality-transit",
  formLinksXlsx: path.resolve(__dirname, "../pipeline") + "/credits/lt-access-to-quality-transit/form-links.txt",
  customerFile: process.argv[2] ?? null,
  outputDir:  path.resolve(__dirname, "output"),
};

const CREDIT_DIR = path.resolve(__dirname, `credits/${CONFIG.creditSlug}`);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function loadCreditRequirements(): string {
  const txt = path.join(CREDIT_DIR, "requirements.txt");
  if (!fs.existsSync(txt)) throw new Error(`requirements.txt not found: ${txt}`);
  return fs.readFileSync(txt, "utf-8");
}

function loadAutomationRow(): string {
  const json = path.join(CREDIT_DIR, "automation.json");
  return loadAutomationJson(json);
}

function loadFormLinks(): string {
  // Form links are stored in automation.json under "LEED Online Form Link"
  const json = path.join(CREDIT_DIR, "automation.json");
  if (!fs.existsSync(json)) return "";
  const data = JSON.parse(fs.readFileSync(json, "utf-8")) as Record<string, string>;
  const link = data["LEED Online Form Link"];
  return link ? `LEED Online Form URL: ${link}` : "";
}

function readCustomerFile(filePath: string): { type: "text"; text: string } {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    // Attempt text extraction via mdimport (macOS)
    try {
      const { extractPdfText } = require("./lib/extract-pdf");
      return { type: "text", text: extractPdfText(filePath) };
    } catch {
      throw new Error(`Customer PDF text extraction failed: ${filePath}. Convert to .txt and retry.`);
    }
  }
  return { type: "text", text: fs.readFileSync(filePath, "utf-8") };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in .env.local");

  const client = new Anthropic({ apiKey, timeout: 180000, maxRetries: 0 });

  console.log("=".repeat(60));
  console.log("Liminal — Credit Output Pipeline");
  console.log("=".repeat(60));
  console.log(`Credit:        ${CONFIG.creditSlug}`);
  console.log(`Model:         ${CONFIG.model}`);
  console.log(`Max tokens:    ${CONFIG.maxTokens} (uncapped — model decides)`);
  console.log(`Customer file: ${CONFIG.customerFile ?? "(none — using test project)"}`);
  console.log("-".repeat(60));

  // ── 1. Load credit data ────────────────────────────────────────────────────
  console.log("\n[1/4] Loading credit data...");

  const requirementsText = loadCreditRequirements();
  const automationText   = loadAutomationRow();
  const formLinksText    = loadFormLinks();

  console.log(`  ✓ requirements.txt   — ${Math.round(requirementsText.length / 4)} tokens`);
  console.log(`  ✓ automation.json    — ${Math.round(automationText.length / 4)} tokens`);
  console.log(`  ✓ form link          — ${formLinksText ? "found" : "not found"}`);

  // ── 2. Build content blocks ────────────────────────────────────────────────
  console.log("\n[2/4] Building API request...");

  type Block = { type: "text"; text: string };

  const sharedBlocks: Block[] = [
    { type: "text", text: `=== CREDIT REQUIREMENTS ===\n\n${requirementsText}\n\n=== END CREDIT REQUIREMENTS ===` },
    ...(formLinksText ? [{ type: "text" as const, text: formLinksText }] : []),
  ];

  const callABlocks: Block[] = [
    ...sharedBlocks,
    { type: "text", text: `=== AUTOMATION ANALYSIS (this credit only) ===\n\n${automationText}\n\n=== END AUTOMATION ANALYSIS ===` },
  ];

  if (CONFIG.customerFile) {
    const customerData = readCustomerFile(CONFIG.customerFile);
    const customerBlock: Block = {
      type: "text",
      text: `=== CUSTOMER-PROVIDED PROJECT INFORMATION ===\n\n${customerData.text}\n\n=== END CUSTOMER DATA ===`,
    };
    callABlocks.push(customerBlock);
    sharedBlocks.push(customerBlock);
  } else {
    const testInfo: Block = {
      type: "text",
      text: `=== PROJECT INFORMATION ===\nProject Address: 433 North Capitol Avenue, Indianapolis, IN 46204\nProgram: LEED v4.1 BD+C New Construction\nCredit: LT Access to Quality Transit\n=== END PROJECT INFORMATION ===`,
    };
    callABlocks.push(testInfo);
    sharedBlocks.push(testInfo);
  }

  console.log(`  ✓ Call A: ${callABlocks.length} blocks (includes automation row)`);
  console.log(`  ✓ Call B: ${sharedBlocks.length} blocks (no automation row)`);

  // ── 3. Two-pass API calls ──────────────────────────────────────────────────
  // Output length is uncapped — determined entirely by what the credit requires.
  const STREAM_TIMEOUT_MS = 10 * 60 * 1000;
  const runUsage = { inputTokens: 0, outputTokens: 0 };

  async function streamCall(label: string, userBlocks: Block[], systemOverride?: string): Promise<string> {
    const startMs = Date.now();
    console.log(`\n  [${label}] streaming...`);
    process.stdout.write("    ");
    let text = "";
    let deltas = 0;

    const s = client.messages.stream({
      model:      CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      system:     systemOverride ?? CREDIT_SUBMISSION_PROMPT,
      messages:   [{ role: "user", content: userBlocks }],
    });

    const timeout = setTimeout(() => {
      console.warn(`\n    ✗ ${label} timed out after ${STREAM_TIMEOUT_MS / 60000} min`);
      s.abort();
    }, STREAM_TIMEOUT_MS);

    try {
      for await (const chunk of s) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          text += chunk.delta.text;
          deltas++;
          if (deltas % 150 === 0) process.stdout.write(".");
        }
      }
      const final = await s.finalMessage();
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      runUsage.inputTokens  += final.usage.input_tokens;
      runUsage.outputTokens += final.usage.output_tokens;
      console.log(`\n    ✓ ${label} — ${elapsed}s — in: ${final.usage.input_tokens} | out: ${final.usage.output_tokens}`);
    } catch (err: any) {
      console.warn(`\n    ⚠ ${label} stream ended: ${err.message}`);
      if (!text.trim()) throw err;
      console.warn(`    Partial capture: ${Math.round(text.length / 1024)} KB`);
    } finally {
      clearTimeout(timeout);
    }
    return text;
  }

  console.log("\n[3/4] Calling Anthropic API (two-pass)...");

  const part1System = CREDIT_SUBMISSION_PROMPT + `

IMPORTANT — THIS CALL ONLY: Output ONLY Part 1 (Online Form). Start your response with <!DOCTYPE html> and produce a complete self-contained HTML document containing Part 1 only. End properly with </html>. Do NOT produce Part 2 yet.`;

  const part1Raw = await streamCall("Call A — Part 1 (Online Form)", callABlocks, part1System);

  const part2System = CREDIT_SUBMISSION_PROMPT + `

IMPORTANT — THIS CALL ONLY: Part 1 has been produced. Output ONLY Part 2 (Supporting Project Documentation) as a raw HTML fragment — no <!DOCTYPE>, no <html>, no <head>, no <body> tags. Start with a <section> or <div> tag. It will be stitched into the existing document.`;

  const callBBlocks: Block[] = [
    ...sharedBlocks,
    { type: "text", text: "Part 1 (Online Form) is complete. Now produce Part 2 (Supporting Project Documentation) as an HTML fragment only." },
  ];
  const part2Raw = await streamCall("Call B — Part 2 (Supporting Docs)", callBBlocks, part2System);

  // Stitch
  const bodyCloseIdx = part1Raw.lastIndexOf("</body>");
  const fullHtml = bodyCloseIdx !== -1
    ? part1Raw.slice(0, bodyCloseIdx) + "\n\n<!-- ═══ PART 2 ═══ -->\n" + part2Raw + "\n\n</body></html>"
    : part1Raw + "\n\n" + part2Raw;

  console.log(`\n  ✓ Stitched document: ${Math.round(fullHtml.length / 1024)} KB`);

  // ── 4. Write outputs ───────────────────────────────────────────────────────
  console.log("\n[4/4] Writing outputs to pipeline/output/...");

  fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  const slug    = CONFIG.creditSlug;
  const txtPath  = path.join(CONFIG.outputDir, `${slug}.txt`);
  const htmlPath = path.join(CONFIG.outputDir, `${slug}.html`);
  const docxPath = path.join(CONFIG.outputDir, `${slug}.docx`);

  fs.writeFileSync(txtPath,  fullHtml, "utf-8");
  fs.writeFileSync(htmlPath, fullHtml, "utf-8");
  console.log(`  ✓ ${slug}.txt  (${Math.round(fullHtml.length / 1024)} KB)`);
  console.log(`  ✓ ${slug}.html (${Math.round(fullHtml.length / 1024)} KB)`);

  try {
    const doc    = htmlToDocx(fullHtml);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(docxPath, buffer);
    console.log(`  ✓ ${slug}.docx (${Math.round(buffer.length / 1024)} KB)`);
  } catch (err) {
    console.warn(`  ⚠ docx failed: ${(err as Error).message}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const inputCost  = runUsage.inputTokens  * (3  / 1e6);
  const outputCost = runUsage.outputTokens * (15 / 1e6);

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  Input tokens:  ${runUsage.inputTokens.toLocaleString()}  → $${inputCost.toFixed(4)}`);
  console.log(`  Output tokens: ${runUsage.outputTokens.toLocaleString()}  → $${outputCost.toFixed(4)}`);
  console.log(`  Total cost:    $${(inputCost + outputCost).toFixed(4)}`);
  console.log(`  Output dir:    ${CONFIG.outputDir}`);
  console.log("=".repeat(60));
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message);
  if (err.status) console.error("  API status:", err.status);
  process.exit(1);
});
