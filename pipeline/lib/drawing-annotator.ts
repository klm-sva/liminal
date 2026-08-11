/**
 * pipeline/lib/drawing-annotator.ts
 *
 * Renders a PDF drawing at high resolution and composites annotation callouts
 * at located feature positions. Used to produce annotated site plans for LEED
 * form uploads (e.g., bicycle storage locations labeled by type and capacity).
 *
 * Workflow:
 *   1. locateFeatureInTile() — sends a single tile image to Claude and asks for
 *      the feature's (x%, y%) position within that tile.
 *   2. annotateDrawing() — renders the full PDF at high DPI, converts tile-relative
 *      percentages to full-image pixel coords, composites SVG callouts via sharp,
 *      and returns a PNG buffer.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface AnnotationFeature {
  label:    string;  // Bold top line,  e.g. "SHORT-TERM BICYCLE STORAGE"
  sublabel: string;  // Second line,    e.g. "~3 spaces • Inverted-U racks"
  tileCol:  number;  // 0-based column index of the tile containing this feature
  tileRow:  number;  // 0-based row index of the tile containing this feature
  pctX:     number;  // 0–100 horizontal % within that tile
  pctY:     number;  // 0–100 vertical % within that tile
  color:    string;  // Hex, e.g. "#327cb9"
}

/**
 * Ask Claude to locate one or more features on a full-page drawing image.
 *
 * Pass a single JPEG/PNG of the full drawing page (rendered at moderate resolution
 * so Claude can read labels and symbols). Returns each feature's approximate
 * position as a percentage from the image's top-left corner.
 *
 * Using the full page (rather than individual tiles) gives Claude the spatial
 * context it needs to reliably identify annotations, callout leaders, and symbols.
 */
export async function locateFeaturesOnPage(
  client:       Anthropic,
  pageBuffer:   Buffer,
  mediaType:    "image/jpeg" | "image/png",
  features:     string[],   // e.g. ["long-term bicycle storage", "short-term bicycle storage"]
): Promise<Array<{ label: string; pctX: number; pctY: number } | null>> {
  const featureList = features.map((f, i) => `${i + 1}. ${f}`).join("\n");

  const response = await client.messages.create({
    model:       "claude-sonnet-4-6",
    max_tokens:  512,
    temperature: 0,
    messages: [{
      role:    "user",
      content: [
        {
          type:   "image",
          source: { type: "base64", media_type: mediaType, data: pageBuffer.toString("base64") },
        },
        {
          type: "text",
          text: `This is a construction drawing (civil site plan or architectural floor plan).

For each feature listed below, locate its position on the drawing and return approximate coordinates as a percentage from the TOP-LEFT corner of this image (0,0 = top-left, 100,100 = bottom-right). Look carefully for text callouts, notation boxes, symbols, and leader lines.

Features to locate:
${featureList}

Return a JSON array with one entry per feature (in the same order):
[
  {"label":"feature name","found":true,"pctX":45,"pctY":72},
  {"label":"feature name","found":false}
]

Return only the JSON array.`,
        },
      ],
    }],
  });

  const fullText = response.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  // Extract the JSON array from anywhere in the response
  const jsonMatch = fullText.match(/\[[\s\S]*\]/);
  const raw = jsonMatch ? jsonMatch[0].trim() : "";

  try {
    const parsed: Array<{ label: string; found: boolean; pctX?: number; pctY?: number }> = JSON.parse(raw);
    return parsed.map((p) =>
      p.found && p.pctX != null && p.pctY != null
        ? { label: p.label, pctX: Number(p.pctX), pctY: Number(p.pctY) }
        : null
    );
  } catch {
    return features.map(() => null);
  }
}

