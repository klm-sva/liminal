/**
 * pipeline/lib/pdf-extract.ts
 *
 * Pre-extracts relevant content from PDF files before main Claude passes.
 *
 * Two render modes:
 *   "document"    — sends the PDF as a document block (text extraction layer).
 *                   Fast and cheap. Good for text-heavy docs (credit guides, reports).
 *   "tiled-image" — renders each page at 200 DPI, slices into a 2×2 grid of JPEG tiles
 *                   (each up to 2500px on the longest side), and sends as image blocks.
 *                   Required for architectural/civil drawings where critical data is
 *                   graphical (room numbers, fixture symbols, rack callouts, annotations).
 *
 * Results are cached in memory — repeated calls with the same path, prompt, and mode
 * return instantly at zero additional API cost.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const _cache = new Map<string, string>();

export interface PdfExtractResult {
  text:         string;
  inputTokens:  number;
  outputTokens: number;
  elapsedMs:    number;
  cacheHit:     boolean;
}

// ─── Tile renderer ────────────────────────────────────────────────────────────

export interface PdfTile {
  buffer: Buffer;
  label:  string;
}

/**
 * Renders a PDF buffer to a 2×2 grid of JPEG tiles at 200 DPI.
 * Each tile is resized to at most 2500px on its longest side to stay under the
 * Anthropic 5 MB image limit while preserving enough resolution to read fine
 * drawing annotations, room numbers, and fixture symbols.
 *
 * Exported so drawing-analysis.ts can use it directly for multi-drawing calls.
 */
