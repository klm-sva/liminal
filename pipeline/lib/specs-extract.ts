/**
 * pipeline/lib/specs-extract.ts
 *
 * Universal specification document pre-extractor.
 *
 * Runs ONCE per project when spec documents are uploaded. Produces a compact
 * specs-profile.json stored in Supabase Storage. All 60 credits read from
 * this stored profile — the full spec document is never re-processed per credit.
 *
 * Supported input formats: PDF, RTF, DOCX, TXT (and any plain-text variant).
 * Large PDFs are chunked automatically to stay within the 200K token context window.
 *
 * Storage path: {customer_id}/{project_id}/specs-profile.json
 */

import Anthropic     from "@anthropic-ai/sdk";
import * as fs       from "fs";
import * as path     from "path";
import * as os       from "os";
import { execSync }  from "child_process";
import { createServiceClient } from "./supabase";

const UPLOADS_BUCKET  = "customer-uploads";
const PROFILE_FILENAME = "specs-profile.json";

// Narrow extraction prompt — pulls only product/material data, ignores prose
const EXTRACTION_PROMPT = `You are extracting a compact product and material inventory from a construction specification document.

Extract ONLY the following for each permanently installed building product or material:
- Product name / description
- Manufacturer name (if specified)
- Model number or series (if specified)
- CSI Division and section number
- Material type or category (e.g. Concrete, Steel, Glazing, Acoustic Ceiling, Flooring, etc.)
- Any sustainability notes (recycled content, EPD available, LEED credit referenced, etc.)

IGNORE: administrative text, bid procedures, general conditions, substitution procedures, warranties, execution methods, testing procedures, and any prose that does not identify a specific product.

Return a JSON object with this exact structure:
{
  "products": [
    {
      "name": "product name",
      "manufacturer": "manufacturer or null",
      "model": "model/series or null",
      "csi_division": "e.g. 09 51 13",
      "material_type": "category",
      "sustainability_notes": "notes or null"
    }
  ],
  "summary": "2-3 sentence plain-text summary of the overall material palette and any notable sustainability specifications"
}

Return ONLY the JSON — no markdown, no explanation.`;

// ── Format converters ─────────────────────────────────────────────────────────