/** @deprecated Use locateFeaturesOnPage instead */
export async function locateFeatureInTile(
  client:      Anthropic,
  tileBuffer:  Buffer,
  description: string,
): Promise<{ pctX: number; pctY: number } | null> {
  const results = await locateFeaturesOnPage(client, tileBuffer, "image/jpeg", [description]);
  return results[0] ?? null;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function calloutSvg(
  px: number, py: number,
  label: string, sublabel: string,
  color: string,
  canvasW: number,
): string {
  const RADIUS      = 14;
  const PADDING     = 10;
  const FONT_L      = 15;
  const FONT_S      = 12;
  const LINE_H      = 20;

  const charWidthL  = 8.5;
  const charWidthS  = 7;
  const boxW = Math.round(Math.max(label.length * charWidthL, sublabel.length * charWidthS) + PADDING * 2);
  const boxH = PADDING * 2 + FONT_L + LINE_H;

  // Flip box to left side if close to right edge
  const boxX = (px + RADIUS + 14 + boxW < canvasW)
    ? px + RADIUS + 14
    : px - RADIUS - 14 - boxW;
  const boxY = Math.max(4, py - Math.round(boxH / 2));

  const lineX2 = boxX < px ? boxX + boxW : boxX;
  const lineY2 = boxY + Math.round(boxH / 2);

  return `
    <line x1="${px}" y1="${py}" x2="${lineX2}" y2="${lineY2}"
          stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${px}" cy="${py}" r="${RADIUS}"
            fill="${color}" stroke="white" stroke-width="2.5"/>
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="5"
          fill="white" stroke="${color}" stroke-width="2" opacity="0.95"/>
    <text x="${boxX + PADDING}" y="${boxY + PADDING + FONT_L}"
          font-family="Arial, sans-serif" font-size="${FONT_L}" font-weight="bold"
          fill="${color}">${escapeXml(label)}</text>
    <text x="${boxX + PADDING}" y="${boxY + PADDING + FONT_L + LINE_H}"
          font-family="Arial, sans-serif" font-size="${FONT_S}"
          fill="#2b4044">${escapeXml(sublabel)}</text>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Render a PDF to a full-resolution image, composite annotation callouts at
 * the specified tile-relative positions, and return a PNG buffer.
 *
 * @param pdfBuffer  - Raw PDF bytes
 * @param features   - Annotation targets (label, position within a tile)
 * @param cols       - Tile grid columns used during feature location (default 2)
 * @param rows       - Tile grid rows used during feature location (default 2)
 * @param dpi        - Render resolution (default 200)
 * @param maxOutputPx - Resize output so longest side ≤ this value (default 4000)
 */
export async function annotateDrawing(
  pdfBuffer:    Buffer,
  features:     AnnotationFeature[],
  cols          = 2,
  rows          = 2,
  dpi           = 200,
  maxOutputPx   = 4000,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib     = require("pdfjs-dist/legacy/build/pdf.mjs") as typeof import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require("@napi-rs/canvas") as typeof import("@napi-rs/canvas");
  const sharp = (await import("sharp")).default;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `file://${require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;

  const data = new Uint8Array(pdfBuffer);
  const pdf  = await pdfjsLib.getDocument({ data } as any).promise;

  const page         = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });

  // Render at exactly maxOutputPx on the longest side — avoids outsized buffers
  // and means no resize step is needed after compositing.
  const longest = Math.max(baseViewport.width, baseViewport.height);
  const scale   = maxOutputPx / longest;
  const viewport = page.getViewport({ scale });
  const W        = Math.round(viewport.width);
  const H        = Math.round(viewport.height);

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;
  const fullPng = canvas.toBuffer("image/png");

  const tileW = Math.ceil(W / cols);
  const tileH = Math.ceil(H / rows);

  // Build SVG callouts for each feature
  const callouts: string[] = [];
  for (const f of features) {
    const tileOriginX = f.tileCol * tileW;
    const tileOriginY = f.tileRow * tileH;
    const tw = Math.min(tileW, W - tileOriginX);
    const th = Math.min(tileH, H - tileOriginY);

    const px = Math.round(tileOriginX + (f.pctX / 100) * tw);
    const py = Math.round(tileOriginY + (f.pctY / 100) * th);

    callouts.push(calloutSvg(px, py, f.label, f.sublabel, f.color, W));
  }

  // Inline SVG composited directly — dimensions match the rendered PNG exactly.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${callouts.join("\n")}
  </svg>`;

  return sharp(fullPng)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png({ compressionLevel: 8 })
    .toBuffer();
}