export async function renderPdfToTiles(
  pdfBuffer:   Buffer,
  cols         = 2,
  rows         = 2,
  dpi          = 200,
  tileMaxSide  = 2500,
): Promise<PdfTile[]> {
  // eval('require') prevents webpack from statically analyzing these imports
  // at build time — they are resolved by Node.js at runtime from node_modules.
  const _req = eval('require') as NodeRequire; // eslint-disable-line no-eval
  const pdfjsLib     = _req("pdfjs-dist/legacy/build/pdf.mjs") as typeof import("pdfjs-dist");
  const { createCanvas } = _req("@napi-rs/canvas") as typeof import("@napi-rs/canvas");
  const sharp = (await import("sharp")).default;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `file://${_req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;

  const data  = new Uint8Array(pdfBuffer);
  const pdf   = await pdfjsLib.getDocument({ data } as any).promise;
  const scale = dpi / 72;

  const tiles: PdfTile[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const width    = Math.round(viewport.width);
    const height   = Math.round(viewport.height);

    const canvas = createCanvas(width, height);
    const ctx    = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;
    const fullPng = canvas.toBuffer("image/png");

    const tileW = Math.ceil(width  / cols);
    const tileH = Math.ceil(height / rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = c * tileW;
        const top  = r * tileH;
        const tw   = Math.min(tileW, width  - left);
        const th   = Math.min(tileH, height - top);

        const longest    = Math.max(tw, th);
        const resizeOpts = longest > tileMaxSide
          ? (tw >= th ? { width: tileMaxSide } : { height: tileMaxSide })
          : {};

        const jpegBuf = await sharp(fullPng)
          .extract({ left, top, width: tw, height: th })
          .resize(resizeOpts)
          .jpeg({ quality: 92 })
          .toBuffer();

        const quadrant = (["top-left", "top-right", "bottom-left", "bottom-right"] as const)[r * cols + c]
          ?? `r${r}c${c}`;
        tiles.push({ buffer: jpegBuf, label: `Page ${pageNum}, tile ${r * cols + c + 1}/${rows * cols} (${quadrant})` });
      }
    }
  }

  return tiles;
}

// ─── Shared extraction logic ──────────────────────────────────────────────────

async function _extract(
  client:           Anthropic,
  pdfBuffer:        Buffer,
  filename:         string,
  extractionPrompt: string,
  renderMode:       "document" | "tiled-image",
  cacheKey:         string,
): Promise<PdfExtractResult> {
  const t0 = Date.now();

  let content: Anthropic.ContentBlockParam[];

  if (renderMode === "tiled-image") {
    console.log(`  [pdf-extract] Rendering tiles: ${filename}...`);
    const tiles = await renderPdfToTiles(pdfBuffer);
    console.log(`  [pdf-extract] ${tiles.length} tiles ready — sending to Claude`);
    content = [
      ...tiles.map((tile) => ({
        type:   "image" as const,
        source: {
          type:       "base64"     as const,
          media_type: "image/jpeg" as const,
          data:       tile.buffer.toString("base64"),
        },
      })),
      {
        type: "text" as const,
        text: `The above ${tiles.length} images are tiles from the same drawing sheet, ` +
              `arranged in a 2-column × 2-row grid (left-to-right, top-to-bottom). ` +
              `Together they form the complete sheet at higher resolution than a single image allows.\n\n` +
              extractionPrompt,
      },
    ];
  } else {
    const pdfB64 = pdfBuffer.toString("base64");
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } } as any,
      { type: "text", text: extractionPrompt },
    ];
  }

  const response = await client.messages.create({
    model:       "claude-sonnet-4-6",
    max_tokens:  8000,
    temperature: 0,
    messages:    [{ role: "user", content }],
  });

  const text      = response.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("");
  const elapsedMs = Date.now() - t0;

  console.log(
    `  [pdf-extract] ✓ ${filename} [${renderMode}] — ${(elapsedMs / 1000).toFixed(1)}s` +
    `  in:${response.usage.input_tokens.toLocaleString()} out:${response.usage.output_tokens.toLocaleString()}`
  );

  _cache.set(cacheKey, text);
  return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, elapsedMs, cacheHit: false };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract content from a PDF file.
 * Pass renderMode: "tiled-image" for architectural/civil drawings.
 * Pass renderMode: "document" (default) for text-heavy PDFs (credit guides, reports).
 */
export async function extractPdfContent(
  client:           Anthropic,
  pdfPath:          string,
  extractionPrompt: string,
  renderMode:       "document" | "tiled-image" = "document",
): Promise<PdfExtractResult> {
  const cacheKey = `${pdfPath}::${renderMode}::${extractionPrompt}`;

  if (_cache.has(cacheKey)) {
    console.log(`  [pdf-extract] Cache hit: ${path.basename(pdfPath)}`);
    return { text: _cache.get(cacheKey)!, inputTokens: 0, outputTokens: 0, elapsedMs: 0, cacheHit: true };
  }

  console.log(`  [pdf-extract] Extracting from ${path.basename(pdfPath)} [${renderMode}]...`);
  const pdfBuffer = fs.readFileSync(pdfPath);
  return _extract(client, pdfBuffer, path.basename(pdfPath), extractionPrompt, renderMode, cacheKey);
}

/**
 * Buffer-based variant — accepts a Buffer directly.
 * Use in process-order.ts and other contexts where files are already in memory.
 * Pass renderMode: "tiled-image" for architectural/civil drawings.
 */
export async function extractPdfContentFromBuffer(
  client:           Anthropic,
  pdfBuffer:        Buffer,
  filename:         string,
  extractionPrompt: string,
  renderMode:       "document" | "tiled-image" = "document",
): Promise<PdfExtractResult> {
  const cacheKey = `buffer::${filename}::${pdfBuffer.length}::${renderMode}::${extractionPrompt}`;

  if (_cache.has(cacheKey)) {
    console.log(`  [pdf-extract] Cache hit: ${filename}`);
    return { text: _cache.get(cacheKey)!, inputTokens: 0, outputTokens: 0, elapsedMs: 0, cacheHit: true };
  }

  console.log(`  [pdf-extract] Extracting from ${filename} [${renderMode}]...`);
  return _extract(client, pdfBuffer, filename, extractionPrompt, renderMode, cacheKey);
}

// ─── Standard extraction prompts ─────────────────────────────────────────────

export const EXTRACT_PROMPTS = {

  CIVIL_DRAWING: `Extract all of the following from this civil drawing set:
- Project name
- Project address (full street address, city, state, zip)
- Owner / developer name (if shown)
- Project description / building type
- Site area (total lot area in sq ft and/or acres)
- Development footprint area (building footprint + impervious area if shown)
- Site boundary description
- Any noted land features: wetlands, floodplain notes, water bodies, detention/retention areas, easements
- Zoning designation (if noted)
- Any environmental or permitting notes
- Benchmark / datum and coordinate system if shown
- Any slope or grading notes relevant to sensitive land classification
Output as structured plain text. Be thorough — include every data point visible.`,

  CREDIT_REQUIREMENTS: `Extract all of the following from this LEED credit guide:
- Credit name and number
- Points available
- All compliance options with their full thresholds and requirements
- All items that must be documented or calculated
- All items listed as required uploads or submittals
- Items that can be retrieved from public databases (FEMA, NWI, Census, etc.)
- Items that require owner input or site-specific data
- All LEED Online form fields described or referenced
- Any definitions or special terms
Output as structured plain text. Be complete — every requirement matters.`,

  GEOTECHNICAL_REPORT: `Extract all of the following from this geotechnical report:
- Project name and address
- Report date and author
- Soil classifications (USCS or ASTM) for each boring or test pit
- Prime farmland soil types identified (if any)
- Groundwater depth observations
- Any notes on wetlands, fill, or sensitive soil conditions
- Bearing capacity values
- Any environmental observations
Output as structured plain text.`,

};