function convertToText(buffer: Buffer, filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const tmp = path.join(os.tmpdir(), `certify-specs-${Date.now()}${ext}`);

  try {
    fs.writeFileSync(tmp, buffer);

    if (ext === ".rtf") {
      return execSync(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
    }

    if (ext === ".docx" || ext === ".doc") {
      // Try textutil first (Mac), fall back to strings extraction
      try {
        return execSync(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      } catch {
        return execSync(`strings "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      }
    }

    if (ext === ".txt" || ext === ".text" || ext === ".md") {
      return buffer.toString("utf-8");
    }

    // Unknown text format — attempt UTF-8 read
    return buffer.toString("utf-8");
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// ── Single-chunk extraction (PDF document block or plain text) ────────────────

async function extractChunk(
  client:  Anthropic,
  content: Anthropic.ContentBlockParam[],
  usage:   { input: number; output: number },
): Promise<{ products: SpecProduct[]; summary: string }> {

  const response = await client.messages.create({
    model:       "claude-sonnet-4-6",
    max_tokens:  8000,
    temperature: 0,
    messages:    [{ role: "user", content }],
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
  if (start === -1 || end === -1) return { products: [], summary: "" };

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      products: (parsed.products ?? []) as SpecProduct[],
      summary:  (parsed.summary  ?? "") as string,
    };
  } catch {
    return { products: [], summary: "" };
  }
}

// ── PDF chunked extraction ────────────────────────────────────────────────────
// Splits large PDFs into page-range chunks to stay within the context window.

async function extractPdfChunked(
  client:    Anthropic,
  pdfBuffer: Buffer,
  filename:  string,
  usage:     { input: number; output: number },
): Promise<{ products: SpecProduct[]; summary: string }> {

  const allProducts: SpecProduct[] = [];
  const summaries:   string[]      = [];

  // Anthropic document blocks can handle large PDFs but are limited by context.
  // Send full PDF first; if it produces an empty result, fall back to pdfjs chunking.
  const pdfB64 = pdfBuffer.toString("base64");
  const content: Anthropic.ContentBlockParam[] = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } } as any,
    { type: "text", text: EXTRACTION_PROMPT },
  ];

  console.log(`  [specs-extract] Extracting from ${filename} (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB PDF)...`);
  const result = await extractChunk(client, content, usage);

  // If we got meaningful results, return them
  if (result.products.length > 0) {
    console.log(`  [specs-extract] ✓ ${result.products.length} products found`);
    return result;
  }

  // PDF too large or empty text layer — chunk by page ranges using pdfjs
  console.log(`  [specs-extract] PDF appears large or text-sparse — chunking by page range...`);
  return extractPdfByPageChunks(client, pdfBuffer, filename, usage);
}

async function extractPdfByPageChunks(
  client:    Anthropic,
  pdfBuffer: Buffer,
  filename:  string,
  usage:     { input: number; output: number },
): Promise<{ products: SpecProduct[]; summary: string }> {

  // eval('require') prevents webpack from statically analyzing these imports
  // at build time — they are resolved by Node.js at runtime from node_modules.
  const _req = eval('require') as NodeRequire; // eslint-disable-line no-eval
  const pdfjsLib = _req("pdfjs-dist/legacy/build/pdf.mjs") as typeof import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `file://${_req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;

  const data  = new Uint8Array(pdfBuffer);
  const pdf   = await pdfjsLib.getDocument({ data } as any).promise;
  const total = pdf.numPages;

  // Extract text page by page and batch into ~100-page chunks
  const CHUNK_PAGES = 100;
  const allProducts: SpecProduct[] = [];
  const summaries:   string[]      = [];

  for (let start = 1; start <= total; start += CHUNK_PAGES) {
    const end = Math.min(start + CHUNK_PAGES - 1, total);
    let chunkText = "";

    for (let p = start; p <= end; p++) {
      const page    = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text    = content.items.map((item: any) => item.str).join(" ");
      chunkText += `\n--- Page ${p} ---\n${text}`;
    }

    // Skip chunks that are mostly whitespace / no product content
    if (chunkText.replace(/\s/g, "").length < 500) continue;

    console.log(`  [specs-extract] Chunk pages ${start}–${end}...`);
    const content: Anthropic.ContentBlockParam[] = [
      { type: "text", text: `SPECIFICATION PAGES ${start}–${end} of ${total}:\n${chunkText.slice(0, 120000)}\n\n${EXTRACTION_PROMPT}` },
    ];

    const result = await extractChunk(client, content, usage);
    allProducts.push(...result.products);
    if (result.summary) summaries.push(result.summary);
  }

  return {
    products: deduplicateProducts(allProducts),
    summary:  summaries.join(" "),
  };
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateProducts(products: SpecProduct[]): SpecProduct[] {
  const seen = new Map<string, SpecProduct>();
  for (const p of products) {
    const key = `${p.csi_division}::${(p.name ?? "").toLowerCase()}::${(p.manufacturer ?? "").toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return Array.from(seen.values());
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface SpecProduct {
  name:                 string;
  manufacturer:         string | null;
  model:                string | null;
  csi_division:         string;
  material_type:        string;
  sustainability_notes: string | null;
}

export interface SpecsProfile {
  extracted_at:  string;
  source_files:  string[];
  product_count: number;
  products:      SpecProduct[];
  summary:       string;
  token_usage:   { input: number; output: number };
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * Extract product/material data from files — no Supabase dependency.
 * Use this in test scripts and anywhere Supabase isn't available.
 */
export async function extractSpecsContent(
  files:  Array<{ filename: string; buffer: Buffer; mimeType: string }>,
  client: Anthropic,
  usage:  { input: number; output: number },
): Promise<SpecsProfile> {

  const allProducts: SpecProduct[] = [];
  const summaries:   string[]      = [];
  const sourceFiles: string[]      = [];

  for (const file of files) {
    const ext = path.extname(file.filename).toLowerCase();
    sourceFiles.push(file.filename);

    if (file.mimeType === "application/pdf" || ext === ".pdf") {
      const result = await extractPdfChunked(client, file.buffer, file.filename, usage);
      allProducts.push(...result.products);
      if (result.summary) summaries.push(result.summary);

    } else {
      console.log(`  [specs-extract] Converting ${file.filename} (${ext}) to text...`);
      const text = convertToText(file.buffer, file.filename);

      const CHUNK_CHARS = 120_000;
      for (let offset = 0; offset < text.length; offset += CHUNK_CHARS) {
        const chunk   = text.slice(offset, offset + CHUNK_CHARS);
        const content: Anthropic.ContentBlockParam[] = [
          { type: "text", text: `SPECIFICATION TEXT (chars ${offset}–${offset + chunk.length}):\n${chunk}\n\n${EXTRACTION_PROMPT}` },
        ];
        const result = await extractChunk(client, content, usage);
        allProducts.push(...result.products);
        if (result.summary) summaries.push(result.summary);
      }
    }
  }

  const products = deduplicateProducts(allProducts);
  return {
    extracted_at:  new Date().toISOString(),
    source_files:  sourceFiles,
    product_count: products.length,
    products,
    summary:       summaries.join(" "),
    token_usage:   usage,
  };
}

/**
 * Extract product/material data from one or more spec documents.
 * Uploads specs-profile.json to Supabase and sets project.specs_extracted = true.
 * Use this in process-order.ts and the specs-analysis webhook.
 *
 * @param projectId  — Supabase projects.id
 * @param customerId — Supabase customers.id
 * @param files      — array of { filename, buffer, mimeType } from customer uploads
 */
export async function extractSpecs(
  projectId:  string,
  customerId: string,
  files:      Array<{ filename: string; buffer: Buffer; mimeType: string }>,
): Promise<SpecsProfile> {

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client   = new Anthropic({ apiKey });
  const supabase = createServiceClient();
  const usage    = { input: 0, output: 0 };

  const profile = await extractSpecsContent(files, client, usage);

  // Upload to Supabase Storage
  const storagePath = `${customerId}/${projectId}/${PROFILE_FILENAME}`;
  const { error: uploadError } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(storagePath, JSON.stringify(profile, null, 2), {
      contentType: "application/json",
      upsert:      true,
    });

  if (uploadError) throw new Error(`Failed to upload specs-profile.json: ${uploadError.message}`);

  // Mark project as specs_extracted
  const { error: updateError } = await supabase
    .from("projects")
    .update({ specs_extracted: true })
    .eq("id", projectId);

  if (updateError) console.warn(`[specs-extract] Could not set specs_extracted flag: ${updateError.message}`);

  console.log(`  [specs-extract] ✓ ${profile.product_count} products extracted from ${profile.source_files.length} file(s)`);
  console.log(`  [specs-extract]   in:${usage.input.toLocaleString()} out:${usage.output.toLocaleString()} tokens`);

  return profile;
}

/**
 * Load the stored specs profile for a project.
 * Returns null if not yet extracted.
 */
export async function loadSpecsProfile(
  customerId: string,
  projectId:  string,
): Promise<SpecsProfile | null> {

  const supabase    = createServiceClient();
  const storagePath = `${customerId}/${projectId}/${PROFILE_FILENAME}`;

  const { data, error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .download(storagePath);

  if (error || !data) return null;

  try {
    return JSON.parse(await data.text()) as SpecsProfile;
  } catch {
    return null;
  }
}

/**
 * Format a SpecsProfile as a compact plain-text block for injection
 * into the shared credit context. Keeps token count low.
 */
export function formatSpecsProfileForContext(profile: SpecsProfile): string {
  const lines = [
    `SPECS PROFILE — ${profile.product_count} products from: ${profile.source_files.join(", ")}`,
    profile.summary ? `Summary: ${profile.summary}` : "",
    "",
    "Product / Material Inventory:",
  ];

  for (const p of profile.products) {
    const parts = [
      p.csi_division,
      p.material_type,
      p.name,
      p.manufacturer ? `(${p.manufacturer}${p.model ? ` ${p.model}` : ""})` : "",
      p.sustainability_notes ? `[${p.sustainability_notes}]` : "",
    ].filter(Boolean);
    lines.push(`  • ${parts.join(" — ")}`);
  }

  return lines.filter(l => l !== undefined).join("\n");
}
