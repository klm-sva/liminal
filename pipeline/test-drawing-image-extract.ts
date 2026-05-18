/**
 * pipeline/test-drawing-image-extract.ts
 *
 * STANDALONE TEST — does not modify any base code.
 *
 * Tests whether rendering PDF pages as high-res images and sending them
 * as vision (image) blocks to Claude produces better results than the
 * current document-block approach for architectural drawings.
 *
 * Compares both approaches side-by-side on Civil006.pdf and Rinker_009.pdf.
 *
 * Run: npx ts-node pipeline/test-drawing-image-extract.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";

// ─── Env ──────────────────────────────────────────────────────────────────────

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

const DESKTOP    = "/Users/kelsey/Desktop/program automation ";
const CIVIL_PATH = path.join(DESKTOP, "example drawing set/Civil006.pdf");
const ARCH_PATH  = path.join(DESKTOP, "example drawing set/Rinker_009.pdf");

// ─── PDF → PNG pages using pdfjs-dist + @napi-rs/canvas ──────────────────────

async function pdfToImages(pdfPath: string, dpi = 150): Promise<Buffer[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib    = require("pdfjs-dist/legacy/build/pdf.mjs") as typeof import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require("@napi-rs/canvas") as typeof import("@napi-rs/canvas");
  const sharp = (await import("sharp")).default;

  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;

  const data     = new Uint8Array(fs.readFileSync(pdfPath));
  const loadTask = pdfjsLib.getDocument({ data } as any);
  const pdf      = await loadTask.promise;
  const scale    = dpi / 72; // PDF points are 72 per inch

  console.log(`  [pdf→img] ${path.basename(pdfPath)}: ${pdf.numPages} page(s) at ${dpi} DPI (scale ${scale.toFixed(2)}x)`);

  const MAX_LONGEST_SIDE = 2500; // Higher res for fine detail (showers, rack symbols, annotations)
  const pages: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const width    = Math.round(viewport.width);
    const height   = Math.round(viewport.height);

    const canvas  = createCanvas(width, height);
    const ctx     = canvas.getContext("2d");

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    await page.render({
      canvasContext: ctx as any,
      viewport,
      canvas: canvas as any,
    }).promise;

    // Resize to max 1568px on longest side, convert to JPEG to stay under API 5 MB limit
    const rawPng = canvas.toBuffer("image/png");
    const longestSide = Math.max(width, height);
    const resizeOpts = longestSide > MAX_LONGEST_SIDE
      ? (width >= height ? { width: MAX_LONGEST_SIDE } : { height: MAX_LONGEST_SIDE })
      : {};

    const jpegBuffer = await sharp(rawPng)
      .resize(resizeOpts)
      .jpeg({ quality: 92 })
      .toBuffer();

    pages.push(jpegBuffer);
    const meta = await sharp(jpegBuffer).metadata();
    console.log(`    Page ${pageNum}: ${width}×${height}px → resized to ${meta.width}×${meta.height} → ${Math.round(jpegBuffer.length / 1024)} KB JPEG`);
  }

  return pages;
}

// ─── PDF → tiled PNG quadrants ───────────────────────────────────────────────
// Renders each page at high DPI, then slices into a grid of tiles.
// Each tile is sent as a separate image block so Claude reads fine detail
// (room numbers, fixture symbols, annotations) that a full-page resize loses.

interface Tile {
  buffer:  Buffer;
  label:   string; // e.g. "Page 1, tile 1/4 (top-left)"
  widthPx: number;
  heightPx: number;
}

async function pdfToTiles(
  pdfPath: string,
  cols    = 2,
  rows    = 2,
  dpi     = 200,
  tileMaxSide = 2500,
): Promise<Tile[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib      = require("pdfjs-dist/legacy/build/pdf.mjs") as typeof import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require("@napi-rs/canvas") as typeof import("@napi-rs/canvas");
  const sharp = (await import("sharp")).default;

  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;

  const data     = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf      = await pdfjsLib.getDocument({ data } as any).promise;
  const scale    = dpi / 72;

  console.log(`  [pdf→tiles] ${path.basename(pdfPath)}: ${pdf.numPages} page(s), ${cols}×${rows} grid @ ${dpi} DPI`);

  const tiles: Tile[] = [];

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

    console.log(`    Page ${pageNum}: full render ${width}×${height}px`);

    const tileW = Math.ceil(width  / cols);
    const tileH = Math.ceil(height / rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = c * tileW;
        const top  = r * tileH;
        const tw   = Math.min(tileW, width  - left);
        const th   = Math.min(tileH, height - top);

        const longestSide = Math.max(tw, th);
        const resizeOpts  = longestSide > tileMaxSide
          ? (tw >= th ? { width: tileMaxSide } : { height: tileMaxSide })
          : {};

        const jpegBuf = await sharp(fullPng)
          .extract({ left, top, width: tw, height: th })
          .resize(resizeOpts)
          .jpeg({ quality: 92 })
          .toBuffer();

        const meta = await sharp(jpegBuf).metadata();
        const quadrant = ["top-left", "top-right", "bottom-left", "bottom-right"][r * cols + c] ?? `r${r}c${c}`;
        const label = `Page ${pageNum}, tile ${r * cols + c + 1}/${rows * cols} (${quadrant})`;
        console.log(`      Tile ${r * cols + c + 1}: ${tw}×${th}px → ${meta.width}×${meta.height} → ${Math.round(jpegBuf.length / 1024)} KB JPEG`);

        tiles.push({ buffer: jpegBuf, label, widthPx: meta.width!, heightPx: meta.height! });
      }
    }
  }

  return tiles;
}

// ─── Approach A: current document-block method ───────────────────────────────

async function extractViaDocument(
  client:  Anthropic,
  pdfPath: string,
  prompt:  string,
  label:   string,
): Promise<{ text: string; inputTokens: number; outputTokens: number; elapsedMs: number }> {
  console.log(`\n[document-block] ${label}`);
  const t0     = Date.now();
  const pdfB64 = fs.readFileSync(pdfPath).toString("base64");

  const response = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 4096,
    temperature: 0,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } } as any,
        { type: "text", text: prompt },
      ],
    }],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("");
  const elapsed = Date.now() - t0;
  console.log(`  in:${response.usage.input_tokens.toLocaleString()}  out:${response.usage.output_tokens.toLocaleString()}  ${(elapsed/1000).toFixed(1)}s`);
  return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, elapsedMs: elapsed };
}

// ─── Approach B: image-block method (one call per page) ──────────────────────

async function extractViaImages(
  client:   Anthropic,
  pdfPath:  string,
  prompt:   string,
  label:    string,
  dpi = 150,
): Promise<{ text: string; inputTokens: number; outputTokens: number; elapsedMs: number }> {
  console.log(`\n[image-blocks] ${label}`);
  const t0   = Date.now();
  const pages = await pdfToImages(pdfPath, dpi);

  // Build content: one image block per page + the extraction prompt
  const content: Anthropic.ContentBlockParam[] = [
    ...pages.map((buf, i) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: buf.toString("base64"),
      },
      ...(pages.length > 1 ? { cache_control: undefined } : {}),
    })),
    { type: "text", text: pages.length > 1
        ? `The above ${pages.length} images are pages from the same drawing. ${prompt}`
        : prompt,
    },
  ];

  const response = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 4096,
    temperature: 0,
    messages: [{ role: "user", content }],
  });

  const text    = response.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("");
  const elapsed = Date.now() - t0;
  console.log(`  in:${response.usage.input_tokens.toLocaleString()}  out:${response.usage.output_tokens.toLocaleString()}  ${(elapsed/1000).toFixed(1)}s`);
  return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, elapsedMs: elapsed };
}

// ─── Approach C: tiled image-block method ────────────────────────────────────

async function extractViaTiles(
  client:   Anthropic,
  pdfPath:  string,
  prompt:   string,
  label:    string,
  cols = 2,
  rows = 2,
  dpi  = 200,
): Promise<{ text: string; inputTokens: number; outputTokens: number; elapsedMs: number }> {
  console.log(`\n[tiled-images ${cols}×${rows}] ${label}`);
  const t0    = Date.now();
  const tiles = await pdfToTiles(pdfPath, cols, rows, dpi);

  const content: Anthropic.ContentBlockParam[] = [
    ...tiles.map((tile) => ({
      type: "image" as const,
      source: {
        type:       "base64"      as const,
        media_type: "image/jpeg"  as const,
        data:       tile.buffer.toString("base64"),
      },
    })),
    {
      type: "text",
      text: `The above ${tiles.length} images are tiles from the same drawing sheet, ` +
            `arranged in a ${cols}-column × ${rows}-row grid (left-to-right, top-to-bottom). ` +
            `Together they form the complete sheet at higher resolution than a single image allows.\n\n` +
            prompt,
    },
  ];

  const response = await client.messages.create({
    model:       "claude-sonnet-4-6",
    max_tokens:  4096,
    temperature: 0,
    messages:    [{ role: "user", content }],
  });

  const text    = response.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("");
  const elapsed = Date.now() - t0;
  console.log(`  in:${response.usage.input_tokens.toLocaleString()}  out:${response.usage.output_tokens.toLocaleString()}  ${(elapsed/1000).toFixed(1)}s`);
  return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, elapsedMs: elapsed };
}

// ─── Prompts (same as test-lt-bicycle.ts) ────────────────────────────────────

const CIVIL_PROMPT = `Extract all of the following from this civil site plan:
- Project name and address (full street address, city, state, zip)
- All bicycle storage locations (rack types, quantities, precise locations relative to building entries)
- Distance from each bicycle storage location to the nearest functional building entry (in feet)
- Site boundary description
- Any bicycle network connections or paths shown on the site plan
Output as structured plain text.`;

const ARCH_PROMPT = `Extract all of the following from this architectural floor plan:
- Project name and address
- All shower and changing room locations (floor level, room number or designation, quantity)
- Total number of showers provided
- Building occupancy classification and regular occupant count if noted
- Any plumbing fixture schedule information visible on this sheet
Output as structured plain text.`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const divider = "─".repeat(60);
  console.log("\n" + "═".repeat(60));
  console.log(" Drawing Extraction: Document-block vs Image-block Test");
  console.log("═".repeat(60));

  // ── Civil drawing ──────────────────────────────────────────

  console.log("\n" + divider);
  console.log("CIVIL DRAWING — Civil006.pdf");
  console.log(divider);

  const civilDoc = await extractViaDocument(client, CIVIL_PATH, CIVIL_PROMPT, "Civil006.pdf");
  const civilImg = await extractViaImages  (client, CIVIL_PATH, CIVIL_PROMPT, "Civil006.pdf");

  // ── Architectural drawing ──────────────────────────────────

  console.log("\n" + divider);
  console.log("ARCHITECTURAL DRAWING — Rinker_009.pdf");
  console.log(divider);

  const archDoc   = await extractViaDocument(client, ARCH_PATH, ARCH_PROMPT, "Rinker_009.pdf");
  const archImg   = await extractViaImages  (client, ARCH_PATH, ARCH_PROMPT, "Rinker_009.pdf");
  const archTiles = await extractViaTiles   (client, ARCH_PATH, ARCH_PROMPT, "Rinker_009.pdf");

  // ── Tiled approach on civil too ────────────────────────────

  console.log("\n" + divider);
  console.log("CIVIL DRAWING (tiled) — Civil006.pdf");
  console.log(divider);

  const civilTiles = await extractViaTiles(client, CIVIL_PATH, CIVIL_PROMPT, "Civil006.pdf");

  // ── Results ────────────────────────────────────────────────

  const totalInDoc    = civilDoc.inputTokens   + archDoc.inputTokens;
  const totalInImg    = civilImg.inputTokens   + archImg.inputTokens;
  const totalInTiles  = civilTiles.inputTokens + archTiles.inputTokens;
  const totalOutDoc   = civilDoc.outputTokens  + archDoc.outputTokens;
  const totalOutImg   = civilImg.outputTokens  + archImg.outputTokens;
  const totalOutTiles = civilTiles.outputTokens + archTiles.outputTokens;

  const costDoc   = (totalInDoc   * 3 + totalOutDoc   * 15) / 1_000_000;
  const costImg   = (totalInImg   * 3 + totalOutImg   * 15) / 1_000_000;
  const costTiles = (totalInTiles * 3 + totalOutTiles * 15) / 1_000_000;

  console.log("\n" + "═".repeat(60));
  console.log(" RESULTS");
  console.log("═".repeat(60));

  console.log("\n── Civil drawing ──────────────────────────────────────────");
  console.log("\nDOCUMENT BLOCK:\n"  + civilDoc.text);
  console.log("\nIMAGE BLOCK:\n"     + civilImg.text);
  console.log("\nTILED (2×2):\n"     + civilTiles.text);

  console.log("\n── Architectural drawing ──────────────────────────────────");
  console.log("\nDOCUMENT BLOCK:\n"  + archDoc.text);
  console.log("\nIMAGE BLOCK:\n"     + archImg.text);
  console.log("\nTILED (2×2):\n"     + archTiles.text);

  console.log("\n── Token & cost comparison ────────────────────────────────");
  console.log(`Document blocks: ${totalInDoc.toLocaleString()} in / ${totalOutDoc.toLocaleString()} out  →  $${costDoc.toFixed(4)}`);
  console.log(`Image blocks:    ${totalInImg.toLocaleString()} in / ${totalOutImg.toLocaleString()} out  →  $${costImg.toFixed(4)}`);
  console.log(`Tiled 2×2:       ${totalInTiles.toLocaleString()} in / ${totalOutTiles.toLocaleString()} out  →  $${costTiles.toFixed(4)}`);
  console.log(`Cost vs doc:  image +$${(costImg   - costDoc).toFixed(4)}   tiled +$${(costTiles - costDoc).toFixed(4)}`);

  // Save results to file for easy review
  const output = {
    timestamp: new Date().toISOString(),
    civil: {
      documentBlock: { tokens: { in: civilDoc.inputTokens,   out: civilDoc.outputTokens   }, text: civilDoc.text   },
      imageBlock:    { tokens: { in: civilImg.inputTokens,   out: civilImg.outputTokens   }, text: civilImg.text   },
      tiledBlock:    { tokens: { in: civilTiles.inputTokens, out: civilTiles.outputTokens }, text: civilTiles.text },
    },
    arch: {
      documentBlock: { tokens: { in: archDoc.inputTokens,   out: archDoc.outputTokens   }, text: archDoc.text   },
      imageBlock:    { tokens: { in: archImg.inputTokens,   out: archImg.outputTokens   }, text: archImg.text   },
      tiledBlock:    { tokens: { in: archTiles.inputTokens, out: archTiles.outputTokens }, text: archTiles.text },
    },
    cost: { documentBlock: costDoc, imageBlock: costImg, tiledBlock: costTiles },
  };

  const outPath = path.resolve(__dirname, "output/drawing-image-test-results.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nFull results saved: ${outPath}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
