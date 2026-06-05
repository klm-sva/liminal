"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pipeline/lib/supabase.ts
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return (0, import_supabase_js.createClient)(url, key);
}
var import_supabase_js;
var init_supabase = __esm({
  "pipeline/lib/supabase.ts"() {
    "use strict";
    import_supabase_js = require("@supabase/supabase-js");
  }
});

// pipeline/lib/make-editable.ts
function injectTableCss(html) {
  const tag = `<style id="liminal-css">${LIMINAL_CSS}
</style>`;
  let result = html;
  if (result.indexOf("</head>") !== -1) {
    result = result.slice(0, result.indexOf("</head>")) + tag + "\n" + result.slice(result.indexOf("</head>"));
    result = result.replace(/<body([^>]*)>/i, (_match, attrs = "") => {
      if (attrs.toLowerCase().includes("margin")) return _match;
      return `<body${attrs} style="margin: 0 20%; padding: 40px 0; box-sizing: border-box;">`;
    });
  } else {
    result = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${tag}
</head>
<body style="margin: 0 20%; padding: 40px 0; box-sizing: border-box;">
${result}
</body>
</html>`;
  }
  return result;
}
function addContentEditable(html) {
  return html.replace(/<(p|td|th|h[1-6]|li)(\s[^>]*)?>/gi, (match, tag, attrs = "") => {
    if (attrs.toLowerCase().includes("contenteditable")) return match;
    return `<${tag}${attrs} contenteditable="true">`;
  });
}
function makeEditable(html) {
  let result = injectTableCss(html);
  result = result.replace(/<body([^>]*)>/i, (match) => match + "\n" + BANNER_HTML);
  result = addContentEditable(result);
  return result;
}
var LIMINAL_CSS, BANNER_HTML;
var init_make_editable = __esm({
  "pipeline/lib/make-editable.ts"() {
    "use strict";
    LIMINAL_CSS = `
  /* Base */
  body { font-family: Arial, Helvetica, sans-serif; color: #515062; background: #ffffff; margin: 0 20%; padding: 40px 0; box-sizing: border-box; font-size: 13px; }
  a { color: #327cb9; }
  h2 { color: #327cb9; font-size: 15px; margin: 20px 0 6px 0; }
  h3 { color: #515062; font-size: 13px; margin: 14px 0 4px 0; font-weight: bold; }
  h4 { color: #515062; font-size: 0.97em; margin: 14px 0 4px 0; }

  /* Page header */
  .page-header { background: #327cb9; color: #ffffff; padding: 22px 32px 16px 32px; }
  .page-header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: bold; color: #ffffff; }
  .page-header .sub { font-size: 13px; opacity: 0.88; }

  /* Section structure */
  .section-header { background: #327cb9; color: #ffffff; font-weight: bold; font-size: 13px; padding: 8px 14px; margin: 22px 0 0 0; border-radius: 3px 3px 0 0; }
  .section-subheader { background: #abcde8; color: #327cb9; font-weight: bold; font-size: 12px; padding: 6px 14px; margin: 14px 0 0 0; border-radius: 3px 3px 0 0; border: 1px solid #cccccc; border-bottom: none; }
  .section-body { border: 1px solid #cccccc; border-top: none; padding: 16px 18px; background: #ffffff; }
  .section-wrap { padding: 0 24px 18px 24px; }
  .meta-bar { background: #abcde8; padding: 10px 24px; font-size: 0.92em; display: flex; flex-wrap: wrap; gap: 24px; }
  .meta-bar span { font-weight: bold; color: #327cb9; }
  .form-id-bar { background: #abcde8; padding: 8px 18px; font-weight: bold; font-size: 13px; color: #327cb9; border-bottom: 2px solid #327cb9; }
  .divider { border: none; border-top: 1px solid #cccccc; margin: 18px 0; }

  /* Form fields */
  .field-row { display: flex; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
  .field-label { font-weight: bold; color: #327cb9; min-width: 220px; font-size: 12px; }
  .field-id { display: none; }
  .field-value { color: #515062; flex: 1; }
  .field-value.filled { background: #e8f0f7; border-left: 3px solid #327cb9; padding: 5px 10px; border-radius: 0 3px 3px 0; }
  .field-value.upload { background: #fff3cd; border-left: 3px solid #ffc107; padding: 5px 10px; border-radius: 0 3px 3px 0; color: #856404; }
  .owner-field { background: #fff3cd; border: 1px dashed #ffc107; border-radius: 3px; padding: 4px 10px; color: #856404; font-style: italic; display: inline-block; margin: 2px 0; }
  .radio-selected { display: inline-block; background: #327cb9; color: #fff; border-radius: 50%; width: 14px; height: 14px; text-align: center; line-height: 14px; font-size: 10px; margin-right: 6px; }
  .radio-unselected { display: inline-block; border: 2px solid #aaa; border-radius: 50%; width: 12px; height: 12px; margin-right: 6px; vertical-align: middle; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0; table-layout: fixed; word-wrap: break-word; }
  thead tr th { background: #327cb9; color: #ffffff; font-weight: bold; padding: 8px; text-align: left; border: 1px solid #cccccc; }
  tbody tr:nth-child(odd) { background: #ffffff; }
  tbody tr:nth-child(even) { background: #e8f0f7; }
  tbody tr td { padding: 7px 8px; border: 1px solid #cccccc; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; max-width: 0; }
  th { word-wrap: break-word; overflow-wrap: break-word; }
  @media print { table { page-break-inside: avoid; } }

  /* Calculation boxes */
  .calc-box { background: #f4f8fc; border: 1px solid #327cb9; border-radius: 4px; padding: 14px 18px; margin: 10px 0; font-family: monospace; font-size: 12px; color: #515062; }
  .calc-box .step { margin-bottom: 6px; }

  /* Compliance results */
  .result-pass { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .result-fail { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .result-warn { background: #fff3cd; color: #856404; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .pass { color: #155724; font-weight: bold; }
  .fail { color: #721c24; font-weight: bold; }
  .point-box { background: #327cb9; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 16px; font-weight: bold; margin: 10px 0; }
  .point-box-pending { background: #856404; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 16px; font-weight: bold; margin: 10px 0; }
  .score-box { background: #327cb9; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 1.1em; font-weight: bold; margin: 10px 0; }
  .compliance-threshold-box { background: #f4f8fc; border: 2px solid #327cb9; border-radius: 6px; padding: 16px 20px; margin: 14px 0; }
  .compliance-threshold-box .threshold-label { font-weight: bold; color: #327cb9; font-size: 13px; }
  .compliance-threshold-box .threshold-value { font-size: 22px; font-weight: bold; color: #515062; }
  .compliance-threshold-box .threshold-limit { font-size: 13px; color: #515062; }

  /* Notes and callouts */
  .note { background: #abcde8; border-left: 4px solid #327cb9; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }
  .info-box { background: #e8f0f7; border-left: 4px solid #327cb9; padding: 10px 16px; margin: 10px 0 16px 0; font-size: 0.93em; }
  .warn-note { background: #fff3cd; border-left: 4px solid #ffc107; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }
  .warn-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px 16px; margin: 10px 0 16px 0; font-size: 0.93em; }
  .alert-note { background: #f8d7da; border-left: 4px solid #dc3545; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }

  /* Submission checklist badges */
  .badge-provided { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .badge-required { background: #fff3cd; color: #856404; border: 1px solid #ffc107; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .badge-incomplete { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .checklist-item { border: 1px solid #cccccc; border-radius: 4px; padding: 12px 16px; margin-bottom: 10px; }
  .checklist-item h4 { margin: 0 0 4px 0; font-size: 13px; color: #327cb9; }
  .checklist-item p { margin: 3px 0; font-size: 12px; }
  .checklist-item .item-title { font-weight: bold; font-size: 0.97em; color: #327cb9; }
  .checklist-item .item-detail { font-size: 0.91em; margin-top: 4px; color: #515062; }
  ul.checklist-list { list-style: none; padding: 0; margin: 0; }
  ul.checklist-list li { padding: 4px 0; border-bottom: 1px solid #e8f0f7; font-size: 12px; }
  ul.checklist-list li:last-child { border-bottom: none; }

  /* Layout helpers */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .plan-section { border: 1px solid #cccccc; border-radius: 4px; padding: 14px 18px; margin: 12px 0; }
  .plan-section h4 { color: #327cb9; margin: 0 0 8px 0; font-size: 13px; border-bottom: 1px solid #abcde8; padding-bottom: 4px; }
  .signature-block { border: 1px solid #cccccc; border-radius: 4px; padding: 14px 18px; margin: 12px 0; background: #f9f9f9; }
  .sig-line { border-bottom: 1px solid #515062; min-width: 250px; display: inline-block; margin: 0 10px; height: 20px; }
  .processing-summary { background: #f4f8fc; border: 2px solid #327cb9; border-radius: 6px; padding: 18px 22px; margin: 24px 0; }
  .processing-summary h3 { color: #327cb9; margin: 0 0 10px 0; font-size: 14px; }
  .source-note { font-size: 10px; color: #888; font-style: italic; }
  .map-placeholder { background: #e8f0f7; border: 2px dashed #327cb9; border-radius: 6px; padding: 28px; text-align: center; color: #327cb9; font-size: 1em; margin: 14px 0; }`;
    BANNER_HTML = `
<div class="liminal-edit-banner" style="background:#abcde8;color:#2b4044;padding:12px 16px;font-size:13px;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:9999;box-shadow:0 2px 4px rgba(0,0,0,0.12);">
  <span style="flex:1;">This document is editable. Click any text to edit it directly. When finished, use <strong>File &rarr; Print &rarr; Save as PDF</strong> in your browser to save your edited version. Your edits are saved on your computer only &mdash; nothing is sent to the server.</span>
  <button onclick="window.print()" style="background:#327cb9;color:white;border:none;padding:8px 16px;border-radius:4px;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit;font-weight:600;">Print to PDF</button>
</div>
<style>
  @media print {
    .liminal-edit-banner { display: none !important; }
  }
  [contenteditable="true"]:focus {
    outline: 2px solid #327cb9;
    outline-offset: 1px;
    border-radius: 2px;
    background: #f0f6fc;
  }
  [contenteditable="true"] {
    cursor: text;
    min-height: 1em;
  }
</style>`;
  }
});

// pipeline/lib/pdf-extract.ts
async function renderPdfToTiles(pdfBuffer, cols = 2, rows = 2, dpi = 200, tileMaxSide = 2500) {
  const _req = eval("require");
  const pdfjsLib = _req("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = _req("@napi-rs/canvas");
  const sharp = (await import("sharp")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${_req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;
  const data = new Uint8Array(pdfBuffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const scale = dpi / 72;
  const tiles = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const fullPng = canvas.toBuffer("image/png");
    const tileW = Math.ceil(width / cols);
    const tileH = Math.ceil(height / rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = c * tileW;
        const top = r * tileH;
        const tw = Math.min(tileW, width - left);
        const th = Math.min(tileH, height - top);
        const longest = Math.max(tw, th);
        const resizeOpts = longest > tileMaxSide ? tw >= th ? { width: tileMaxSide } : { height: tileMaxSide } : {};
        const jpegBuf = await sharp(fullPng).extract({ left, top, width: tw, height: th }).resize(resizeOpts).jpeg({ quality: 92 }).toBuffer();
        const quadrant = ["top-left", "top-right", "bottom-left", "bottom-right"][r * cols + c] ?? `r${r}c${c}`;
        tiles.push({ buffer: jpegBuf, label: `Page ${pageNum}, tile ${r * cols + c + 1}/${rows * cols} (${quadrant})` });
      }
    }
  }
  return tiles;
}
async function _extract(client2, pdfBuffer2, filename2, extractionPrompt, renderMode, cacheKey) {
  const t0 = Date.now();
  let content;
  if (renderMode === "tiled-image") {
    console.log(`  [pdf-extract] Rendering tiles: ${filename2}...`);
    const tiles2 = await renderPdfToTiles(pdfBuffer2);
    console.log(`  [pdf-extract] ${tiles2.length} tiles ready \u2014 sending to Claude`);
    content = [
      ...tiles2.map((tile) => ({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: tile.buffer.toString("base64")
        }
      })),
      {
        type: "text",
        text: `The above ${tiles2.length} images are tiles from the same drawing sheet, arranged in a 2-column \xD7 2-row grid (left-to-right, top-to-bottom). Together they form the complete sheet at higher resolution than a single image allows.

` + extractionPrompt
      }
    ];
  } else {
    const pdfB64 = pdfBuffer2.toString("base64");
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
      { type: "text", text: extractionPrompt }
    ];
  }
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8e3,
    temperature: 0,
    messages: [{ role: "user", content }]
  });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const elapsedMs = Date.now() - t0;
  console.log(
    `  [pdf-extract] \u2713 ${filename2} [${renderMode}] \u2014 ${(elapsedMs / 1e3).toFixed(1)}s  in:${response.usage.input_tokens.toLocaleString()} out:${response.usage.output_tokens.toLocaleString()}`
  );
  _cache.set(cacheKey, text);
  return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, elapsedMs, cacheHit: false };
}
async function extractPdfContent(client2, pdfPath, extractionPrompt, renderMode = "document") {
  const cacheKey = `${pdfPath}::${renderMode}::${extractionPrompt}`;
  if (_cache.has(cacheKey)) {
    console.log(`  [pdf-extract] Cache hit: ${path.basename(pdfPath)}`);
    return { text: _cache.get(cacheKey), inputTokens: 0, outputTokens: 0, elapsedMs: 0, cacheHit: true };
  }
  console.log(`  [pdf-extract] Extracting from ${path.basename(pdfPath)} [${renderMode}]...`);
  const pdfBuffer2 = fs.readFileSync(pdfPath);
  return _extract(client2, pdfBuffer2, path.basename(pdfPath), extractionPrompt, renderMode, cacheKey);
}
async function extractPdfContentFromBuffer(client2, pdfBuffer2, filename2, extractionPrompt, renderMode = "document") {
  const cacheKey = `buffer::${filename2}::${pdfBuffer2.length}::${renderMode}::${extractionPrompt}`;
  if (_cache.has(cacheKey)) {
    console.log(`  [pdf-extract] Cache hit: ${filename2}`);
    return { text: _cache.get(cacheKey), inputTokens: 0, outputTokens: 0, elapsedMs: 0, cacheHit: true };
  }
  console.log(`  [pdf-extract] Extracting from ${filename2} [${renderMode}]...`);
  return _extract(client2, pdfBuffer2, filename2, extractionPrompt, renderMode, cacheKey);
}
var fs, path, _cache, EXTRACT_PROMPTS;
var init_pdf_extract = __esm({
  "pipeline/lib/pdf-extract.ts"() {
    "use strict";
    fs = __toESM(require("fs"));
    path = __toESM(require("path"));
    _cache = /* @__PURE__ */ new Map();
    EXTRACT_PROMPTS = {
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
Output as structured plain text. Be thorough \u2014 include every data point visible.`,
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
Output as structured plain text. Be complete \u2014 every requirement matters.`,
      GEOTECHNICAL_REPORT: `Extract all of the following from this geotechnical report:
- Project name and address
- Report date and author
- Soil classifications (USCS or ASTM) for each boring or test pit
- Prime farmland soil types identified (if any)
- Groundwater depth observations
- Any notes on wetlands, fill, or sensitive soil conditions
- Bearing capacity values
- Any environmental observations
Output as structured plain text.`
    };
  }
});

// pipeline/lib/pdf-to-images.ts
function preparePdfDocument(input, title) {
  const buf = typeof input === "string" ? fs2.readFileSync(input) : input;
  return {
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: buf.toString("base64")
    },
    title
  };
}
var fs2;
var init_pdf_to_images = __esm({
  "pipeline/lib/pdf-to-images.ts"() {
    "use strict";
    fs2 = __toESM(require("fs"));
  }
});

// pipeline/prompts/gap-analysis-leed.ts
function buildLeedGapAnalysisPrompt(params) {
  const r = params.responses;
  const docs = params.documentContext;
  const docCount = params.documentCount ?? 0;
  return `You are a LEED BD+C v4.1 consultant producing a Gap Analysis Report for a project team.

Your output is a complete, standalone HTML document using the Liminal design system CSS classes defined below. Do not include <html>, <head>, or <body> tags \u2014 output the body content only, starting with the page-header div.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PROJECT DATA (from intake questionnaire)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Building name:       ${r.buildingName || "Not provided"}
Address:             ${r.buildingAddress || "Not provided"}
Building type:       ${r.buildingType || "Not specified"}
Gross floor area:    ${r.gfa ? `${parseInt(r.gfa).toLocaleString()} SF` : "Not provided"}
Floors:              ${r.floors || "Not provided"}
Parking spaces:      ${r.parking || "Not provided"}
Target level:        ${r.targetLevel || "Not specified"}
LEED AP on team:     ${r.leedAp || "Unknown"}

ENERGY & MECHANICAL
Energy target:            ${r.energyTarget || "Not set"}
Heating fuel:             ${r.heatingFuel || "Unknown"}
Cooling system:           ${r.coolingSystem || "Unknown"}
Renewable energy:         ${r.renewableEnergy || "Unknown"}${r.renewableDetail ? `
Renewable detail: ${r.renewableDetail}` : ""}
Enhanced commissioning:   ${r.enhancedCommissioning || "Unknown"}
Refrigerant approach:     ${r.refrigerantApproach || "Unknown"}

WATER
Irrigation:               ${r.irrigation || "Unknown"}
Water reuse systems:      ${Array.isArray(r.waterReuse) ? r.waterReuse.join(", ") || "None" : r.waterReuse || "Unknown"}
Cooling tower:            ${r.coolingTower || "Unknown"}
Fixture intent:           ${r.fixtureIntent || "Unknown"}

SITE & LOCATION
Previously developed:     ${r.previouslyDeveloped || "Unknown"}
Existing structure:       ${r.existingStructure || "Unknown"}
Site area:                ${r.siteArea ? `${r.siteArea} acres` : "Not provided"}
Bicycle storage:          ${r.bicycleStorage || "Unknown"}
EV charging:              ${r.evCharging || "Unknown"}
Exterior lighting:        ${r.exteriorLighting || "Unknown"}

MATERIALS
EPDs:                     ${r.epds || "Unknown"}
FSC-certified wood:       ${r.fscWood || "Unknown"}
Waste management plan:    ${r.wasteManagement || "Unknown"}
Low-emitting materials:   ${r.lowEmitting || "Unknown"}

INDOOR ENVIRONMENT
Ventilation strategy:     ${r.ventilation || "Unknown"}
Daylighting priority:     ${r.daylighting || "Unknown"}
Acoustic standards:       ${r.acoustic || "Unknown"}
Construction IAQ plan:    ${r.constructionIaq || "Unknown"}

TEAM & PROCESS
Pre-design charrette:     ${r.charrette || "Unknown"}
Commissioning authority:  ${r.cxAuthority || "Unknown"}
Contractor selected:      ${r.contractorSelected || "Unknown"}${r.contractorLeedExperience ? `
Contractor LEED experience: ${r.contractorLeedExperience}` : ""}
${r.projectNarrative ? `
PROJECT NARRATIVE (owner-provided \u2014 use this to supplement the above data):
${r.projectNarrative}` : ""}

${docCount > 0 ? `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
UPLOADED DOCUMENTS \u2014 EXAMINE BEFORE WRITING THE REPORT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${docCount} document file(s) are attached as PDFs. Visually read every page now, before generating the report.

For each document, look for evidence relevant to LEED credits:
- Floor plans / architectural drawings: bicycle storage room or racks, EV charging stations, building footprint and orientation, open space areas, stair locations and design
- Mechanical/HVAC drawings: heating and cooling system type, refrigerant type, ventilation strategy, renewable energy equipment (solar panels, geothermal), commissioning scope
- Plumbing drawings: fixture types (low-flow, dual-flush), irrigation system, water reuse connections (rainwater, greywater), cooling tower
- Site plans: previously developed land, impervious surface area, exterior lighting fixtures, landscaping
- Specifications: EPD-documented products, FSC-certified wood, low-emitting material callouts, recycled content
- Reports/models: energy model outputs, commissioning plan or report, waste management plan, construction IAQ plan

${docs ? `Extracted text (supplement to visual reading):
${docs}` : ""}` : "No documents were uploaded. Base analysis on questionnaire responses only."}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
OUTPUT INSTRUCTIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Produce a LEED BD+C v4.1 Gap Analysis Report as HTML. This is a RECOMMENDATIONS REPORT \u2014 it identifies which credits to pursue, estimates their point potential, and frames each recommendation around this specific project's characteristics. It is NOT a compliance guide and must NOT explain how to achieve credits in detail.

DESIGN RULES:
- Use Liminal CSS classes throughout (section-header, section-body, section-wrap, page-header, field-row, field-label, field-value, note, info-box, warn-note, checklist-item, result-pass, result-warn, badge-provided, badge-required, two-col, point-box)
- Every section-header must be immediately followed by a section-body
- Use the point-box class for point totals
- Use result-pass for strong opportunities, result-warn for gaps

REPORT STRUCTURE \u2014 produce all sections in this order:

1. PAGE HEADER
   <div class="page-header">
     <h1>LEED BD+C v4.1 Gap Analysis</h1>
     <div class="sub">[Building name] \xB7 [Address] \xB7 [Building type] \xB7 [GFA] SF</div>
   </div>

2. META BAR \u2014 show: Target Level, GFA, Building Type, LEED AP status

3. EXECUTIVE SUMMARY SECTION
   - 2\u20133 sentences on overall readiness based on questionnaire
   - Estimated point range (format: "X\u2013Y estimated points")
   - Whether target level appears achievable, ambitious, or out of reach
   - Use point-box for the estimate

4. CREDIT RECOMMENDATIONS \u2014 one section per LEED category below.
   For each category, analyze the questionnaire data and recommend specific credits.
   For each credit:
   - Use a checklist-item div
   - Credit name and code (e.g., "EA Credit: Optimize Energy Performance")
   - 1\u20132 sentences explaining why this credit fits THIS project based on questionnaire answers
   - Point value or range in brackets (e.g., [1\u201318 pts])
   - Effort level badge: <span class="badge-provided">LOW EFFORT</span>, <span class="badge-required">MEDIUM EFFORT</span>, or <span class="badge-incomplete">HIGH EFFORT</span>
   - Only recommend credits with a realistic path given the questionnaire data
   - Do NOT explain compliance requirements or how to achieve the credit

   Categories to cover (use section-header for each):
   - Location & Transportation (LT) \u2014 use address data, transit access, bicycle storage, EV charging
   - Sustainable Sites (SS) \u2014 site development, previously developed status, open space
   - Water Efficiency (WE) \u2014 fixture intent, irrigation, water reuse, cooling tower
   - Energy & Atmosphere (EA) \u2014 energy target, fuel type, renewables, commissioning, refrigerant
   - Materials & Resources (MR) \u2014 EPDs, FSC wood, waste management, existing structure reuse
   - Indoor Environmental Quality (IEQ) \u2014 ventilation, daylighting, acoustics, low-emitting, IAQ
   - Innovation (IN) \u2014 LEED AP, any standout strategies identified
   - Regional Priority (RP) \u2014 note that RP credits are location-specific and will be assessed during credit work

5. POINT SUMMARY SECTION
   Table showing: Category | Recommended Credits | Estimated Points
   Show a total row with the overall estimated point range.
   Add a note that this is an estimate \u2014 exact points depend on design decisions and documentation.

6. RECOMMENDED SERVICES SECTION (section-header: "Recommended Credit Services")
   A clear list of the specific credits recommended for ordering from LIMINALsva, presented as:
   <div class="info-box">
     <strong>Based on this gap analysis, the following LEED credit services are recommended for your project.</strong>
     Each service includes a complete credit submission package \u2014 GBCI calculator, compliance narrative, and all required documentation.
   </div>
   Then list each recommended credit as a checklist-item with the credit name and a one-line reason.

7. STRUCTURED DATA BLOCK \u2014 after the full HTML report, output a machine-readable JSON block exactly like this (use these exact delimiter lines):

===GAP_ANALYSIS_DATA_START===
{
  "program": "leed_bd_c",
  "overall_score": <integer \u2014 estimated current points>,
  "target_score": <integer \u2014 points needed for target level>,
  "certification_level": "<Certified|Silver|Gold|Platinum>",
  "categories": [
    { "name": "Location & Transportation", "score": <int>, "max": 26, "recommended": ["<credit code>", ...] },
    { "name": "Sustainable Sites", "score": <int>, "max": 10, "recommended": [] },
    { "name": "Water Efficiency", "score": <int>, "max": 11, "recommended": [] },
    { "name": "Energy & Atmosphere", "score": <int>, "max": 33, "recommended": [] },
    { "name": "Materials & Resources", "score": <int>, "max": 13, "recommended": [] },
    { "name": "Indoor Env. Quality", "score": <int>, "max": 16, "recommended": [] },
    { "name": "Innovation", "score": <int>, "max": 6, "recommended": [] },
    { "name": "Regional Priority", "score": <int>, "max": 4, "recommended": [] }
  ]
}
===GAP_ANALYSIS_DATA_END===

Fill in actual estimated scores based on the questionnaire. The "recommended" array for each category should list the credit codes you are recommending. Use the exact short codes only \u2014 no category prefixes, no full names. Examples: "EAc2", "LTc5", "EQc1", "WEc1", "MRc2", "SSc1", "LTc4". The Indoor Environmental Quality category uses EQ codes (EQc1, EQc2, etc.) \u2014 never IEQ. The Energy & Atmosphere category uses EA codes \u2014 never ENE. The Location & Transportation category uses LT codes \u2014 never LOC.

DOCUMENT USAGE \u2014 MANDATORY:
${docCount > 0 ? `Documents are attached. You MUST actively use what you see in them. Do not produce an analysis based solely on questionnaire answers when documents are present.

For every LEED category, check the documents for supporting or contradicting evidence:
- LT (Location & Transportation): Do site or floor plans show bicycle storage, EV charging stations, or proximity to transit?
- SS (Sustainable Sites): Does the site plan show open space, pervious surfaces, exterior lighting type, or previously developed land indicators?
- WE (Water Efficiency): Do plumbing drawings show fixture types, irrigation design, or water reuse systems?
- EA (Energy & Atmosphere): Do mechanical drawings show system type, fuel source, refrigerant, or renewable energy? Does an energy model or commissioning report exist?
- MR (Materials & Resources): Do specs reference EPDs, FSC wood, recycled content, or a waste management plan?
- IEQ (Indoor Environmental Quality): Do mechanical drawings show ventilation rates, filtration type, or a construction IAQ plan? Do floor plans show daylighting potential or acoustic treatment?

When documents provide evidence:
1. Reference it explicitly in the credit rationale ("Mechanical drawings show VRF system with no refrigerant specified", "Site plan confirms 12 bicycle spaces adjacent to main entry")
2. Upgrade the effort level or recommendation if the document shows the project is further along than the questionnaire indicated
3. If a document contradicts a questionnaire answer, trust the document and note the discrepancy

After the Executive Summary, include a "Document Findings" section (REQUIRED when documents are attached) that lists what each document revealed and how it changed or confirmed the analysis.` : "No documents were attached. Omit the Document Findings section."}

IMPORTANT CONSTRAINTS:
- Do NOT say "contact us," "reach out," or mention support
- Do NOT give step-by-step compliance instructions or thresholds
- Do NOT make up data not in the questionnaire
- If a field is "Unknown" or missing, note it briefly but do not fabricate an answer
- Keep each credit rationale to 1\u20132 sentences max
- The tone is that of a knowledgeable consultant \u2014 confident, specific, and action-oriented
- Use the project's actual building name and address throughout`;
}
var init_gap_analysis_leed = __esm({
  "pipeline/prompts/gap-analysis-leed.ts"() {
    "use strict";
  }
});

// pipeline/prompts/gap-analysis-well-v2.ts
function buildWellV2GapAnalysisPrompt(params) {
  const r = params.responses;
  const docs = params.documentContext;
  const docCount = params.documentCount ?? 0;
  return `You are a WELL v2 consultant producing a Gap Analysis Report for a project team.

Your output is a complete, standalone HTML document using the Liminal design system CSS classes. Do not include <html>, <head>, or <body> tags \u2014 output the body content only, starting with the page-header div.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PROJECT DATA (from intake questionnaire)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Building name:       ${r.buildingName || "Not provided"}
Address:             ${r.buildingAddress || "Not provided"}
Building type:       ${r.buildingType || "Not specified"}
Certification type:  ${r.certType || "Not specified"}
GFA:                 ${r.gfa ? `${parseInt(r.gfa).toLocaleString()} SF` : "Not provided"}
Floors:              ${r.floors || "Not provided"}
Regular occupants:   ${r.regularOccupants || "Not provided"}
Peak visitors:       ${r.peakVisitors || "Not provided"}
Target level:        ${r.targetLevel || "Not specified"}
WELL AP on team:     ${r.wellAp || "Unknown"}

AIR (Concept A)
Ventilation strategy:      ${r.ventilationStrategy || "Unknown"}
Air filtration:            ${r.airFiltration || "Unknown"}
IAQ monitoring:            ${r.airQualityMonitoring || "Unknown"}
Smoking policy:            ${r.smokingPolicy || "Unknown"}
Combustion appliances:     ${r.combustionAppliances || "Unknown"}

WATER (Concept W)
Water source:              ${r.waterSource || "Unknown"}
Point-of-use filtration:   ${r.waterFiltration || "Unknown"}
Legionella assessment:     ${r.legionellaAssessment || "Unknown"}
Cooling tower:             ${r.coolingTower || "Unknown"}

NOURISHMENT (Concept N)
Food facilities:           ${r.foodFacilities || "Unknown"}
Healthy food access:       ${r.healthyFoodAccess || "Unknown"}
Vending machines:          ${r.vendingMachines || "Unknown"}

LIGHT (Concept L)
Circadian lighting:        ${r.circanianLighting || "Unknown"}
Window / view access:      ${r.windowViewAccess || "Unknown"}
Lighting controls:         ${r.lightingControls || "Unknown"}

MOVEMENT (Concept V)
Staircase design:          ${r.staircaseDesign || "Unknown"}
Fitness amenities:         ${r.fitnessAmenities || "Unknown"}
Showers / changing:        ${r.showersChanging || "Unknown"}
Outdoor recreation:        ${r.outdoorRecreation || "Unknown"}

THERMAL COMFORT (Concept T)
Individual thermal control: ${r.thermalControl || "Unknown"}
Radiant system:            ${r.radiantSystem || "Unknown"}
Humidity control:          ${r.humidityControl || "Unknown"}

SOUND (Concept S)
Acoustic standards:        ${r.acousticStandards || "Unknown"}
Background noise target:   ${r.backgroundNoiseTarget || "Unknown"}
Acoustic windows:          ${r.acousticWindows || "Unknown"}

MATERIALS (Concept X)
Cleaning products policy:  ${r.cleaningProductsPolicy || "Unknown"}
Hazardous material survey: ${r.hazardousMaterialSurvey || "Unknown"}
IPM policy:                ${r.ipmPolicy || "Unknown"}

MIND (Concept M)
Biophilic design:          ${r.biophilicDesign || "Unknown"}
Wellness spaces:           ${r.wellnessSpaces || "Unknown"}
Mental health programs:    ${r.mentalHealthPrograms || "Unknown"}

COMMUNITY (Concept C)
Universal design:          ${r.universalDesign || "Unknown"}
Equity policy:             ${r.equityPolicy || "Unknown"}
Community spaces:          ${r.communitySpaces || "Unknown"}
${r.projectNarrative ? `
PROJECT NARRATIVE (owner-provided \u2014 use this to supplement the above data):
${r.projectNarrative}` : ""}
${docCount > 0 ? `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
UPLOADED DOCUMENTS \u2014 EXAMINE BEFORE WRITING THE REPORT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${docCount} document file(s) are attached as PDFs. Visually read every page now, before generating the report.

For each document, look for evidence relevant to WELL v2 concepts:
- Floor plans: stair design and visibility, fitness rooms, wellness/meditation rooms, nursing rooms, food service areas, vending locations, outdoor access points, common areas, restroom locations
- Mechanical/HVAC drawings: ventilation system type and rates, filtration equipment and MERV rating, humidification/dehumidification, radiant heating/cooling systems, individual zone controls
- Plumbing drawings: point-of-use water filtration, drinking water access points, cooling tower presence, Legionella risk indicators
- Lighting plans: window layout and glazing, circadian lighting fixtures, daylight sensors, individual lighting controls
- Acoustic plans or specs: sound isolation details, background noise targets, acoustic ceiling or wall treatments
- Specifications: cleaning product lists or policies, hazardous material survey, IPM policy, biophilic design elements
- Reports: air quality test results, water test reports, commissioning records, occupant survey results

${docs ? `Extracted text (supplement to visual reading):
${docs}` : ""}` : "No documents were uploaded. Base analysis on questionnaire responses only."}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
OUTPUT INSTRUCTIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Produce a WELL v2 Gap Analysis Report as HTML. This is a RECOMMENDATIONS REPORT \u2014 it identifies which WELL features to pursue, distinguishes preconditions from optimizations, and frames each recommendation around this project's specific characteristics. It is NOT a compliance guide and must NOT explain how to achieve features in detail.

DESIGN RULES:
- Use Liminal CSS classes throughout
- Every section-header must be immediately followed by a section-body
- Use result-pass for strong readiness, result-warn for gaps, result-fail for missing preconditions
- Use badge-provided for "PRECONDITION MET" indicators, badge-required for "PURSUE", badge-incomplete for "GAP"

REPORT STRUCTURE:

1. PAGE HEADER
   <div class="page-header">
     <h1>WELL v2 Gap Analysis</h1>
     <div class="sub">[Building name] \xB7 [Address] \xB7 [Certification type] \xB7 [GFA] SF</div>
   </div>

2. META BAR \u2014 show: Target Level, Regular Occupants, Certification Type, WELL AP status

3. EXECUTIVE SUMMARY
   - 2\u20133 sentences on overall readiness
   - Note whether preconditions appear achievable
   - Identify the 2\u20133 concepts where the project is strongest
   - Identify the 1\u20132 concepts needing the most attention

4. CONCEPT RECOMMENDATIONS \u2014 one section per WELL concept below.
   For each concept, analyze the questionnaire and recommend specific features.
   Distinguish between:
   - Preconditions (required for certification \u2014 flag any gaps as urgent)
   - Optimizations (point-earning features \u2014 recommend based on project fit)
   For each feature:
   - Use a checklist-item div
   - Feature name and number (e.g., "A01: Air Quality Standards")
   - PRECONDITION or OPTIMIZATION label
   - 1\u20132 sentences explaining why this feature fits or where a gap exists
   - Readiness badge: badge-provided (strong position), badge-required (pursue), badge-incomplete (gap identified)
   - Do NOT explain compliance requirements or thresholds in detail

   Concepts to cover (use section-header for each):
   - Air (Concept A) \u2014 ventilation, filtration, IAQ monitoring, smoking, combustion
   - Water (Concept W) \u2014 source, filtration, legionella, cooling tower
   - Nourishment (Concept N) \u2014 food facilities, healthy options, vending
   - Light (Concept L) \u2014 circadian, views, controls
   - Movement (Concept V) \u2014 stairs, fitness, showers, outdoor access; use address for Walk/Transit Score context
   - Thermal Comfort (Concept T) \u2014 individual control, radiant, humidity
   - Sound (Concept S) \u2014 acoustic standards, background noise, windows
   - Materials (Concept X) \u2014 cleaning products, hazardous materials, IPM
   - Mind (Concept M) \u2014 biophilic design, wellness spaces, mental health
   - Community (Concept C) \u2014 universal design, equity, community spaces

5. READINESS SUMMARY TABLE
   Table: Concept | Preconditions Status | Optimizations Potential | Priority
   Use color-coded status (result-pass / result-warn / result-fail spans)

6. RECOMMENDED SERVICES SECTION (section-header: "Recommended WELL Feature Services")
   <div class="info-box">
     <strong>Based on this gap analysis, the following WELL v2 feature services are recommended.</strong>
     Each service includes a complete feature submission package \u2014 compliance narrative, supporting documentation, and IWBI submission guidance.
   </div>
   List each recommended feature as a checklist-item.

7. STRUCTURED DATA BLOCK \u2014 after the full HTML report, output a machine-readable JSON block exactly like this (use these exact delimiter lines):

===GAP_ANALYSIS_DATA_START===
{
  "program": "well_v2",
  "overall_score": <integer \u2014 estimated current points>,
  "target_score": <integer \u2014 points needed for target level>,
  "certification_level": "<Silver|Gold|Platinum>",
  "max_possible": 110,
  "concepts": [
    { "name": "Air",             "score": <int>, "max": 29, "recommended": ["<feature code>", ...] },
    { "name": "Water",           "score": <int>, "max": 14, "recommended": [] },
    { "name": "Nourishment",     "score": <int>, "max": 16, "recommended": [] },
    { "name": "Light",           "score": <int>, "max": 20, "recommended": [] },
    { "name": "Movement",        "score": <int>, "max": 16, "recommended": [] },
    { "name": "Thermal Comfort", "score": <int>, "max": 13, "recommended": [] },
    { "name": "Sound",           "score": <int>, "max": 9,  "recommended": [] },
    { "name": "Materials",       "score": <int>, "max": 14, "recommended": [] },
    { "name": "Mind",            "score": <int>, "max": 24, "recommended": [] },
    { "name": "Community",       "score": <int>, "max": 26, "recommended": [] }
  ]
}
===GAP_ANALYSIS_DATA_END===

Fill in actual estimated scores based on the questionnaire. "recommended" should list WELL feature codes you are recommending (e.g. "A03", "L01"). Use short feature codes.

DOCUMENT USAGE \u2014 MANDATORY:
${docCount > 0 ? `Documents are attached. You MUST actively use what you see in them. Do not produce an analysis based solely on questionnaire answers when documents are present.

For every WELL v2 concept, check the documents for supporting or contradicting evidence:
- Air (A): Do mechanical drawings show filtration MERV rating, ventilation rates, or combustion appliances? Does an IAQ report show pollutant levels?
- Water (W): Do plumbing drawings show point-of-use filtration, drinking water access, or cooling tower? Does a water test report exist?
- Nourishment (N): Does a floor plan show a cafeteria, food prep area, or vending location?
- Light (L): Does a floor plan or lighting plan show window layout, glazing type, circadian lighting fixtures, or daylight sensors?
- Movement (V): Does a floor plan show stair design, fitness room, shower/changing facilities, or outdoor access? Is the stair prominent and inviting?
- Thermal Comfort (T): Do mechanical drawings show radiant systems, individual zone controls, or humidity management equipment?
- Sound (S): Do acoustic plans or specs show sound isolation, background noise targets, or acoustic treatment?
- Materials (X): Do specs include a cleaning products policy, hazardous material survey, or IPM policy?
- Mind (M): Does a floor plan show biophilic elements (green walls, water features, views to nature), wellness rooms, or meditation spaces?
- Community (C): Do drawings show universal design features (accessible routes, inclusive spaces) or dedicated community areas?

When documents provide evidence:
1. Reference it explicitly in the feature assessment ("Floor plan shows dedicated wellness room on level 3", "Mechanical drawing confirms MERV-13 filtration")
2. Update the precondition status or readiness badge if the document shows stronger readiness than the questionnaire indicated
3. If a document contradicts a questionnaire answer, trust the document and note the discrepancy

After the Executive Summary, include a "Document Findings" section (REQUIRED when documents are attached) that lists what each document revealed and how it changed or confirmed the analysis.` : "No documents were attached. Omit the Document Findings section."}

IMPORTANT CONSTRAINTS:
- Do NOT give compliance thresholds, measurement protocols, or detailed technical requirements
- Do NOT say "contact us" or mention support
- Do NOT fabricate data not in the questionnaire
- Keep rationale to 1\u20132 sentences per feature
- Be specific about this project \u2014 reference actual answers from the questionnaire
- Tone: knowledgeable WELL consultant \u2014 precise, health-focused, action-oriented`;
}
var init_gap_analysis_well_v2 = __esm({
  "pipeline/prompts/gap-analysis-well-v2.ts"() {
    "use strict";
  }
});

// pipeline/prompts/gap-analysis-well-hsr.ts
function buildWellHsrGapAnalysisPrompt(params) {
  const r = params.responses;
  const docs = params.documentContext;
  const docCount = params.documentCount ?? 0;
  return `You are a WELL Health-Safety Rating (HSR) consultant producing a Gap Analysis Report for a building operations team.

Your output is a complete, standalone HTML document using the Liminal design system CSS classes. Do not include <html>, <head>, or <body> tags \u2014 output the body content only, starting with the page-header div.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
BUILDING DATA (from intake questionnaire)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Building name:        ${r.buildingName || "Not provided"}
Address:              ${r.buildingAddress || "Not provided"}
Building type:        ${r.buildingType || "Not specified"}
GFA:                  ${r.gfa ? `${parseInt(r.gfa).toLocaleString()} SF` : "Not provided"}
Regular occupants:    ${r.regularOccupants || "Not provided"}
Management type:      ${r.managementType || "Not specified"}
Existing or new:      ${r.existingOrNew || "Not specified"}
Previous HSR cert:    ${r.previousCertification || "Unknown"}

CLEANING & SANITIZATION (SC)
Cleaning frequency:            ${r.cleaningFrequency || "Unknown"}
Cleaning products:             ${r.cleaningProducts || "Unknown"}
Protocols documented:          ${r.cleaningProtocolsDocumented || "Unknown"}
Handwashing support:           ${r.handwashingSupport || "Unknown"}
Hand sanitizer dispensers:     ${r.handSanitizerDispensers || "Unknown"}
Cleaning staff trained:        ${r.cleaningStaffTrained || "Unknown"}

EMERGENCY PREPAREDNESS (SE)
Emergency plan:                ${r.emergencyPlan || "Unknown"}${r.emergencyPlanUpdated ? `
Last updated: ${r.emergencyPlanUpdated}` : ""}
Staff trained:                 ${r.emergencyTraining || "Unknown"}
Response team / wardens:       ${r.emergencyResponseTeam || "Unknown"}
Emergency supplies:            ${r.emergencySupplies || "Unknown"}
Business continuity plan:      ${r.businessContinuityPlan || "Unknown"}

HEALTH SERVICES (SH)
AEDs installed:                ${r.aeds || "Unknown"}
First aid kits:                ${r.firstAidKits || "Unknown"}
Health clinic on-site:         ${r.healthClinic || "Unknown"}
CPR-trained staff:             ${r.cprTrainedStaff || "Unknown"}
Mental health resources:       ${r.mentalHealthResources || "Unknown"}

AIR QUALITY (SA)
HVAC filtration:               ${r.hvacFiltration || "Unknown"}
HVAC maintenance schedule:     ${r.hvacMaintenanceSchedule || "Unknown"}
Outdoor air compliance:        ${r.outdoorAirCompliance || "Unknown"}
Smoking prohibited:            ${r.smokingProhibited || "Unknown"}
IAQ monitoring:                ${r.iaqMonitoring || "Unknown"}
Combustion in spaces:          ${r.combustionInSpaces || "Unknown"}

WATER QUALITY (SS)
Water supply:                  ${r.waterSupply || "Unknown"}
Last water test:               ${r.lastWaterTest || "Unknown"}
Water management plan:         ${r.waterManagementPlan || "Unknown"}
Cooling tower:                 ${r.coolingTower || "Unknown"}
Drinking water filters:        ${r.drinkingWaterFilters || "Unknown"}

STAKEHOLDER ENGAGEMENT (SI)
Occupant communications:       ${r.occupantCommunications || "Unknown"}
Feedback mechanism:            ${r.occupantFeedbackMechanism || "Unknown"}
Occupant surveys:              ${r.occupantSurveys || "Unknown"}
Wellness programs:             ${r.wellnessPrograms || "Unknown"}
Wellness champion:             ${r.wellnessChampion || "Unknown"}
HSR communicated publicly:     ${r.hsrCommunicated || "Unknown"}
${r.projectNarrative ? `
PROJECT NARRATIVE (owner-provided \u2014 use this to supplement the above data):
${r.projectNarrative}` : ""}
${docCount > 0 ? `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
UPLOADED DOCUMENTS \u2014 EXAMINE BEFORE WRITING THE REPORT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${docCount} document file(s) are attached as PDFs. Visually read every page now, before generating the report.

For each document, look for evidence relevant to HSR concepts:
- Floor plans: AED cabinet locations, first aid station locations, restroom locations, janitor/cleaning closets, emergency exit routes, common areas, wellness rooms
- Mechanical/HVAC drawings: equipment type, filtration units, ventilation strategy, combustion appliances, outdoor air intakes
- Plumbing drawings: water supply type, filtration systems, cooling tower presence, drinking water points
- Operational documents: cleaning protocols, maintenance logs, training records, emergency plans, warden lists, occupant communication samples
- Reports/certifications: water test results, IAQ monitoring data, previous WELL/LEED certifications, inspection records

${docs ? `Extracted text (supplement to visual reading):
${docs}` : ""}` : "No documents were uploaded. Base analysis on questionnaire responses only."}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
OUTPUT INSTRUCTIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Produce a WELL HSR Gap Analysis Report as HTML. This is an OPERATIONAL READINESS REPORT \u2014 it assesses current building practices against HSR requirements, identifies gaps, and recommends specific feature services to pursue. It is NOT a compliance guide and must NOT explain in detail how to achieve each feature.

The WELL HSR uses a point-based system with a 100-point threshold to achieve the rating. Features are worth 1\u20133 points each. The report should assess readiness and estimate a likely current score range.

DESIGN RULES:
- Use Liminal CSS classes throughout
- Use result-pass for features where current practice already meets requirements
- Use result-warn for features needing moderate improvement
- Use result-fail for significant gaps or missing requirements
- Use badge-provided for "MEETS REQUIREMENT", badge-required for "PURSUE", badge-incomplete for "GAP IDENTIFIED"

REPORT STRUCTURE:

1. PAGE HEADER
   <div class="page-header">
     <h1>WELL Health-Safety Rating Gap Analysis</h1>
     <div class="sub">[Building name] \xB7 [Address] \xB7 [Building type]</div>
   </div>

2. META BAR \u2014 show: Building Type, Occupants, Management Type, Existing/New

3. EXECUTIVE SUMMARY
   - Current readiness assessment (2\u20133 sentences based on questionnaire)
   - Estimated current score range out of 100 (e.g., "Estimated current position: 45\u201355 points")
   - The 100-point threshold is required for HSR achievement
   - Identify the 2 strongest concepts and 2 largest gaps
   - Use point-box for the estimate

4. CONCEPT ASSESSMENTS \u2014 one section per HSR concept.
   For each concept, assess current status and recommend specific features.
   For each feature:
   - Feature name and code (e.g., "SC01: Cleaning and Disinfection Protocols")
   - Current status based on questionnaire answers (be specific \u2014 reference actual answers)
   - Gap identified (what's missing or needs improvement) \u2014 1 sentence max
   - Badge: badge-provided (likely meets requirement), badge-required (pursue), badge-incomplete (significant gap)
   - Points available in brackets
   - Do NOT detail the compliance requirement or how to achieve it

   Concepts to cover:
   - Cleaning & Sanitization (SC) \u2014 cleaning frequency, products, protocols, handwashing, training
   - Emergency Preparedness (SE) \u2014 emergency plan, training, response team, supplies, business continuity
   - Health Services (SH) \u2014 AEDs, first aid, health clinic, CPR training, mental health
   - Air Quality (SA) \u2014 filtration, maintenance, outdoor air, smoking, IAQ monitoring, combustion
   - Water Quality (SS) \u2014 supply, testing, management plan, cooling tower, drinking water filters
   - Stakeholder Engagement (SI) \u2014 communications, feedback, surveys, wellness programs, HSR visibility

5. SCORE ESTIMATE TABLE
   Table: Concept | Features Likely Met | Features with Gaps | Est. Points Available
   Show total row with estimated current position vs. 100-point threshold.
   Add a note that exact scoring requires formal documentation review.

6. RECOMMENDED SERVICES SECTION (section-header: "Recommended HSR Feature Services")
   <div class="info-box">
     <strong>Based on this gap analysis, the following WELL HSR feature services are recommended to close identified gaps and achieve the 100-point threshold.</strong>
     Each service includes a complete feature submission package \u2014 compliance documentation, operational policy templates, and IWBI submission guidance.
   </div>
   List each recommended feature service as a checklist-item, prioritized by impact (highest gap \u2192 highest priority).

7. STRUCTURED DATA BLOCK \u2014 after the full HTML report, output a machine-readable JSON block exactly like this (use these exact delimiter lines):

===GAP_ANALYSIS_DATA_START===
{
  "program": "well_hsr",
  "overall_score": <integer \u2014 estimated current points out of 35>,
  "target_score": 25,
  "max_possible": 35,
  "concepts": [
    { "name": "Cleaning & Sanitization (SC)", "score": <int>, "max": 7, "recommended": ["<code>", ...] },
    { "name": "Emergency Preparedness (SE)",  "score": <int>, "max": 7, "recommended": [] },
    { "name": "Health Services (SH)",         "score": <int>, "max": 6, "recommended": [] },
    { "name": "Air Quality (SA)",             "score": <int>, "max": 7, "recommended": [] },
    { "name": "Water Quality (SS)",           "score": <int>, "max": 4, "recommended": [] },
    { "name": "Stakeholder Engagement (SI)",  "score": <int>, "max": 7, "recommended": [] }
  ]
}
===GAP_ANALYSIS_DATA_END===

Fill in actual estimated scores. "recommended" should list HSR feature codes you recommend (e.g. "SC3", "SE2"). 25 points is required for the HSR.

DOCUMENT USAGE \u2014 MANDATORY:
${docCount > 0 ? `Documents are attached. You MUST actively use what you see in them. Do not produce an analysis based solely on questionnaire answers when documents are present.

For every HSR concept, check the documents for supporting or contradicting evidence:
- SC (Cleaning): Does a protocol document show cleaning frequency, products, or staff training? Does a floor plan show cleaning station or janitor closet locations?
- SE (Emergency): Does an emergency plan document exist? Does a floor plan show exit routes, warden stations, or AED/defibrillator locations?
- SH (Health Services): Does a floor plan confirm AED cabinet placement? Are first aid kit records or inspection tags visible?
- SA (Air Quality): Do mechanical drawings show filtration type, HVAC equipment, or outdoor air systems? Does a maintenance log show filter change schedule?
- SS (Water Quality): Does a water test report show results and date? Do plumbing drawings show filtration units or cooling tower?
- SI (Stakeholder Engagement): Are occupant communication samples, survey forms, or wellness program materials present?

When documents provide evidence:
1. Reference it explicitly in the concept assessment ("Floor plan shows AED cabinet on each floor", "Water test report dated [date] confirms...")
2. Upgrade the readiness badge if the document supports a stronger assessment than the questionnaire alone
3. If a document contradicts a questionnaire answer, trust the document and note the discrepancy

After the Executive Summary, include a "Document Findings" section (REQUIRED when documents are attached) that lists what each document revealed and how it changed or confirmed the analysis.` : "No documents were attached. Omit the Document Findings section."}

IMPORTANT CONSTRAINTS:
- Do NOT explain HSR scoring thresholds or feature-level compliance requirements in detail
- Do NOT say "contact us" or mention support
- Do NOT fabricate data not in the questionnaire
- Reference actual questionnaire answers throughout \u2014 be specific, not generic
- Tone: operational building consultant \u2014 practical, compliance-aware, action-focused
- Prioritize features where questionnaire answers show clear gaps`;
}
var init_gap_analysis_well_hsr = __esm({
  "pipeline/prompts/gap-analysis-well-hsr.ts"() {
    "use strict";
  }
});

// src/lib/resend.ts
var resend_exports = {};
__export(resend_exports, {
  sendAddressInvalidEmail: () => sendAddressInvalidEmail,
  sendCustomerDelayEmail: () => sendCustomerDelayEmail,
  sendDeletionWarningEmail: () => sendDeletionWarningEmail,
  sendDocumentsRequestedEmail: () => sendDocumentsRequestedEmail,
  sendFeedbackEmail: () => sendFeedbackEmail,
  sendGapAnalysisDeliveryEmail: () => sendGapAnalysisDeliveryEmail,
  sendOutputDeliveryEmail: () => sendOutputDeliveryEmail,
  sendProcessingStartedEmail: () => sendProcessingStartedEmail,
  sendProjectInviteEmail: () => sendProjectInviteEmail,
  sendQAReviewEmail: () => sendQAReviewEmail,
  sendUploadConfirmationEmail: () => sendUploadConfirmationEmail,
  sendWelcomeEmail: () => sendWelcomeEmail
});
function getResend() {
  if (!_resend) {
    _resend = new import_resend.Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
function FROM() {
  return process.env.RESEND_FROM_EMAIL ?? "noreply@liminalsva.com";
}
function APP() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://liminalsva.com";
}
async function sendWelcomeEmail({ to, name }) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: "Welcome to Liminal",
    html: `
      <h1>Welcome, ${name}!</h1>
      <p>Your LIMINALsva account is ready. Start by creating your first certification project.</p>
      <p><a href="${APP()}/dashboard">Go to Dashboard \u2192</a></p>
    `
  });
}
async function sendUploadConfirmationEmail({
  to,
  name,
  creditName,
  orderId,
  fileCount
}) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Upload received \u2014 ${creditName}`,
    html: `
      <h1>We received your documents</h1>
      <p>Hi ${name},</p>
      <p>We received <strong>${fileCount} file(s)</strong> for <strong>${creditName}</strong>.</p>
      <p>When you're ready to submit for review, click the button below.</p>
      <p><a href="${APP()}/orders/${orderId}">Review and Submit \u2192</a></p>
    `
  });
}
async function sendDocumentsRequestedEmail({
  to,
  name,
  creditName,
  orderId,
  issues
}) {
  const issueList = issues.map((i) => `<li>${i}</li>`).join("\n");
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Action required \u2014 ${creditName}`,
    html: `
      <h1>Additional documents needed</h1>
      <p>Hi ${name},</p>
      <p>We reviewed your submission for <strong>${creditName}</strong> and need the following before we can proceed:</p>
      <ul>${issueList}</ul>
      <p>Please upload the corrected documents and mark your submission as ready again.</p>
      <p><a href="${APP()}/orders/${orderId}/upload">Upload Documents \u2192</a></p>
    `
  });
}
async function sendProcessingStartedEmail({
  to,
  name,
  creditName
}) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Processing your submission \u2014 ${creditName}`,
    html: `
      <h1>Your submission is being processed</h1>
      <p>Hi ${name},</p>
      <p>We are now generating your <strong>${creditName}</strong> submission package.</p>
      <p>You'll receive an email with download links when it's ready \u2014 typically within a few minutes.</p>
    `
  });
}
async function sendOutputDeliveryEmail({
  to,
  name,
  creditName,
  orderId,
  outputPaths
}) {
  const links = outputPaths.map((p) => {
    const filename2 = p.split("/").pop() ?? p;
    const isEditable = filename2.includes("editable");
    const label = isEditable ? `${filename2} <span style="color:#388fa6;font-size:12px;">(editable version)</span>` : filename2;
    return `<li style="margin-bottom:6px;"><a href="${APP()}/orders/${orderId}/download?path=${encodeURIComponent(p)}">${label}</a></li>`;
  }).join("\n");
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Your ${creditName} submission is ready`,
    html: `
      <h1>Your submission package is ready</h1>
      <p>Hi ${name},</p>
      <p>Your <strong>${creditName}</strong> submission documents are ready for download:</p>
      <ul>${links}</ul>
      <p style="background:#f5f5f5;padding:12px 16px;border-left:3px solid #327cb9;font-size:14px;">
        Your output is delivered as editable files. Open either in any browser.
        Use the <strong>editable version</strong> to make changes directly in your browser,
        then save as a PDF using <strong>File &rarr; Print &rarr; Save as PDF</strong>.
      </p>
      <p>Your submitted project documents will be deleted from our servers within 48 hours. Your output files are retained permanently in your dashboard.</p>
      <p><a href="${APP()}/orders/${orderId}/delivery">View Output \u2192</a></p>
    `
  });
}
async function sendDeletionWarningEmail({
  to,
  name,
  creditName,
  orderId
}) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Action required \u2014 download your ${creditName} files before they expire`,
    html: `
      <h1>Uploaded documents expiring in 48 hours</h1>
      <p>Hi ${name},</p>
      <p>This is a reminder that the project documents you uploaded for <strong>${creditName}</strong> will be automatically deleted from our servers in 48 hours as part of our privacy policy.</p>
      <p>Your output files are not affected and remain available in your dashboard.</p>
      <p><a href="${APP()}/orders/${orderId}/delivery">View Output \u2192</a></p>
    `
  });
}
async function sendQAReviewEmail({
  customerName,
  customerEmail,
  creditName,
  projectName,
  orderId,
  generatedAt,
  deliveryScheduledAt,
  standardHtmlUrl,
  editableHtmlUrl,
  approveUrl,
  requestChangesUrl,
  isRegeneration = false,
  changeInstructions
}) {
  const delivery = new Date(deliveryScheduledAt);
  const now = new Date(generatedAt);
  const msLeft = delivery.getTime() - now.getTime();
  const hLeft = Math.floor(msLeft / 36e5);
  const mLeft = Math.floor(msLeft % 36e5 / 6e4);
  const shortId = orderId.slice(0, 8).toUpperCase();
  const regenerationNote = isRegeneration ? `<div style="background:#fff8e1;border-left:3px solid #f5a623;padding:12px 16px;margin-bottom:16px;font-size:14px;">
        <strong>REGENERATED OUTPUT</strong> \u2014 Changes were requested and the pipeline has re-run.
        ${changeInstructions ? `<br><br><strong>Instructions applied:</strong><br><pre style="margin:8px 0 0;white-space:pre-wrap;font-size:13px;">${changeInstructions}</pre>` : ""}
       </div>` : "";
  return getResend().emails.send({
    from: FROM(),
    to: "reviews@liminalsva.com",
    subject: `QA Review Required \u2014 ${creditName} \u2014 ${projectName} \u2014 Order #${shortId}`,
    html: `
      <div style="font-family:sans-serif;max-width:680px;margin:0 auto;">
        <h2 style="margin-bottom:4px;">QA Review Required</h2>
        <p style="color:#666;margin-top:0;">${isRegeneration ? "Regenerated output ready for re-review." : "New output ready for review."}</p>

        ${regenerationNote}

        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:24px;">
          <tr><td style="padding:6px 12px 6px 0;color:#888;width:140px;">Customer</td><td style="padding:6px 0;">${customerName} &lt;${customerEmail}&gt;</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Credit</td><td style="padding:6px 0;">${creditName}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Project</td><td style="padding:6px 0;">${projectName}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Order ID</td><td style="padding:6px 0;font-family:monospace;">${orderId}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Generated</td><td style="padding:6px 0;">${new Date(generatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Auto-delivers</td><td style="padding:6px 0;">${delivery.toLocaleString("en-US", { timeZone: "America/New_York" })} ET <span style="color:#c0392b;font-weight:600;">(${hLeft}h ${mLeft}m remaining)</span></td></tr>
        </table>

        <h3 style="margin-bottom:8px;">Output Files</h3>
        <ul style="padding-left:20px;font-size:14px;line-height:2;">
          <li><a href="${standardHtmlUrl}" style="color:#388fa6;">Standard HTML Output</a> \u2014 submission.html</li>
          <li><a href="${editableHtmlUrl}" style="color:#388fa6;">Editable HTML Output</a> \u2014 submission-editable.html</li>
        </ul>

        <h3 style="margin-top:24px;margin-bottom:12px;">Actions</h3>
        <table style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:12px;">
              <a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#27ae60;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">APPROVE</a>
            </td>
            <td>
              <a href="${requestChangesUrl}" style="display:inline-block;padding:12px 24px;background:#e67e22;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">REQUEST CHANGES</a>
            </td>
          </tr>
        </table>

        <p style="font-size:12px;color:#aaa;margin-top:32px;">
          If no action is taken, output delivers automatically at ${delivery.toLocaleString("en-US", { timeZone: "America/New_York" })} ET.
          If changes were requested and not approved before that time, the customer receives a delay notice.
        </p>
      </div>
    `
  });
}
async function sendCustomerDelayEmail({
  to,
  name,
  creditName
}) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Your output for ${creditName} is being reviewed`,
    html: `
      <p>Hi ${name},</p>
      <p>We are completing a final review of your output before delivery. You will receive your files as soon as the review is complete. We apologize for any delay and appreciate your patience.</p>
    `
  });
}
async function sendAddressInvalidEmail({
  to,
  name,
  creditName,
  projectId,
  reason
}) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Action required \u2014 project address needs correction`,
    html: `
      <h1>Your project address could not be verified</h1>
      <p>Hi ${name},</p>
      <p>We were unable to process your <strong>${creditName}</strong> submission because the project address could not be verified:</p>
      <p style="background:#fff8e1;border-left:3px solid #f59e0b;padding:12px 16px;font-size:14px;">${reason}</p>
      <p>Please update your project address and resubmit. No additional charge will apply for this resubmission.</p>
      <p><a href="${APP()}/projects/${projectId}/edit">Update Project Address \u2192</a></p>
      <p style="font-size:12px;color:#888;">If you believe your address is correct, please reply to this email and we will investigate.</p>
    `
  });
}
async function sendFeedbackEmail({
  customerEmail,
  customerName,
  orderId,
  creditCode,
  creditName,
  useful,
  wouldUseAgain,
  whatWorked,
  whatToImprove
}) {
  return getResend().emails.send({
    from: FROM(),
    to: "support@liminalsva.com",
    subject: `Pilot feedback \u2014 ${creditCode} \u2014 ${useful}`,
    html: `
      <h2>Pilot Feedback</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tr><td style="padding:6px 12px;font-weight:700;color:#555;width:160px;">Customer</td><td style="padding:6px 12px;">${customerName} (${customerEmail})</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:6px 12px;font-weight:700;color:#555;">Order</td><td style="padding:6px 12px;">#${orderId.slice(-6).toUpperCase()} \u2014 ${creditCode} ${creditName}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:700;color:#555;">Was it useful?</td><td style="padding:6px 12px;">${useful}</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:6px 12px;font-weight:700;color:#555;">Use again?</td><td style="padding:6px 12px;">${wouldUseAgain}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:700;color:#555;vertical-align:top;">What worked</td><td style="padding:6px 12px;">${whatWorked || "\u2014"}</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:6px 12px;font-weight:700;color:#555;vertical-align:top;">Improve</td><td style="padding:6px 12px;">${whatToImprove || "\u2014"}</td></tr>
      </table>
      <p style="font-size:12px;color:#999;margin-top:16px;">Submitted ${(/* @__PURE__ */ new Date()).toLocaleString()}</p>
    `
  });
}
async function sendGapAnalysisDeliveryEmail({
  to,
  name,
  programLabel,
  orderId
}) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Your ${programLabel} Gap Analysis is ready`,
    html: `
      <h1>Your Gap Analysis Report is ready</h1>
      <p>Hi ${name},</p>
      <p>Your <strong>${programLabel} Gap Analysis</strong> has been completed. The report identifies your strongest credit opportunities and recommends a pursuit strategy tailored to your project.</p>
      <p>
        <a href="${APP()}/orders/${orderId}/gap-analysis-output" style="display:inline-block;padding:12px 24px;background:#327cb9;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
          View Report \u2192
        </a>
      </p>
      <p style="font-size:12px;color:#888;">Use the recommended credits in your report as a guide for your next steps. Order individual credit services from your project dashboard to get started.</p>
    `
  });
}
async function sendProjectInviteEmail({
  to,
  inviterName,
  projectName,
  inviteUrl
}) {
  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `${inviterName} invited you to ${projectName} on Liminal`,
    html: `
      <h1>You've been invited</h1>
      <p>${inviterName} has invited you to collaborate on <strong>${projectName}</strong>.</p>
      <a href="${inviteUrl}">Accept Invitation \u2192</a>
    `
  });
}
var import_resend, _resend;
var init_resend = __esm({
  "src/lib/resend.ts"() {
    "use strict";
    import_resend = require("resend");
    _resend = null;
  }
});

// pipeline/process-gap-analysis.ts
var process_gap_analysis_exports = {};
__export(process_gap_analysis_exports, {
  processGapAnalysis: () => processGapAnalysis
});
function gapUploadFolder(customerId, program, orderId, attempt) {
  return `${customerId}/gap-analysis/${program}/${orderId}/attempt-${attempt}`;
}
function gapOutputFolder(customerId, program, orderId) {
  return `${customerId}/gap-analysis/${program}/${orderId}/outputs`;
}
async function processGapAnalysis(orderId, runId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk.default({ apiKey, timeout: 6e5, maxRetries: 1 });
  const supabase = createServiceClient();
  console.log(`
[gap-analysis] \u25B6 Order ${orderId} / Run ${runId}`);
  const [runRes, orderRes] = await Promise.all([
    supabase.from("runs").select("*").eq("id", runId).single(),
    supabase.from("orders").select("*").eq("id", orderId).single()
  ]);
  if (runRes.error) throw new Error(`Run not found: ${runRes.error.message}`);
  if (orderRes.error) throw new Error(`Order not found: ${orderRes.error.message}`);
  const run = runRes.data;
  const order = orderRes.data;
  const program = order.gap_analysis_program ?? "leed_bd_c";
  const customerRes = await supabase.from("customers").select("*").eq("id", order.customer_id).single();
  if (customerRes.error) throw new Error(`Customer not found: ${customerRes.error.message}`);
  const customer = customerRes.data;
  console.log(`  Step 1: Order loaded \u2014 program=${program} customer=${customer.email}`);
  const { data: responseRow, error: responseError } = await supabase.from("gap_analysis_responses").select("responses").eq("customer_id", order.customer_id).eq("program", program).order("created_at", { ascending: false }).limit(1).single();
  if (responseError || !responseRow) {
    console.warn(`  Step 2: No questionnaire responses found for customer=${order.customer_id} program=${program}`);
  }
  const responses = responseRow?.responses ?? {};
  console.log(`  Step 2: Questionnaire responses loaded \u2014 ${Object.keys(responses).length} fields`);
  await supabase.from("orders").update({ status: "under_review" }).eq("id", orderId);
  console.log(`  Step 3: Order \u2192 under_review`);
  const attemptNumber = run.attempt_number ?? run.run_number ?? 1;
  const uploadsFolder = gapUploadFolder(order.customer_id, program, orderId, attemptNumber);
  const { data: storageFiles } = await supabase.storage.from(UPLOADS_BUCKET).list(uploadsFolder);
  const uploads = (storageFiles ?? []).filter((f) => f.name && !f.name.endsWith("/")).map((f) => ({ path: `${uploadsFolder}/${f.name}`, name: f.name }));
  console.log(`  Step 4: Found ${uploads.length} uploaded file(s)`);
  let documentContext = "";
  const documentBlocks = [];
  for (const upload of uploads) {
    try {
      const { data: fileData } = await supabase.storage.from(UPLOADS_BUCKET).download(upload.path);
      if (!fileData) continue;
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const isPdf = upload.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        documentBlocks.push(preparePdfDocument(buffer, upload.name));
        const result = await extractPdfContentFromBuffer(
          client2,
          buffer,
          upload.name,
          "Extract all text content from this document. Return the full text."
        );
        if (result?.text?.trim()) {
          documentContext += `
--- ${upload.name} ---
${result.text.slice(0, 8e3)}
`;
        }
      }
    } catch (err) {
      console.warn(`  Step 5: Failed to process ${upload.name}: ${err.message}`);
    }
  }
  console.log(`  Step 5: ${documentBlocks.length} document block(s) prepared, ${documentContext.length} chars extracted`);
  const promptFn = program === "well_v2" ? buildWellV2GapAnalysisPrompt : program === "well_hsr" ? buildWellHsrGapAnalysisPrompt : buildLeedGapAnalysisPrompt;
  const prompt = promptFn({ responses, documentContext, documentCount: documentBlocks.length });
  console.log(`  Step 6: Prompt built \u2014 ${prompt.length} chars, ${documentBlocks.length} visual block(s)`);
  ;
  console.log(`  Step 7: Calling Claude...`);
  const message = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 32e3,
    messages: [
      {
        role: "user",
        content: documentBlocks.length > 0 ? [...documentBlocks, { type: "text", text: prompt }] : prompt
      }
    ]
  });
  const fullOutput = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  console.log(`  Step 7: Claude returned ${fullOutput.length} chars`);
  if (fullOutput.length < 200) {
    throw new Error(`Gap analysis output too short (${fullOutput.length} chars) \u2014 likely a prompt failure`);
  }
  let gapAnalysisResults = null;
  const dataMatch = fullOutput.match(/===GAP_ANALYSIS_DATA_START===([\s\S]*?)===GAP_ANALYSIS_DATA_END===/);
  if (dataMatch?.[1]) {
    try {
      gapAnalysisResults = JSON.parse(dataMatch[1].trim());
      console.log(`  Step 7b: Parsed gap analysis data \u2014 program=${gapAnalysisResults?.program}`);
    } catch (e) {
      console.warn(`  Step 7b: Failed to parse gap analysis data: ${e.message}`);
    }
  } else {
    console.warn(`  Step 7b: No GAP_ANALYSIS_DATA block found in response`);
  }
  const rawHtml = fullOutput.replace(/===GAP_ANALYSIS_DATA_START===[\s\S]*?===GAP_ANALYSIS_DATA_END===/g, "").trim();
  const programLabel = PROGRAM_LABELS[program] ?? program;
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${programLabel} Gap Analysis</title>
</head>
<body>
${rawHtml}
</body>
</html>`;
  const standardHtml = injectTableCss(fullHtml);
  const editableHtml = makeEditable(fullHtml);
  const outputFolder = gapOutputFolder(order.customer_id, program, orderId);
  const htmlPath = `${outputFolder}/gap-analysis.html`;
  const editablePath = `${outputFolder}/gap-analysis-editable.html`;
  const [uploadStd, uploadEdit] = await Promise.all([
    supabase.storage.from(OUTPUTS_BUCKET).upload(
      htmlPath,
      new Blob([standardHtml], { type: "text/html" }),
      { upsert: true }
    ),
    supabase.storage.from(OUTPUTS_BUCKET).upload(
      editablePath,
      new Blob([editableHtml], { type: "text/html" }),
      { upsert: true }
    )
  ]);
  if (uploadStd.error) console.error(`  Step 9: standard upload failed: ${uploadStd.error.message}`);
  if (uploadEdit.error) console.error(`  Step 9: editable upload failed: ${uploadEdit.error.message}`);
  console.log(`  Step 9: Outputs uploaded`);
  const TTL = 7 * 24 * 3600;
  const [signedStd, signedEdit] = await Promise.all([
    supabase.storage.from(OUTPUTS_BUCKET).createSignedUrl(htmlPath, TTL),
    supabase.storage.from(OUTPUTS_BUCKET).createSignedUrl(editablePath, TTL)
  ]);
  await supabase.from("runs").update({
    status: "completed",
    completed_at: (/* @__PURE__ */ new Date()).toISOString(),
    output_html_path: htmlPath
  }).eq("id", runId);
  await supabase.from("orders").update({
    status: "complete",
    delivered_at: (/* @__PURE__ */ new Date()).toISOString(),
    gap_analysis_results: gapAnalysisResults ?? void 0
  }).eq("id", orderId);
  console.log(`  Step 12: Order \u2192 complete`);
  try {
    const programLabels = {
      leed_bd_c: "LEED BD+C v4.1",
      well_v2: "WELL v2",
      well_hsr: "WELL Health-Safety Rating"
    };
    await sendGapAnalysisDeliveryEmail({
      to: customer.email,
      name: customer.name ?? customer.email,
      programLabel: programLabels[program] ?? program,
      orderId
    });
    console.log(`  Step 13: Completion email sent to ${customer.email}`);
  } catch (emailErr) {
    console.warn(`  Step 13: Email send failed: ${emailErr.message}`);
  }
  console.log(`[gap-analysis] \u2713 Complete`);
  return { status: "complete" };
}
var import_sdk, UPLOADS_BUCKET, OUTPUTS_BUCKET, PROGRAM_LABELS;
var init_process_gap_analysis = __esm({
  "pipeline/process-gap-analysis.ts"() {
    "use strict";
    import_sdk = __toESM(require("@anthropic-ai/sdk"));
    init_supabase();
    init_make_editable();
    init_pdf_extract();
    init_pdf_to_images();
    init_gap_analysis_leed();
    init_gap_analysis_well_v2();
    init_gap_analysis_well_hsr();
    init_resend();
    UPLOADS_BUCKET = "customer-uploads";
    OUTPUTS_BUCKET = "order-outputs";
    PROGRAM_LABELS = {
      leed_bd_c: "LEED BD+C v4.1",
      well_v2: "WELL v2",
      well_hsr: "WELL Health-Safety Rating"
    };
  }
});

// pipeline/lib/extract-xlsx-row.ts
function creditCodeNeedles(code) {
  const lower = code.toLowerCase();
  const m = code.match(/^([A-Za-z]+)(c|p)(\d+)?$/i);
  if (m) {
    const prefix = m[1].toLowerCase();
    const type = m[2].toLowerCase() === "c" ? "credit" : "prereq";
    const num = m[3] ?? "";
    const xlsxFmt = num ? `${prefix} ${type} ${num}` : `${prefix} ${type}`;
    return [xlsxFmt, lower];
  }
  return [lower];
}
function parseList(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
}
function parseRows(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows2 = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = rows2[1].map((h) => String(h ?? "").replace(/\n/g, " ").trim());
  return { rows: rows2, headers };
}
function loadWorkbook(program = "leed_bdc_v41") {
  const xlsxPath = path2.join(process.cwd(), AUTOMATION_XLSX_BY_PROGRAM[program] ?? AUTOMATION_XLSX_BY_PROGRAM.leed_bdc_v41);
  if (!fs3.existsSync(xlsxPath)) {
    throw new Error(`Automation analysis XLSX not found: ${xlsxPath}`);
  }
  console.log(`  [loadWorkbook] reading file from disk: ${xlsxPath}`);
  const buf = fs3.readFileSync(xlsxPath);
  console.log(`  [loadWorkbook] file read complete \u2014 ${buf.length} bytes \u2014 parsing XLSX...`);
  const result = parseRows(buf);
  console.log(`  [loadWorkbook] XLSX parse complete \u2014 ${result.rows.length} rows`);
  return result;
}
function extractCreditData(creditCode, program = "leed_bdc_v41") {
  const { rows: rows2 } = loadWorkbook(program);
  const needles = creditCodeNeedles(creditCode);
  const dataRow = rows2.slice(2).find((row) => {
    const name = String(row[COL.creditName] ?? "").toLowerCase();
    const num = String(row[COL.creditNumber] ?? "").toLowerCase();
    return needles.some((n) => name.includes(n) || num.includes(n));
  });
  if (!dataRow) {
    throw new Error(`Credit "${creditCode}" not found in automation analysis spreadsheet (tried: ${needles.join(", ")})`);
  }
  const get = (col) => String(dataRow[col] ?? "").trim();
  return {
    creditNumber: get(COL.creditNumber),
    creditName: get(COL.creditName),
    ptsAvailable: get(COL.ptsAvailable),
    automatable: get(COL.automatable),
    docTier: get(COL.docTier),
    customerUploads: parseList(get(COL.customerUploads)),
    claudeRetrieves: parseList(get(COL.claudeRetrieves)),
    platformFiles: {
      formLink: get(COL.formLink) || null,
      calculatorInfo: get(COL.calculatorInfo) || null
    },
    outputs: parseList(get(COL.claudeOutputs)),
    gbciVerification: get(COL.gbciVerification),
    blockerNotes: get(COL.blockerNotes)
  };
}
function formatCreditDataForPrompt(data2) {
  const lines = [
    `Credit: ${data2.creditNumber} \u2014 ${data2.creditName}`,
    `Automatable: ${data2.automatable} | Tier: ${data2.docTier}`,
    "",
    "DOCUMENTS TO COLLECT FROM PROJECT TEAM:",
    ...data2.customerUploads.map((d) => `  - ${d}`),
    "",
    "DOCUMENTS CLAUDE RETRIEVES AUTOMATICALLY:",
    ...data2.claudeRetrieves.map((d) => `  - ${d}`),
    "",
    "OUTPUTS TO GENERATE FOR THIS CREDIT:",
    ...data2.outputs.map((o) => `  - ${o}`),
    "",
    `LEED Online Form: ${data2.platformFiles.formLink ?? "N/A"}`,
    ...data2.platformFiles.calculatorInfo ? [`Calculator: ${data2.platformFiles.calculatorInfo}`] : [],
    ...data2.blockerNotes ? [`Notes: ${data2.blockerNotes}`] : []
  ];
  return lines.join("\n");
}
var XLSX, fs3, path2, AUTOMATION_XLSX_BY_PROGRAM, COL;
var init_extract_xlsx_row = __esm({
  "pipeline/lib/extract-xlsx-row.ts"() {
    "use strict";
    XLSX = __toESM(require("xlsx"));
    fs3 = __toESM(require("fs"));
    path2 = __toESM(require("path"));
    AUTOMATION_XLSX_BY_PROGRAM = {
      leed_bdc_v41: "pipeline/reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx",
      well_v2: "pipeline/reference/well-v2/WELL_v2_Automation_Analysis_v4.xlsx",
      well_hsr: "pipeline/reference/well-hsr/WELL_HSR_Automation_Analysis_v3.xlsx"
    };
    COL = {
      creditNumber: 0,
      creditName: 1,
      ptsAvailable: 2,
      ptsAuto: 3,
      automatable: 4,
      docTier: 5,
      allDocuments: 6,
      // full combined list
      customerUploads: 7,
      // Column 1: Project Team Must Upload
      claudeRetrieves: 8,
      // Column 2: Claude Auto-Retrieves
      claudeOutputs: 9,
      // Column 4: Outputs Generated
      gbciVerification: 10,
      blockerNotes: 11,
      formLink: 12,
      // Column 3 partial: LEED Online Form Link
      calculatorInfo: 13
      // Column 3 partial: Calculator / Worksheet
    };
  }
});

// pipeline/lib/supabase-ops.ts
async function logAuditEvent(event) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_log").insert({
    event_type: event.eventType,
    entity_type: event.entityType,
    entity_id: event.entityId,
    customer_id: event.customerId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: event.metadata ?? {}
  });
  if (error) {
    console.warn(`[audit] Failed to log ${event.eventType}: ${error.message}`);
  }
}
var init_supabase_ops = __esm({
  "pipeline/lib/supabase-ops.ts"() {
    "use strict";
    init_supabase();
  }
});

// pipeline/document-review.ts
async function reviewDocument(client2, requiredDocumentDescription, fileBuffer, filename2) {
  const isPdf = filename2.toLowerCase().endsWith(".pdf");
  const contentBlocks = isPdf ? [
    preparePdfDocument(fileBuffer, filename2),
    {
      type: "text",
      text: `Required document type: ${requiredDocumentDescription}

Review this document and return the JSON assessment.`
    }
  ] : [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: fileBuffer.toString("base64")
      }
    },
    {
      type: "text",
      text: `Required document type: ${requiredDocumentDescription}

Review this document and return the JSON assessment.`
    }
  ];
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: DOCUMENT_REVIEW_PROMPT,
    messages: [{ role: "user", content: contentBlocks }]
  });
  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const json = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(json);
  } catch {
    console.warn(`  \u26A0 Review response was not valid JSON for ${filename2}: ${rawText.slice(0, 200)}`);
    return { acceptable: false, issue: "Document review could not be completed \u2014 please re-upload." };
  }
}
function matchUploadToRequirement(requiredDescription, uploads) {
  const keywords = requiredDescription.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
  let bestMatch = null;
  let bestScore = 0;
  for (const upload of uploads) {
    const name = upload.filename.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    const score = keywords.filter((kw) => name.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = upload;
    }
  }
  return bestScore > 0 ? bestMatch : null;
}
async function reviewDocuments(orderId, customerId, creditCode, uploads, requiredDocs) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk2.default({ apiKey, timeout: 18e4, maxRetries: 0 });
  const supabase = createServiceClient();
  console.log(`[document-review] Order ${orderId} \u2014 ${creditCode} \u2014 ${uploads.length} upload(s)`);
  if (requiredDocs.length === 0) {
    console.log(`  No required documents defined for ${creditCode} \u2014 auto-passing review`);
    return {
      orderId,
      creditCode,
      status: "complete",
      issues: [],
      reviewedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  console.log(`  Required: ${requiredDocs.length} document(s) per automation analysis`);
  const issues = [];
  for (const requiredDoc of requiredDocs) {
    const matched = matchUploadToRequirement(requiredDoc, uploads);
    if (!matched) {
      console.log(`  \u2717 Missing: "${requiredDoc}"`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: null,
        issue: `Required document not uploaded: ${requiredDoc}`
      });
      continue;
    }
    const { data: data2, error } = await supabase.storage.from("customer-uploads").download(matched.storagePath);
    if (error || !data2) {
      console.warn(`  \u26A0 Failed to download ${matched.storagePath}: ${error?.message}`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: matched.filename,
        issue: "File could not be retrieved for review \u2014 please re-upload."
      });
      continue;
    }
    const buffer = Buffer.from(await data2.arrayBuffer());
    console.log(`  Reviewing "${matched.filename}" for: ${requiredDoc}`);
    const review = await reviewDocument(client2, requiredDoc, buffer, matched.filename);
    if (!review.acceptable) {
      console.log(`  \u2717 Issue: ${review.issue}`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: matched.filename,
        issue: review.issue ?? "Document did not pass review."
      });
    } else {
      console.log(`  \u2713 Accepted: "${matched.filename}"`);
    }
  }
  const status = issues.length === 0 ? "complete" : "incomplete";
  console.log(`  Review result: ${status} (${issues.length} issue(s))`);
  await logAuditEvent({
    eventType: "document_review_complete",
    entityType: "order",
    entityId: orderId,
    customerId,
    metadata: {
      creditCode,
      status,
      issueCount: issues.length,
      uploadCount: uploads.length,
      requiredCount: requiredDocs.length
    }
  });
  return {
    orderId,
    creditCode,
    status,
    issues,
    reviewedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var import_sdk2, path3, fs4, envPath, DOCUMENT_REVIEW_PROMPT;
var init_document_review = __esm({
  "pipeline/document-review.ts"() {
    "use strict";
    import_sdk2 = __toESM(require("@anthropic-ai/sdk"));
    path3 = __toESM(require("path"));
    fs4 = __toESM(require("fs"));
    init_supabase();
    init_pdf_to_images();
    init_supabase_ops();
    envPath = path3.resolve(__dirname, "../.env.local");
    if (fs4.existsSync(envPath)) {
      for (const line of fs4.readFileSync(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
    DOCUMENT_REVIEW_PROMPT = `You are a building certification specialist reviewing a document submitted by a project team. Your task is to assess whether this document is complete, legible, and appropriate for the stated purpose.

You will be told what document type is required. Review the provided file and determine:
1. Is this the correct document type?
2. Is it complete (not truncated, not blank, not corrupted)?
3. Is it legible and professionally prepared?
4. Does it contain the key information normally expected in this document type?

Respond with a single JSON object:
{
  "acceptable": boolean,
  "issue": string | null
}

Set "acceptable" to true if the document is suitable for certification submission.
Set "acceptable" to false and provide a concise "issue" string describing the specific problem.
The "issue" string must be written for the project team to read \u2014 be specific and actionable.
Return only the JSON object.`;
  }
});

// pipeline/drawing-review.ts
async function reviewDrawings(customerId, projectId, drawingPaths) {
  if (drawingPaths.length === 0) {
    return { acceptable: true, issues: [] };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk3.default({ apiKey, timeout: 18e4, maxRetries: 0 });
  const supabase = createServiceClient();
  console.log(`[drawing-review] Reviewing ${drawingPaths.length} drawing file(s)...`);
  const contentBlocks = [];
  for (const drawingPath of drawingPaths) {
    const { data: data2, error } = await supabase.storage.from("customer-uploads").download(drawingPath);
    if (error || !data2) {
      console.warn(`  [drawing-review] Failed to download ${drawingPath}: ${error?.message}`);
      continue;
    }
    const buffer = Buffer.from(await data2.arrayBuffer());
    const filename2 = drawingPath.split("/").pop() ?? "drawing.pdf";
    contentBlocks.push(preparePdfDocument(buffer, filename2));
    console.log(`  \u2713 loaded ${filename2}`);
  }
  if (contentBlocks.length === 0) {
    console.warn(`  [drawing-review] No files loaded \u2014 passing review to avoid blocking order`);
    return { acceptable: true, issues: [] };
  }
  contentBlocks.push({
    type: "text",
    text: "Review these drawing files and return the JSON assessment."
  });
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: DRAWING_REVIEW_PROMPT,
    messages: [{ role: "user", content: contentBlocks }]
  });
  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const json = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const result = JSON.parse(json);
    return {
      acceptable: result.acceptable === true,
      issues: Array.isArray(result.issues) ? result.issues : []
    };
  } catch {
    console.warn(`  [drawing-review] Response not valid JSON: ${rawText.slice(0, 200)} \u2014 passing review`);
    return { acceptable: true, issues: [] };
  }
}
var import_sdk3, DRAWING_REVIEW_PROMPT;
var init_drawing_review = __esm({
  "pipeline/drawing-review.ts"() {
    "use strict";
    import_sdk3 = __toESM(require("@anthropic-ai/sdk"));
    init_supabase();
    init_pdf_to_images();
    DRAWING_REVIEW_PROMPT = `You are a building certification specialist reviewing drawing files submitted by a project team. Assess whether these files are legible and usable for extracting basic building data needed for certification work.

Review the provided files and determine:
1. Are these recognizable as architectural, engineering, or construction drawings?
2. Are they legible \u2014 not excessively blurry, not corrupted, not blank?
3. Is at least one floor plan present?

Be lenient. Drawings do not need to be complete or stamped. Only flag genuine problems that would prevent extracting basic building information such as floor area, occupancy, or site data.

Respond with a single JSON object:
{
  "acceptable": boolean,
  "issues": string[]
}

Set "acceptable" to true if the drawings are usable.
Set "acceptable" to false and describe each specific problem in "issues". Write issues for the project team \u2014 be specific and actionable (e.g., "No floor plan found \u2014 please include architectural floor plan sheets").
Return only the JSON object.`;
  }
});

// pipeline/drawing-analysis.ts
async function analyzeDrawings(projectId, customerId, drawingPaths) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const supabase = createServiceClient();
  console.log(`[drawing-analysis] project=${projectId} drawings=${drawingPaths.length}`);
  const tmpDir = fs5.mkdtempSync(path4.join(os.tmpdir(), "certify-drawings-"));
  const localPaths = [];
  try {
    for (const drawingPath of drawingPaths) {
      const { data: data2, error } = await supabase.storage.from("customer-uploads").download(drawingPath);
      if (error || !data2) throw new Error(`Download failed: ${drawingPath} \u2014 ${error?.message}`);
      const filename2 = drawingPath.split("/").pop() ?? `drawing_${localPaths.length}.pdf`;
      const localPath = path4.join(tmpDir, filename2);
      fs5.writeFileSync(localPath, Buffer.from(await data2.arrayBuffer()));
      localPaths.push(localPath);
      console.log(`  \u2713 downloaded ${filename2}`);
    }
    const args = [
      PYTHON_SCRIPT,
      "--project-id",
      projectId,
      "--customer-id",
      customerId,
      "--output-dir",
      tmpDir,
      ...localPaths
    ];
    console.log(`  Running analyze_drawings.py (timeout ${TIMEOUT_MS / 1e3}s)...`);
    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(PYTHON_BIN, args, {
        timeout: TIMEOUT_MS,
        env: { ...process.env },
        maxBuffer: 50 * 1024 * 1024
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err) {
      stderr = err.stderr ?? "";
      stdout = err.stdout ?? "";
      if (stderr) console.error(`  [python stderr]
${stderr}`);
      throw new Error(`analyze_drawings.py failed: ${err.message}`);
    }
    if (stderr.trim()) console.warn(`  [python stderr]
${stderr.trim()}`);
    const resultMarker = "__RESULT__";
    const markerIdx = stdout.lastIndexOf(resultMarker);
    if (markerIdx === -1) throw new Error("analyze_drawings.py produced no __RESULT__ block");
    const logOutput = stdout.slice(0, markerIdx).trim();
    if (logOutput) console.log(logOutput);
    const summary = JSON.parse(stdout.slice(markerIdx + resultMarker.length).trim());
    if (!summary.success) throw new Error("analyze_drawings.py reported failure");
    const profileJson = fs5.readFileSync(summary.profile_path, "utf-8");
    const profileRemote = `${customerId}/${projectId}/project-profile.json`;
    const { error: profileUploadErr } = await supabase.storage.from("customer-uploads").upload(profileRemote, new Blob([profileJson], { type: "application/json" }), { upsert: true });
    if (profileUploadErr) throw new Error(`profile upload failed: ${profileUploadErr.message}`);
    console.log(`  \u2713 uploaded project-profile.json`);
    const annotatedRemotePaths = [];
    for (const localAnnotated of summary.annotated_pdfs) {
      const filename2 = path4.basename(localAnnotated);
      const remotePath = `${customerId}/${projectId}/outputs/${filename2}`;
      const pdfBytes = fs5.readFileSync(localAnnotated);
      const { error: pdfUploadErr } = await supabase.storage.from("customer-uploads").upload(remotePath, new Blob([pdfBytes], { type: "application/pdf" }), { upsert: true });
      if (pdfUploadErr) {
        console.warn(`  [WARN] annotated PDF upload failed: ${pdfUploadErr.message}`);
      } else {
        annotatedRemotePaths.push(remotePath);
        console.log(`  \u2713 uploaded ${filename2}`);
      }
    }
    const profile = JSON.parse(profileJson);
    const fixtures = profile.plumbing_fixtures ?? {};
    const parking = profile.parking ?? {};
    const site = profile.site ?? {};
    const tokenUsage = profile._token_usage;
    const updatePayload = {
      auto_extracted: true,
      flagged_fields: summary.flagged_fields,
      drawings_analyzed_at: (/* @__PURE__ */ new Date()).toISOString(),
      drawing_data: profile,
      ...profile.project_name ? { name: profile.project_name } : {},
      ...profile.project_address ? { address: profile.project_address } : {},
      ...profile.building_type ? { building_type: profile.building_type } : {},
      ...profile.primary_occupancy ? { primary_occupancy: profile.primary_occupancy } : {},
      ...fixtures ? { plumbing_fixtures: fixtures } : {},
      ...parking.total_spaces != null ? { total_parking: parking.total_spaces } : {},
      ...parking.accessible_spaces != null ? { accessible_parking: parking.accessible_spaces } : {},
      ...parking.bicycle_spaces != null ? { bicycle_parking: parking.bicycle_spaces } : {},
      ...site.site_area_sqft != null ? { site_area_sqft: site.site_area_sqft } : {},
      ...site.landscaping_area_sqft != null ? { landscaping_sqft: site.landscaping_area_sqft } : {},
      ...site.impervious_surface_sqft != null ? { impervious_sqft: site.impervious_surface_sqft } : {},
      ...site.building_footprint_sqft != null ? { building_footprint_sqft: site.building_footprint_sqft } : {}
    };
    const { error: updateErr } = await supabase.from("projects").update(updatePayload).eq("id", projectId);
    if (updateErr) throw new Error(`projects update failed: ${updateErr.message}`);
    console.log(`  \u2713 updated projects table`);
    await logAuditEvent({
      eventType: "drawing_analysis_complete",
      entityType: "project",
      entityId: projectId,
      customerId,
      metadata: {
        sheetsAnalyzed: summary.sheets_analyzed,
        flaggedFields: summary.flagged_fields,
        annotatedPdfs: annotatedRemotePaths.length,
        elapsedSeconds: summary.elapsed_seconds,
        inputTokens: tokenUsage?.input_tokens ?? 0,
        outputTokens: tokenUsage?.output_tokens ?? 0
      }
    });
    return {
      projectId,
      sheetsAnalyzed: summary.sheets_analyzed,
      flaggedFields: summary.flagged_fields,
      profilePath: profileRemote,
      annotatedPdfs: annotatedRemotePaths,
      tokenUsage: tokenUsage ?? { input_tokens: 0, output_tokens: 0 },
      elapsedSeconds: summary.elapsed_seconds
    };
  } finally {
    try {
      fs5.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
    }
  }
}
var path4, fs5, os, import_child_process, import_util, execFileAsync, PYTHON_SCRIPT, PYTHON_BIN, TIMEOUT_MS;
var init_drawing_analysis = __esm({
  "pipeline/drawing-analysis.ts"() {
    "use strict";
    path4 = __toESM(require("path"));
    fs5 = __toESM(require("fs"));
    os = __toESM(require("os"));
    import_child_process = require("child_process");
    import_util = require("util");
    init_supabase();
    init_supabase_ops();
    execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
    PYTHON_SCRIPT = path4.resolve(__dirname, "lib/analyze_drawings.py");
    PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
    TIMEOUT_MS = 18e4;
  }
});

// pipeline/lib/pipeline-utils.ts
async function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== void 0) clearTimeout(timer);
  }
}
async function axiosGetWithRetry(url, options = {}, timeoutMs = 1e4, label = "HTTP GET") {
  const opts = { ...options, timeout: timeoutMs };
  try {
    return await import_axios.default.get(url, opts);
  } catch (err) {
    console.warn(`  \u26A0 ${label} failed \u2014 retrying after 2 s: ${err.message}`);
    await new Promise((r) => setTimeout(r, 2e3));
    return import_axios.default.get(url, opts);
  }
}
var import_axios;
var init_pipeline_utils = __esm({
  "pipeline/lib/pipeline-utils.ts"() {
    "use strict";
    import_axios = __toESM(require("axios"));
  }
});

// pipeline/map-generation.ts
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 31) << shift;
      shift += 5;
    } while (b >= 32);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
async function getRoute(origin, dest, mode = "walking") {
  const key = MAPS_API_KEY();
  const res = await axiosGetWithRetry(
    "https://maps.googleapis.com/maps/api/directions/json",
    { params: { origin, destination: dest.address, mode, alternatives: false, key } },
    1e4,
    `Directions API (${mode}): ${dest.address}`
  );
  const data2 = res.data;
  if (data2.status !== "OK" || !data2.routes?.length) {
    console.warn(`  \u26A0 No route: ${origin} \u2192 ${dest.address} (${data2.status})`);
    return null;
  }
  const route = data2.routes[0];
  const leg = route.legs[0];
  const encodedPolyline = route.overview_polyline.points;
  return {
    destination: dest,
    distanceFeet: Math.round(leg.distance.value * 3.28084),
    distanceMiles: parseFloat((leg.distance.value / 1609.34).toFixed(2)),
    durationMinutes: Math.round(leg.duration.value / 60),
    encodedPolyline,
    polylinePoints: decodePolyline(encodedPolyline),
    originLatLng: { lat: leg.start_location.lat, lng: leg.start_location.lng },
    destLatLng: { lat: leg.end_location.lat, lng: leg.end_location.lng }
  };
}
async function getWalkingRoute(origin, dest) {
  return getRoute(origin, dest, "walking");
}
async function measureWalkingDistances(originAddress, destinations) {
  const routes = [];
  for (const dest of destinations) {
    const route = await getWalkingRoute(originAddress, dest);
    if (route) routes.push(route);
  }
  return routes;
}
async function fetchMapWithRoutes(routes, visibleCorners, imgWidth, imgHeight) {
  const key = MAPS_API_KEY();
  const scale2 = 2;
  const base = "https://maps.googleapis.com/maps/api/staticmap";
  const params = [
    `size=${imgWidth / scale2}x${imgHeight / scale2}`,
    `scale=${scale2}`,
    `maptype=roadmap`,
    `style=feature:poi|visibility:off`,
    `style=feature:transit|element:labels|visibility:off`,
    `key=${key}`
  ];
  for (const pt of visibleCorners) {
    params.push(`visible=${pt.lat},${pt.lng}`);
  }
  const origin = routes[0].originLatLng;
  params.push(`markers=color:0x2b4044|size:mid|label:S|${origin.lat},${origin.lng}`);
  for (const route of routes) {
    const label = route.destination.label.slice(0, 1);
    params.push(`markers=color:0x327cb9|size:mid|label:${label}|${route.destLatLng.lat},${route.destLatLng.lng}`);
  }
  for (const route of routes) {
    params.push(`path=color:0x327cb9CC|weight:4|enc:${encodeURIComponent(route.encodedPolyline)}`);
  }
  const url = `${base}?${params.join("&")}`;
  const res = await axiosGetWithRetry(url, { responseType: "arraybuffer" }, 1e4, "Static Maps API");
  return Buffer.from(res.data);
}
async function addCitationOverlay(imageBuffer, citationText, width, height) {
  const sharp2 = (await import("sharp")).default;
  const lines = citationText.split("\n");
  const lineH = 14;
  const padding = 6;
  const boxH = lines.length * lineH + padding * 2;
  const boxW = Math.max(...lines.map((l) => l.length)) * 6.5 + padding * 2;
  const boxX = width - boxW - 8;
  const boxY = height - boxH - 8;
  const textEls = lines.map(
    (line, i) => `<text x="${boxX + padding}" y="${boxY + padding + lineH * i + 10}"
           font-family="Arial, sans-serif" font-size="10" fill="#444444">${line}</text>`
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="3" fill="white" opacity="0.82"/>
    ${textEls}
  </svg>`;
  return sharp2(imageBuffer).resize(width, height, { fit: "cover" }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}
async function generateMap(request) {
  const WIDTH = 1200;
  const HEIGHT = 900;
  console.log(`[map-generation] ${request.mapType} \u2014 ${request.destinations.length} destination(s)`);
  const routes = [];
  for (const dest of request.destinations) {
    const route = await getWalkingRoute(request.originAddress, dest);
    if (route) routes.push(route);
  }
  if (routes.length === 0) throw new Error("No walking routes returned from Google Maps Directions API");
  const allPoints = routes.flatMap((r) => r.polylinePoints);
  allPoints.push(routes[0].originLatLng);
  routes.forEach((r) => allPoints.push(r.destLatLng));
  const lats = allPoints.map((p) => p.lat);
  const lngs = allPoints.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latPad = (maxLat - minLat) * 0.15;
  const lngPad = (maxLng - minLng) * 0.15;
  const visibleCorners = [
    { lat: minLat - latPad, lng: minLng - lngPad },
    { lat: minLat - latPad, lng: maxLng + lngPad },
    { lat: maxLat + latPad, lng: minLng - lngPad },
    { lat: maxLat + latPad, lng: maxLng + lngPad }
  ];
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  console.log(`  Center: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}  bounds: \xB1${(latPad * 111).toFixed(2)}km lat / \xB1${(lngPad * 111 * Math.cos(centerLat * Math.PI / 180)).toFixed(2)}km lng padding`);
  console.log(`  Fetching map with ${routes.length} encoded polyline route(s)...`);
  const mapImage = await fetchMapWithRoutes(routes, visibleCorners, WIDTH, HEIGHT);
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const citationText = `Source: Google Maps \u2014 Walking distances along pedestrian routes.
${today}`;
  const pngBuffer = await addCitationOverlay(mapImage, citationText, WIDTH, HEIGHT);
  if (request.outputPath) {
    const { mkdirSync, writeFileSync: writeFileSync4 } = await import("fs");
    mkdirSync(path5.dirname(request.outputPath), { recursive: true });
    writeFileSync4(request.outputPath, pngBuffer);
    console.log(`  \u2713 Map saved: ${request.outputPath}`);
  }
  console.log(`  \u2713 Map generated (${Math.round(pngBuffer.length / 1024)} KB PNG)`);
  routes.forEach(
    (r) => console.log(`    \u2022 ${r.destination.label}: ${r.distanceFeet.toLocaleString()} ft (${r.durationMinutes} min walk)`)
  );
  return { pngBuffer, routes, mapType: request.mapType };
}
var path5, fs6, envPath2, MAPS_API_KEY;
var init_map_generation = __esm({
  "pipeline/map-generation.ts"() {
    "use strict";
    path5 = __toESM(require("path"));
    fs6 = __toESM(require("fs"));
    init_pipeline_utils();
    envPath2 = path5.resolve(__dirname, "../.env.local");
    if (fs6.existsSync(envPath2)) {
      for (const line of fs6.readFileSync(envPath2, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
    MAPS_API_KEY = () => {
      const key = process.env.GOOGLE_MAPS_API_KEY;
      if (!key) throw new Error("GOOGLE_MAPS_API_KEY not set in .env.local");
      return key;
    };
  }
});

// pipeline/lib/calculator-guide.ts
function cc(s) {
  return s.toLowerCase().replace(/prerequisite/g, "prereq").replace(/[^a-z0-9]/g, "");
}
function findSchemaForCredit(creditName, schemas) {
  const nameNorm = cc(creditName);
  for (const schema of Object.values(schemas)) {
    if (schema.credits.some((c) => nameNorm.includes(cc(c)))) return schema;
  }
  const STOP_WORDS = /* @__PURE__ */ new Set([
    "management",
    "performance",
    "materials",
    "building",
    "project",
    "credit",
    "calculator",
    "worksheet",
    "systems",
    "reduction",
    "enhanced",
    "minimum",
    "fundamental",
    "indoor",
    "outdoor"
  ]);
  for (const schema of Object.values(schemas)) {
    if (nameNorm.includes(cc(schema.id))) return schema;
    const schemaWords = schema.name.toLowerCase().split(/\W+/).filter((w) => w.length > 5 && !STOP_WORDS.has(w));
    if (schemaWords.some((w) => nameNorm.includes(w))) return schema;
  }
  return null;
}
function extractCalculatorUrl(creditRow) {
  const urlMatch = creditRow.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch) return urlMatch[0];
  return "https://www.usgbc.org/resources";
}
async function extractGuideEntries(client2, schema, projectData, usage2) {
  const skipTabs = /* @__PURE__ */ new Set([
    "instructions",
    "instructions bd+c",
    "instructions id+c",
    "lookups",
    "reference",
    "summary",
    "sourcing of raw materials",
    "material ingredients"
  ]);
  const inputTabs = schema.tabs.filter((t) => !skipTabs.has(t.toLowerCase()));
  const fieldContext = Object.entries(schema).filter(([k, v]) => k.toLowerCase().includes("input") && Array.isArray(v)).map(([k, v]) => `${k}:
${v.map((f) => `  - ${f}`).join("\n")}`).join("\n\n");
  const validOccupancy = schema.validOccupancyCategoryInputs ?? [];
  const occupancyNote = validOccupancy.length > 0 ? `
VALID OCCUPANCY CATEGORY STRINGS (use exact spelling including trailing spaces):
${validOccupancy.map((s) => `  "${s}"`).join("\n")}` : "";
  const prompt = `You are producing a Calculator Input Guide for the LEED ${schema.name}.

CALCULATOR SCHEMA \u2014 input fields required:
${fieldContext}
${occupancyNote}

INPUT TABS TO POPULATE (skip Instructions, Summary, Lookups):
${inputTabs.join(", ")}

PROJECT DATA:
${projectData.slice(0, 5e4)}

Return ONLY a valid JSON array (no markdown, no explanation) of entry objects.
Each object has these exact keys:
  "tab"         \u2014 exact tab name from INPUT TABS list above
  "context"     \u2014 (optional) grouping context, e.g. "AHU-3" or "AHU-3 / Zone: Gymnasium"
  "field_label" \u2014 exact field name as listed in the schema inputs
  "value"       \u2014 the value extracted from project data (string or number), or null if unknown
  "unit"        \u2014 unit of measure if applicable (e.g. "cfm", "sq ft", "people"), else ""
  "source"      \u2014 one of:
                    "mechanical drawings"  \u2014 value read directly from drawing
                    "project profile"      \u2014 project name, address, date, owner
                    "auto-retrieved"       \u2014 ASHRAE tables, EPA data, built-in calculator logic
                    "[OWNER TO CONFIRM: <brief description>]"  \u2014 only if truly unknown

Rules:
- Emit one entry per field per zone / system. For multi-zone systems, repeat the zone-level fields for every zone.
- Include EVERY zone, fixture, space, or system found in the project data \u2014 be exhaustive.
- For Occupancy Category fields: use the exact string from VALID OCCUPANCY CATEGORY STRINGS above.
- Do NOT include auto-calculated fields (Rp, Ra, Vbz, Ez, Voz, Ev, Vot, Zpz, D, Vou) \u2014 those compute in Excel.
- Numbers without quotes; strings in quotes; null for truly unknown values.
- The "value" key must never be omitted \u2014 use null if no value is available.`;
  const stream = client2.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 16e3,
    temperature: 0,
    messages: [{ role: "user", content: prompt }]
  });
  let text = "";
  stream.on("text", (chunk) => {
    text += chunk;
  });
  const final = await stream.finalMessage();
  usage2.input += final.usage.input_tokens;
  usage2.output += final.usage.output_tokens;
  text = text.trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Calculator guide extraction: Claude did not return a JSON array");
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(`Calculator guide extraction: JSON parse failed \u2014 ${text.slice(start, start + 200)}`);
  }
}
function esc(v) {
  if (v === null || v === void 0) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function sourceLabel(source) {
  if (!source) return "";
  if (source.startsWith("[OWNER TO CONFIRM")) {
    return `<span style="color:#856404;font-weight:600;">${esc(source)}</span>`;
  }
  const labels = {
    "mechanical drawings": "Mechanical drawings",
    "project profile": "Project profile",
    "auto-retrieved": "Auto-retrieved"
  };
  const label = labels[source.toLowerCase()] ?? esc(source);
  return `<span style="color:#6b7e82;">${label}</span>`;
}
function renderGuideHtml(schema, entries, creditRow) {
  const calcUrl = extractCalculatorUrl(creditRow);
  const tabOrder = schema.tabs.filter((t) => {
    const tl = t.toLowerCase();
    return !["instructions", "summary"].includes(tl);
  });
  const byTab = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (!byTab.has(entry.tab)) byTab.set(entry.tab, []);
    byTab.get(entry.tab).push(entry);
  }
  const renderedTabs = [];
  const seenTabs = /* @__PURE__ */ new Set();
  const tabRenderOrder = [
    ...tabOrder,
    ...[...byTab.keys()].filter((t) => !tabOrder.includes(t))
  ];
  for (const tab of tabRenderOrder) {
    if (seenTabs.has(tab)) continue;
    seenTabs.add(tab);
    const tabEntries = byTab.get(tab);
    if (!tabEntries || tabEntries.length === 0) continue;
    const byContext = /* @__PURE__ */ new Map();
    for (const e of tabEntries) {
      const key = e.context ?? "";
      if (!byContext.has(key)) byContext.set(key, []);
      byContext.get(key).push(e);
    }
    let contextBlocks = "";
    for (const [ctx, ctxEntries] of byContext) {
      const ctxHeader = ctx ? `<tr><td colspan="5" style="background:${LIGHT_BG};font-weight:600;padding:6px 10px;font-size:12px;color:${BODY_TEXT};">${esc(ctx)}</td></tr>` : "";
      const rows2 = ctxEntries.map((e) => {
        const valueDisplay = e.value === null ? `<span style="color:#856404;">\u2014</span>` : `<strong>${esc(e.value)}</strong>`;
        return `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;color:${BODY_TEXT};font-size:13px;">${esc(e.field_label)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:13px;">${valueDisplay}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:12px;color:#6b7e82;">${esc(e.unit ?? "")}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e0eaf4;font-size:12px;">${sourceLabel(e.source)}</td>
          </tr>`;
      }).join("\n");
      contextBlocks += ctxHeader + rows2;
    }
    renderedTabs.push(`
      <div style="margin-bottom:24px;">
        <div style="background:${LIGHT_BG};border-radius:4px 4px 0 0;padding:8px 14px;font-weight:700;font-size:14px;color:${BODY_TEXT};">
          Tab: ${esc(tab)}
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #cccccc;border-top:none;font-family:sans-serif;">
          <thead>
            <tr style="background:${PALE_BG};">
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:34%;">Field Label</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:28%;">Value to Enter</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:10%;">Unit</th>
              <th style="padding:7px 10px;text-align:left;font-size:12px;color:${BODY_TEXT};border-bottom:2px solid ${LIGHT_BG};width:28%;">Source</th>
            </tr>
          </thead>
          <tbody>
            ${contextBlocks}
          </tbody>
        </table>
      </div>`);
  }
  const checkItems = entries.map((e) => {
    const label = e.context ? `${e.context} \u2014 ${e.field_label}` : e.field_label;
    return `<li style="margin:4px 0;font-size:13px;color:${BODY_TEXT};">
        <label style="cursor:pointer;">
          <input type="checkbox" style="margin-right:8px;"/>
          ${esc(label)}
          ${e.value !== null ? `<span style="color:#155724;font-size:12px;"> \u2014 ${esc(e.value)}</span>` : `<span style="color:#856404;font-size:12px;"> \u2014 <em>confirm with owner</em></span>`}
        </label>
      </li>`;
  }).join("\n");
  const ownerConfirmCount = entries.filter((e) => e.source?.startsWith("[OWNER TO CONFIRM")).length;
  const ownerNote = ownerConfirmCount > 0 ? `<p style="margin:8px 0 0;font-size:12px;color:#856404;"><strong>${ownerConfirmCount} field(s) require owner confirmation</strong> \u2014 shown with [OWNER TO CONFIRM] label above.</p>` : "";
  return `
<div style="margin-top:40px;border:2px solid ${PRIMARY};border-radius:6px;overflow:hidden;font-family:sans-serif;">

  <!-- Header -->
  <div style="background:${PRIMARY};padding:14px 20px;">
    <h2 style="margin:0;color:${WHITE};font-size:18px;font-weight:700;">
      Calculator Input Guide \u2014 ${esc(schema.name)}
    </h2>
    <div style="color:${LIGHT_BG};font-size:13px;margin-top:4px;">
      LEED Credit: ${esc(schema.credits.join(", "))} &nbsp;\xB7&nbsp; Version: ${esc(String(schema.version ?? ""))}
    </div>
  </div>

  <div style="padding:20px;background:${WHITE};">

    <!-- Section 1 \u2014 Instructions -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
      <h3 style="margin:0 0 8px;color:${PRIMARY};font-size:15px;">Section 1 \u2014 Instructions</h3>
      <p style="margin:0;font-size:13px;color:${BODY_TEXT};line-height:1.6;">
        Open the official USGBC ${esc(schema.name)} from the Calculator Access section below.
        Enter the values shown in the tab-by-tab tables into the corresponding cells.
        Fields marked <strong>[OWNER TO CONFIRM]</strong> require site-specific data from the project team.
        Do not manually enter auto-calculated values (highlighted in yellow in the calculator) \u2014 those compute automatically from your inputs.
        After entering all values, verify that the formula cells recalculate and review the Summary tab for compliance status.
      </p>
    </div>

    <!-- Section 2 \u2014 Tab-by-tab input tables -->
    <h3 style="margin:0 0 14px;color:${PRIMARY};font-size:15px;">Section 2 \u2014 Input Values by Tab</h3>
    ${renderedTabs.join("\n")}

    <!-- Section 3 \u2014 Completion checklist -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
      <h3 style="margin:0 0 10px;color:${PRIMARY};font-size:15px;">Section 3 \u2014 Completion Checklist</h3>
      <ul style="margin:0;padding:0 0 0 4px;list-style:none;">
        ${checkItems}
        <li style="margin:10px 0 4px;font-size:13px;color:${BODY_TEXT};border-top:1px solid #cccccc;padding-top:10px;">
          <label style="cursor:pointer;">
            <input type="checkbox" style="margin-right:8px;"/>
            <strong>Verify all formula cells recalculate correctly</strong> \u2014 check Summary tab for compliance status before submitting
          </label>
        </li>
      </ul>
      ${ownerNote}
    </div>

    <!-- Section 4 \u2014 Calculator Access -->
    <div style="background:${PALE_BG};border:1px solid #cccccc;border-radius:4px;padding:14px 18px;">
      <h3 style="margin:0 0 8px;color:${PRIMARY};font-size:15px;">Section 4 \u2014 Calculator Access</h3>
      <p style="margin:0;font-size:13px;color:${BODY_TEXT};">
        Download the official calculator from USGBC:
        <a href="${esc(calcUrl)}" style="color:${PRIMARY};font-weight:600;" target="_blank">${esc(calcUrl)}</a>
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7e82;">
        Calculator: <strong>${esc(schema.name)}</strong> (${esc(String(schema.version ?? ""))}).
        Upload the completed file to LEED Online under the documentation tab for ${esc(schema.credits.join(", "))}.
      </p>
    </div>

  </div>
</div>`;
}
async function generateCalculatorGuide(client2, creditRow, creditName, projectData, usage2) {
  if (!creditRow.toLowerCase().includes("calculator")) {
    return null;
  }
  const rawSchemas = fs7.existsSync(CALC_SCHEMA_PATH) ? JSON.parse(fs7.readFileSync(CALC_SCHEMA_PATH, "utf-8")) : {};
  const schemas = rawSchemas.calculators ?? {};
  const schema = findSchemaForCredit(creditName, schemas);
  if (!schema) {
    const reason = `No calculator schema matched: credit="${creditName}"`;
    console.warn(`  [calc-guide] \u26A0 ${reason}`);
    return {
      html: skippedHtml(creditName, reason),
      calculatorName: creditName,
      tabCount: 0,
      fieldCount: 0,
      ownerConfirmCount: 0,
      skipped: true,
      skipReason: reason
    };
  }
  console.log(`
  [calc-guide] Generating Input Guide for ${schema.name}`);
  console.log(`  [calc-guide] Extracting field values from project data...`);
  const entries = await extractGuideEntries(client2, schema, projectData, usage2);
  const tabsPresent = [...new Set(entries.map((e) => e.tab))];
  const fieldCount = entries.length;
  const ownerConfirmCount = entries.filter((e) => e.source?.startsWith("[OWNER TO CONFIRM")).length;
  console.log(`  [calc-guide] \u2713 ${fieldCount} entries across ${tabsPresent.length} tab(s), ${ownerConfirmCount} owner-confirm`);
  const html = renderGuideHtml(schema, entries, creditRow);
  return {
    html,
    calculatorName: schema.name,
    tabCount: tabsPresent.length,
    fieldCount,
    ownerConfirmCount,
    skipped: false
  };
}
function skippedHtml(creditName, reason) {
  return `
<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:12px;margin:8px 0;font-family:sans-serif;">
  <strong style="color:#856404;">\u26A0 Calculator Input Guide \u2014 Manual Step Required</strong><br/>
  <span style="font-size:12px;color:#6b7e82;">
    A calculator is required for ${esc(creditName)} but could not be auto-populated.<br/>
    Reason: ${esc(reason)}<br/>
    Download the official calculator from <a href="https://www.usgbc.org/resources" style="color:#327cb9;">usgbc.org/resources</a> and complete manually.
  </span>
</div>`;
}
var fs7, path6, CALC_SCHEMA_PATH, PRIMARY, LIGHT_BG, PALE_BG, BODY_TEXT, WHITE;
var init_calculator_guide = __esm({
  "pipeline/lib/calculator-guide.ts"() {
    "use strict";
    fs7 = __toESM(require("fs"));
    path6 = __toESM(require("path"));
    CALC_SCHEMA_PATH = path6.join(process.cwd(), "pipeline/reference/leed/leed_v41_calculator_schemas.json");
    PRIMARY = "#327cb9";
    LIGHT_BG = "#abcde8";
    PALE_BG = "#f7fafd";
    BODY_TEXT = "#515062";
    WHITE = "#ffffff";
  }
});

// pipeline/lib/specs-extract.ts
function convertToText(buffer, filename2) {
  const ext = path7.extname(filename2).toLowerCase();
  const tmp = path7.join(os2.tmpdir(), `certify-specs-${Date.now()}${ext}`);
  try {
    fs8.writeFileSync(tmp, buffer);
    if (ext === ".rtf") {
      return (0, import_child_process2.execSync)(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
    }
    if (ext === ".docx" || ext === ".doc") {
      try {
        return (0, import_child_process2.execSync)(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      } catch {
        return (0, import_child_process2.execSync)(`strings "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      }
    }
    if (ext === ".txt" || ext === ".text" || ext === ".md") {
      return buffer.toString("utf-8");
    }
    return buffer.toString("utf-8");
  } finally {
    try {
      fs8.unlinkSync(tmp);
    } catch {
    }
  }
}
async function extractChunk(client2, content, usage2) {
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8e3,
    temperature: 0,
    messages: [{ role: "user", content }]
  });
  usage2.input += response.usage.input_tokens;
  usage2.output += response.usage.output_tokens;
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return { products: [], summary: "" };
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      products: parsed.products ?? [],
      summary: parsed.summary ?? ""
    };
  } catch {
    return { products: [], summary: "" };
  }
}
async function extractPdfChunked(client2, pdfBuffer2, filename2, usage2) {
  const allProducts2 = [];
  const summaries2 = [];
  const pdfB64 = pdfBuffer2.toString("base64");
  const content = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
    { type: "text", text: EXTRACTION_PROMPT }
  ];
  console.log(`  [specs-extract] Extracting from ${filename2} (${(pdfBuffer2.length / 1024 / 1024).toFixed(1)} MB PDF)...`);
  const result = await extractChunk(client2, content, usage2);
  if (result.products.length > 0) {
    console.log(`  [specs-extract] \u2713 ${result.products.length} products found`);
    return result;
  }
  console.log(`  [specs-extract] PDF appears large or text-sparse \u2014 chunking by page range...`);
  return extractPdfByPageChunks(client2, pdfBuffer2, filename2, usage2);
}
async function extractPdfByPageChunks(client, pdfBuffer, filename, usage) {
  const _req = eval("require");
  const pdfjsLib = _req("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${_req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;
  const data = new Uint8Array(pdfBuffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const total = pdf.numPages;
  const CHUNK_PAGES = 100;
  const allProducts = [];
  const summaries = [];
  for (let start = 1; start <= total; start += CHUNK_PAGES) {
    const end = Math.min(start + CHUNK_PAGES - 1, total);
    let chunkText = "";
    for (let p = start; p <= end; p++) {
      const page = await pdf.getPage(p);
      const content2 = await page.getTextContent();
      const text = content2.items.map((item) => item.str).join(" ");
      chunkText += `
--- Page ${p} ---
${text}`;
    }
    if (chunkText.replace(/\s/g, "").length < 500) continue;
    console.log(`  [specs-extract] Chunk pages ${start}\u2013${end}...`);
    const content = [
      { type: "text", text: `SPECIFICATION PAGES ${start}\u2013${end} of ${total}:
${chunkText.slice(0, 12e4)}

${EXTRACTION_PROMPT}` }
    ];
    const result = await extractChunk(client, content, usage);
    allProducts.push(...result.products);
    if (result.summary) summaries.push(result.summary);
  }
  return {
    products: deduplicateProducts(allProducts),
    summary: summaries.join(" ")
  };
}
function deduplicateProducts(products) {
  const seen = /* @__PURE__ */ new Map();
  for (const p of products) {
    const key = `${p.csi_division}::${(p.name ?? "").toLowerCase()}::${(p.manufacturer ?? "").toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return Array.from(seen.values());
}
async function extractSpecsContent(files, client2, usage2) {
  const allProducts2 = [];
  const summaries2 = [];
  const sourceFiles = [];
  for (const file of files) {
    const ext = path7.extname(file.filename).toLowerCase();
    sourceFiles.push(file.filename);
    if (file.mimeType === "application/pdf" || ext === ".pdf") {
      const result = await extractPdfChunked(client2, file.buffer, file.filename, usage2);
      allProducts2.push(...result.products);
      if (result.summary) summaries2.push(result.summary);
    } else {
      console.log(`  [specs-extract] Converting ${file.filename} (${ext}) to text...`);
      const text = convertToText(file.buffer, file.filename);
      const CHUNK_CHARS = 12e4;
      for (let offset = 0; offset < text.length; offset += CHUNK_CHARS) {
        const chunk = text.slice(offset, offset + CHUNK_CHARS);
        const content = [
          { type: "text", text: `SPECIFICATION TEXT (chars ${offset}\u2013${offset + chunk.length}):
${chunk}

${EXTRACTION_PROMPT}` }
        ];
        const result = await extractChunk(client2, content, usage2);
        allProducts2.push(...result.products);
        if (result.summary) summaries2.push(result.summary);
      }
    }
  }
  const products = deduplicateProducts(allProducts2);
  return {
    extracted_at: (/* @__PURE__ */ new Date()).toISOString(),
    source_files: sourceFiles,
    product_count: products.length,
    products,
    summary: summaries2.join(" "),
    token_usage: usage2
  };
}
async function extractSpecs(projectId, customerId, files) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk4.default({ apiKey });
  const supabase = createServiceClient();
  const usage2 = { input: 0, output: 0 };
  const profile = await extractSpecsContent(files, client2, usage2);
  const storagePath = `${customerId}/${projectId}/${PROFILE_FILENAME}`;
  const { error: uploadError } = await supabase.storage.from(UPLOADS_BUCKET2).upload(storagePath, JSON.stringify(profile, null, 2), {
    contentType: "application/json",
    upsert: true
  });
  if (uploadError) throw new Error(`Failed to upload specs-profile.json: ${uploadError.message}`);
  const { error: updateError } = await supabase.from("projects").update({ specs_extracted: true }).eq("id", projectId);
  if (updateError) console.warn(`[specs-extract] Could not set specs_extracted flag: ${updateError.message}`);
  console.log(`  [specs-extract] \u2713 ${profile.product_count} products extracted from ${profile.source_files.length} file(s)`);
  console.log(`  [specs-extract]   in:${usage2.input.toLocaleString()} out:${usage2.output.toLocaleString()} tokens`);
  return profile;
}
async function loadSpecsProfile(customerId, projectId) {
  const supabase = createServiceClient();
  const storagePath = `${customerId}/${projectId}/${PROFILE_FILENAME}`;
  const { data: data2, error } = await supabase.storage.from(UPLOADS_BUCKET2).download(storagePath);
  if (error || !data2) return null;
  try {
    return JSON.parse(await data2.text());
  } catch {
    return null;
  }
}
function formatSpecsProfileForContext(profile) {
  const lines = [
    `SPECS PROFILE \u2014 ${profile.product_count} products from: ${profile.source_files.join(", ")}`,
    profile.summary ? `Summary: ${profile.summary}` : "",
    "",
    "Product / Material Inventory:"
  ];
  for (const p of profile.products) {
    const parts = [
      p.csi_division,
      p.material_type,
      p.name,
      p.manufacturer ? `(${p.manufacturer}${p.model ? ` ${p.model}` : ""})` : "",
      p.sustainability_notes ? `[${p.sustainability_notes}]` : ""
    ].filter(Boolean);
    lines.push(`  \u2022 ${parts.join(" \u2014 ")}`);
  }
  return lines.filter((l) => l !== void 0).join("\n");
}
var import_sdk4, fs8, path7, os2, import_child_process2, UPLOADS_BUCKET2, PROFILE_FILENAME, EXTRACTION_PROMPT;
var init_specs_extract = __esm({
  "pipeline/lib/specs-extract.ts"() {
    "use strict";
    import_sdk4 = __toESM(require("@anthropic-ai/sdk"));
    fs8 = __toESM(require("fs"));
    path7 = __toESM(require("path"));
    os2 = __toESM(require("os"));
    import_child_process2 = require("child_process");
    init_supabase();
    UPLOADS_BUCKET2 = "customer-uploads";
    PROFILE_FILENAME = "specs-profile.json";
    EXTRACTION_PROMPT = `You are extracting a compact product and material inventory from a construction specification document.

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

Return ONLY the JSON \u2014 no markdown, no explanation.`;
  }
});

// pipeline/lib/document-extract.ts
function toText(buffer, filename2) {
  const ext = path8.extname(filename2).toLowerCase();
  const tmp = path8.join(os3.tmpdir(), `certify-doc-${Date.now()}${ext}`);
  try {
    fs9.writeFileSync(tmp, buffer);
    if ([".rtf", ".docx", ".doc"].includes(ext)) {
      try {
        return (0, import_child_process3.execSync)(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      } catch {
        return (0, import_child_process3.execSync)(`strings "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      }
    }
    return buffer.toString("utf-8");
  } finally {
    try {
      fs9.unlinkSync(tmp);
    } catch {
    }
  }
}
function buildContentBlocks(buffer, filename2) {
  const ext = path8.extname(filename2).toLowerCase();
  if (ext === ".pdf") {
    return [{
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") }
    }];
  }
  const text = toText(buffer, filename2);
  return [{ type: "text", text: text.slice(0, 1e5) }];
}
async function runExtraction(client2, content, filename2, usage2) {
  const response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4e3,
    temperature: 0,
    messages: [{ role: "user", content: [...content, { type: "text", text: EXTRACTION_PROMPT2 }] }]
  });
  usage2.input += response.usage.input_tokens;
  usage2.output += response.usage.output_tokens;
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return {
      type_name: "Unknown Document",
      type_slug: "unknown",
      firm: null,
      author: null,
      date: null,
      project_reference: null,
      data: { raw_excerpt: text.slice(0, 500) },
      context_block: `UNRECOGNIZED DOCUMENT \u2014 ${filename2}
Could not extract structured data from this file.`,
      summary: `Unrecognized document: ${filename2}. Manual review required.`
    };
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      type_name: parsed.type_name ?? "Unknown Document",
      type_slug: (parsed.type_slug ?? "unknown").replace(/[^a-z0-9-]/g, "-").toLowerCase(),
      firm: parsed.firm ?? null,
      author: parsed.author ?? null,
      date: parsed.date ?? null,
      project_reference: parsed.project_reference ?? null,
      data: parsed.data ?? {},
      context_block: parsed.context_block ?? "",
      summary: parsed.summary ?? ""
    };
  } catch {
    return {
      type_name: "Unknown Document",
      type_slug: "unknown",
      firm: null,
      author: null,
      date: null,
      project_reference: null,
      data: { parse_error: text.slice(0, 500) },
      context_block: `DOCUMENT \u2014 ${filename2}
Could not parse extraction output.`,
      summary: `Document extraction failed for ${filename2}.`
    };
  }
}
async function extractDocumentContent(file, client2, usage2) {
  console.log(`  [doc-extract] Extracting ${file.filename}...`);
  const content = buildContentBlocks(file.buffer, file.filename);
  const result = await runExtraction(client2, content, file.filename, usage2);
  console.log(`  [doc-extract] \u2713 ${result.type_name} (${result.type_slug})`);
  return {
    ...result,
    extracted_at: (/* @__PURE__ */ new Date()).toISOString(),
    source_file: file.filename,
    token_usage: { ...usage2 }
  };
}
async function extractDocument(projectId, customerId, file) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk5.default({ apiKey });
  const supabase = createServiceClient();
  const usage2 = { input: 0, output: 0 };
  const profile = await extractDocumentContent(file, client2, usage2);
  const storagePath = `${customerId}/${projectId}/doc-profiles/${profile.type_slug}.json`;
  const { error: uploadError } = await supabase.storage.from(UPLOADS_BUCKET3).upload(storagePath, JSON.stringify(profile, null, 2), { contentType: "application/json", upsert: true });
  if (uploadError) throw new Error(`Failed to upload ${profile.type_slug} profile: ${uploadError.message}`);
  await supabase.from("projects").select("doc_profiles_extracted").eq("id", projectId).single().then(({ data: data2 }) => {
    const current = data2?.doc_profiles_extracted ?? {};
    current[profile.type_slug] = true;
    return supabase.from("projects").update({ doc_profiles_extracted: current }).eq("id", projectId);
  });
  console.log(`  [doc-extract] \u2713 ${profile.type_slug} stored \u2014 ${profile.type_name}`);
  return profile;
}
async function loadAllDocumentProfiles(customerId, projectId) {
  const supabase = createServiceClient();
  const prefix = `${customerId}/${projectId}/doc-profiles`;
  const { data: files, error } = await supabase.storage.from(UPLOADS_BUCKET3).list(prefix);
  if (error || !files?.length) return [];
  const profiles = await Promise.all(
    files.filter((f) => f.name.endsWith(".json")).map(async (f) => {
      const { data: data2, error: dlErr } = await supabase.storage.from(UPLOADS_BUCKET3).download(`${prefix}/${f.name}`);
      if (dlErr || !data2) return null;
      try {
        return JSON.parse(await data2.text());
      } catch {
        return null;
      }
    })
  );
  return profiles.filter((p) => p !== null);
}
function formatDocumentProfileForContext(profile) {
  return profile.context_block || `${profile.type_name} \u2014 ${profile.source_file}
${profile.summary}`;
}
function formatAllDocumentProfilesForContext(profiles) {
  if (!profiles.length) return "";
  return profiles.map(formatDocumentProfileForContext).join("\n\n");
}
var import_sdk5, fs9, path8, os3, import_child_process3, UPLOADS_BUCKET3, EXTRACTION_PROMPT2;
var init_document_extract = __esm({
  "pipeline/lib/document-extract.ts"() {
    "use strict";
    import_sdk5 = __toESM(require("@anthropic-ai/sdk"));
    fs9 = __toESM(require("fs"));
    path8 = __toESM(require("path"));
    os3 = __toESM(require("os"));
    import_child_process3 = require("child_process");
    init_supabase();
    UPLOADS_BUCKET3 = "customer-uploads";
    EXTRACTION_PROMPT2 = `You are analyzing a professional document uploaded as part of a LEED v4.1 building certification project.

Read this document carefully and extract all information relevant to LEED credit submissions.

Return a JSON object with this exact structure:
{
  "type_name": "Full human-readable document type \u2014 e.g. 'Geotechnical Investigation Report', 'Energy Model Output', 'Stormwater Management Plan', 'Phase I Environmental Site Assessment', 'Traffic Impact Study', 'Commissioning Report', 'Water Audit', 'Structural Report', 'Owner's Project Requirements', 'Construction Waste Management Plan', 'Acoustics Report', 'Photometric/Lighting Calculation Report', 'Indoor Air Quality Management Plan', 'Habitat Survey', 'Ventilation Design Report', 'Site Survey', 'Mechanical Schedule', or whatever this document actually is",
  "type_slug": "kebab-case short identifier \u2014 e.g. 'geotechnical', 'energy-model', 'stormwater-plan', 'phase-i-esa', 'traffic-study', 'commissioning', 'water-audit', 'structural', 'opr', 'waste-management-plan', 'acoustics', 'lighting', 'iaq-plan', 'habitat-survey', 'ventilation', 'site-survey', 'mechanical-schedule'",
  "firm": "authoring firm name or null",
  "author": "author/engineer name and credentials or null",
  "date": "document date as string or null",
  "project_reference": "project name and/or address found in the document or null",
  "data": {
    // Extract ALL quantitative values, thresholds, compliance determinations, and key findings.
    // Organize into logical sub-objects by topic. Use whatever fields fit this document type.
    // Be thorough \u2014 include every number, area, rating, classification, recommendation, and conclusion
    // that could inform a LEED credit analysis. Examples by document type:
    //
    // Geotechnical: site_address, topography, groundwater_depth_ft, seasonal_high_groundwater_ft,
    //   soils (array of layers with depth/description/USCS), hydrologic_soil_group, expansive_soils,
    //   expansion_index, liquefaction_potential, seismic_site_class, contamination_findings,
    //   phase_ii_recommended, foundation_recommendation, bearing_capacity_psf
    //
    // Energy model: software, baseline_standard, gross_floor_area_sf, proposed_site_eui,
    //   baseline_site_eui, percent_better_than_baseline, annual_energy_cost, hvac_system,
    //   heating_fuel, window_u_factor, window_shgc, roof_r_value, lpd_proposed, renewables_kw,
    //   ea_credit_1_points
    //
    // Stormwater: pre_development_runoff_cf, post_development_runoff_cf, retention_volume_cf,
    //   percent_runoff_managed, treatment_methods (array), infiltration_rate_in_hr,
    //   ss_credit_applicable, green_infrastructure_sf
    //
    // Phase I ESA: rec_status, recs (array with description/type/recommendation),
    //   historical_uses, regulatory_findings, phase_ii_recommended
    //
    // Commissioning: cx_agent, commissioned_systems, opr_status, bod_status, cx_plan_status,
    //   issues_identified, issues_resolved, ea_prereq_satisfied, ea_enhanced_cx
    //
    // Traffic/TDM: peak_hour_trips, level_of_service, transit_access, bike_facilities,
    //   tdm_measures, lt_credit_applicable
    //
    // Water audit: baseline_water_use_kgal, proposed_water_use_kgal, percent_reduction,
    //   fixture_types (array), we_credit_points
    //
    // Use judgment for any other document type \u2014 extract whatever is credit-relevant.
  },
  "context_block": "Compact plain-text block formatted for injection into a LEED credit analysis AI prompt. Structure: lead with document type name, firm, author, date, and project reference on the first line. Then present all key findings as short labeled lines or bullet points grouped by topic. Include every number, threshold, classification, and compliance determination. End with any open items, limitations, or recommendations that could affect credit eligibility. Target 250-450 words \u2014 dense with data, no filler prose.",
  "summary": "2-3 sentence plain English summary of what this document is, its key findings, and which LEED credits it is most relevant to."
}

Return ONLY the JSON \u2014 no markdown fences, no explanation.`;
  }
});

// pipeline/prompts/credit-submission.ts
var CREDIT_SUBMISSION_PROMPT;
var init_credit_submission = __esm({
  "pipeline/prompts/credit-submission.ts"() {
    "use strict";
    CREDIT_SUBMISSION_PROMPT = `ABSOLUTE OUTPUT RULE \u2014 THIS OVERRIDES EVERYTHING ELSE:

Your output is a customer-facing professional document. The customer paid for this document. They will submit it as part of a building certification review.

You are forbidden from including any of the following in your output under any circumstances:
- Any description of what you are about to do
- Any description of what you just did
- Any summary of search results
- Any statement of what data you found or retrieved
- Any internal reasoning or decision process
- Any notes about data currency or retrieval dates inline in content
- Any separator lines used to divide your thinking from your output
- Any sentence that begins with: I will, I'll, Let me, Now I, I found, I retrieved, I determined, I calculated, I assessed, I searched, I looked up

If you find yourself writing any of these \u2014 stop immediately and delete what you wrote. Begin again with the actual content.

Your output begins with the first field of the form or the first word of the first section heading. Nothing before that. Nothing after the last deliverable item. No preamble. No summary. No narration. Ever.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You are a building certification expert and certification documentation specialist.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
WEB SEARCH \u2014 USE EXTENSIVELY FOR ALL DATA RETRIEVAL
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You have web search available. Use it extensively and thoroughly. For any credit requiring location data or external data:

- Search multiple sources \u2014 never rely on a single search result.
- For transit: search for all transit agencies serving this city, all routes near this address, all stop locations within required distances. Do not limit to one agency.
- For distance measurement: use ONLY verified data from web search \u2014 Google Maps walking directions, MapQuest, OpenStreetMap, or transit agency route data. NEVER estimate or approximate walking distances using block counts, walking speed math, straight-line math, or training knowledge. If you cannot retrieve an exact walking distance from a web source, exclude that item from qualifying calculations entirely. A missing distance is better than a wrong distance.
- For trip counts: search agency websites, GTFS feeds via transit.land or mobilitydata.org, and published schedules. Use the most authoritative source available.
- For census data, density, land use: search US Census, city planning department, or equivalent authoritative sources.
- For utility rates: search the utility provider's published rate schedule.
- For any other data type: search the most authoritative public source available.

Return all findings directly in the output. Do NOT add a "Data Source" column to any table \u2014 source references belong in the Submission Checklist, not inline in tables. Never ask the customer for data that can be found through web search.

MAXIMUM OUTCOME IS THE ONLY VALID STOPPING CONDITION.

Every credit, feature, and prerequisite has a defined maximum \u2014 a point ceiling, a full-compliance threshold, or a complete set of required outcomes. Your task is to reach that maximum. Finding enough to pass is not finishing the job.

Before concluding any search, calculation, or analysis for any credit:

1. Identify the maximum achievable outcome for this credit from the requirements document \u2014 the highest point value, full compliance on every sub-requirement, or every required outcome in the checklist.
2. Compare what you have documented so far against that maximum.
3. If you have not reached the maximum \u2014 continue. You are not done.
4. Only stop when one of exactly two conditions is true:
   - You have achieved the maximum outcome, OR
   - You have documented specifically and in detail why the maximum is not achievable for this project.

Condition 2 requires real documentation \u2014 not a general statement that qualifying items were not found. It requires: what specific sources were searched, what each search returned, and what the precise limiting factor is that prevents the maximum from being reached. This documentation must be detailed enough for a reviewer to independently verify the conclusion and disagree with it if the evidence does not support it.

This rule is universal. It applies to every credit, feature, prerequisite, and optimization across all programs without exception. For prerequisites and pass/fail requirements, maximum means full compliance on every element, not the minimum required for a passing determination. For scored credits, maximum means the highest point value the project can support \u2014 not the first point value that clears the threshold.

Stopping when a minimum threshold is met, without evidence that no higher outcome is achievable, is an incomplete run.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
ABSOLUTE RULE \u2014 NON-NEGOTIABLE \u2014 APPLIES TO EVERY CREDIT WITHOUT EXCEPTION
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You have web search and have retrieved data before this prompt ran. That data is included in this context. You must use it directly in the output. You must never ask the customer to provide any item that has already been retrieved and provided to you in this context.

You must never ask the customer to provide: transit schedules, trip counts, walking distances, maps, census data, density data, surrounding land use data, utility rates, product specifications, or any other item that can be sourced from public data.

If you find yourself about to write any instruction asking the customer to provide something \u2014 stop. Check whether that item is in the retrieved data already provided to you. If it is \u2014 use it. If it is not in the retrieved data and cannot be found in any public source \u2014 use [OWNER TO CONFIRM: description] for owner-specific items only.

The customer provides only: proprietary project documents, owner decisions, signed commitments, internal specifications, and items requiring physical site access. Nothing else.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
ABSOLUTE RULES \u2014 THESE APPLY TO EVERY CREDIT, EVERY RUN
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

OUTPUT IS BODY CONTENT ONLY \u2014 NO HTML DOCUMENT WRAPPER.
Do not output <!DOCTYPE>, <html>, <head>, or <style> tags. The pipeline provides the complete HTML document wrapper and stylesheet. Your output is the body content only \u2014 start directly with the first content element (e.g. <div class="page-header">). Do not wrap your output in a document shell at any point, even if you are generating multiple sections across multiple searches.

OUTPUT BEGINS IMMEDIATELY WITH CONTENT. NO EXCEPTIONS.
The very first token of your response must be the first token of actual content \u2014 a heading, a form field, an HTML tag. Nothing else.

Never write any of the following anywhere in the output:
- "I have reviewed...", "I've analyzed...", "I have gathered...", "I have all the information needed..."
- "Now I have...", "Now let me...", "Let me now...", "Let me compile..."
- "Based on the attached...", "Based on my review...", "Based on the civil drawing..."
- "After reviewing...", "After analyzing...", "After searching..."
- "Here is the...", "Below is the...", "The following sections contain..."
- "As requested...", "Per your instructions...", "In this response..."
- "Using web search...", "I retrieved...", "I searched for..."
- "This document presents...", "This report contains...", "This section provides..."
- Any sentence that describes what you are doing, what you found, or how you produced the output.

This rule applies to the entire document \u2014 opening, closing, section introductions, and transitions. The output is a customer-facing certification document. There is no audience for process narration. Violation of this rule produces unusable output that must be regenerated.

INTERNAL DOCUMENTS ARE NEVER REFERENCED IN OUTPUT \u2014 HARD RULE, NO EXCEPTIONS.
The automation analysis spreadsheet, column references (Column 1, Column 2, Column I, etc.), form schemas, calculator schemas, and any other internal pipeline document are invisible infrastructure. They must never be named, cited, or referenced anywhere in the output \u2014 not in notes, not in scope clarifications, not in checklists, not anywhere. The customer has no context for these documents and seeing them referenced destroys trust.

If you notice a discrepancy between the requirements PDF and the credit scope, flag it in plain customer-facing language using [OWNER TO CONFIRM: description of the specific question] or a plain-language note. Never explain where the discrepancy came from or cite any internal document as the source. Write as if the output was produced by a human expert who simply knows the program \u2014 not by a system reading structured data files.

FIELD IDs ARE NEVER VISIBLE IN OUTPUT \u2014 HARD RULE, NO EXCEPTIONS.
The form schema contains internal identifiers like "fieldId: splCircumstances" or "unitTypeSelected". These are for your reference only when identifying which field to populate. They must never appear anywhere in the output \u2014 not next to a label, not as a caption, not as a value, not anywhere. Do not output camelCase field ID strings as visible text under any circumstances. If you must reference a field ID in the document, wrap it in <span class="field-id">...</span> \u2014 the stylesheet hides this class entirely. A raw camelCase field ID string appearing as plain visible text is a critical output error.

NEVER USE THE NAME "CERTIFYAI".
The platform is called LIMINALsva. Do not use "CertifyAI" anywhere in any output \u2014 not in section headers, not in checklist labels, not in any text. If you need to indicate that an item was produced or retrieved by the platform, say "Provided" or attribute to "LIMINALsva." The words "CertifyAI" and "Liminal" must never appear in customer-facing output.

MAPS ARE NEVER GENERATED BY YOU.
Walking distance maps, site context maps, transit maps, bicycle maps \u2014 all maps are produced by the Google Maps API pipeline, not by you. When a map is required, insert exactly this placeholder and nothing else: <!-- WALKING_DISTANCE_MAP -->
Never produce an SVG map. Never produce a drawn map. Never produce a map of any kind. The placeholder is replaced programmatically after your response is complete.

TABLES ARE ALWAYS REAL HTML TABLES.
Any tabular content \u2014 trip count tables, threshold comparison tables, distance tables, calculation tables, schedule data, fixture counts, any data with rows and columns \u2014 must be rendered as a proper HTML <table> with <thead>, <tbody>, <tr>, <th>, and <td> elements. Never use plain text, tab spacing, pre-formatted text, or markdown for tabular data. Real HTML tables are required in every output.

BOTH HTML FILES ARE ALWAYS PRODUCED.
Every run produces exactly two files: one standard HTML file and one editable HTML file. Neither is optional. Both contain identical content. The calling code handles file generation. Do not reference Word, .docx, or any non-HTML format.

NO PLACEHOLDER GRAPHICS.
Every visual element is either real (a real image, a real map, a real annotated drawing) or replaced by the exact comment placeholder specified above. No placeholder boxes, no "image goes here" text, no gray rectangles.

NO PROCESS NARRATION OF ANY KIND.
Do not write: "I have reviewed...", "Based on the attached...", "The following sections contain...", "As requested...", "Here is the...", "I will now...", or any similar framing. Content only.

DESCRIBE DELIVERABLES \u2014 NEVER DESCRIBE HOW THEY WERE PRODUCED.
Every word of output text must describe what the content IS \u2014 never how it was obtained, computed, or created. This rule is absolute and applies to every sentence, heading, label, note, and summary in the entire document.

Forbidden in output text: any word or phrase that names an action taken to produce the content \u2014 including but not limited to: generated, retrieved, extracted, calculated, computed, analyzed, processed, processing, sourced, obtained, fetched, looked up, found, determined, produced, automated, auto-retrieved, auto-generated, system-generated, or any synonym or variation.

Permitted: words that describe what the content IS or that it is being provided. "Transit schedule data" not "retrieved transit data." "Points determination" not "calculated points." "Documentation Summary" not "Processing Summary." When introducing a deliverable in a checklist or summary, "Provided" and "Included" are acceptable \u2014 they describe presence, not mechanism.

This rule applies to section headings, table labels, checklist entries, callout notes, and summary sections equally. No part of the document is exempt.

CLAUDE RETRIEVES EVERYTHING IT CAN BEFORE ASKING THE CUSTOMER.
Before listing any item as required from the customer, first determine whether it can be retrieved, calculated, or generated automatically. If it can be retrieved \u2014 retrieve it. The customer is never asked to provide something that can be obtained from an external source.

This rule applies to every item in every credit across all three programs without exception. Items Claude retrieves automatically include but are not limited to:

- Transit schedules and trip counts: retrieved from agency GTFS feeds, agency websites, or Google Maps transit data. Never ask the customer to provide transit schedules.
- Walking distances and routes: retrieved from Google Maps Directions API (walking mode). Never ask the customer to measure distances.
- Census data, population density, employment density: retrieved from US Census API or equivalent public sources. Never ask the customer to provide demographic data.
- Surrounding land use and diverse uses inventory: retrieved from Google Maps Places API, OpenStreetMap, or equivalent. Never ask the customer to inventory nearby uses.
- Municipal utility rates: retrieved from utility provider websites. Never ask the customer to provide rate schedules.
- Product specifications and cut sheets: retrieved from manufacturer websites where publicly available. Never ask the customer to provide specs that are publicly available.
- Aerial maps and satellite imagery: retrieved from Google Maps Static API. Never ask the customer to provide maps.
- Weather and climate data: retrieved from NOAA or equivalent public sources.
- Building code references: retrieved from publicly available municipal or state code databases.
- Agency contacts and permit requirements: retrieved from official government websites.
- Any other data available from public sources, APIs, or web search.

The customer provides only what is genuinely unavailable from any external source: proprietary project documents, owner decisions, internal specifications, signed commitments, and items that require physical access to the building or site.

When an item is retrieved automatically, the retrieved data must be included directly in the output as supporting documentation. The source must be cited. The retrieval date must be shown. Do not reference a source \u2014 include the actual data.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
AUTHORITATIVE REFERENCE FILES \u2014 MANDATORY \u2014 NO EXCEPTIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You have been provided with the following authoritative reference files for this credit. Use them exclusively \u2014 never fall back to training data for any form field, calculator input, or credit requirement.

- Automation analysis spreadsheet row for this credit: tells you exactly what the team must upload, what you auto-retrieve and from which specific named sources, and exactly what you produce
- Form schema for this credit: contains every field ID, field type, checkbox label, upload field name, and radio option from the live online submission form \u2014 populate fields using these exact IDs and field names
- Calculator schema if applicable: contains every tab name and input field label from the actual calculator file \u2014 populate using these exact field labels

Column I of the automation analysis spreadsheet tells you exactly which public sources to retrieve data from for this credit with specific source names. Retrieve from those exact named sources. Do not use other sources unless the specified source is unavailable \u2014 if unavailable use the closest equivalent and note the substitution clearly.

If any lookup returns empty or a source is unavailable flag it with: [SOURCE UNAVAILABLE: description of what could not be retrieved and what was used instead]

Never guess. Never fall back to training data. If a reference file lookup returns empty flag it \u2014 do not substitute training knowledge.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
WHAT DRIVES THE OUTPUT \u2014 READ FIRST
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

1. Read the automation analysis spreadsheet row for this credit and identify:
   - Column 1: Documents the project team provided (attached)
   - Column 2: Items retrieved automatically without customer involvement
   - Column 3: Platform reference files \u2014 requirements PDF, form link, calculator
   - Column 4: EXACT list of outputs to produce \u2014 generate every item, nothing else

2. Read the credit requirements PDF for requirements specific to this program version. Use nothing else for requirements.

3. If a form link is provided: reproduce only the fields, tables, and uploads on that form. Nothing added, nothing omitted.

4. If no form link: omit the Online Submittal Form section entirely and begin directly with Supporting Documentation.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
OUTPUT STRUCTURE (for every credit)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

LEED Online Submittal Form Inputs
The section header must be exactly "LEED Online Submittal Form Inputs" \u2014 do not append a form number, credit code, or any other identifier. Reproduce only what appears on the actual form. Populate every field with real data sourced from the project address, attached documents, or standard reference values for this credit type. For any field requiring owner decision: [OWNER TO CONFIRM: specific description of what is needed]. Include the walking distance map placeholder exactly where the map upload appears on the form: <!-- WALKING_DISTANCE_MAP -->

Supporting Documentation

SECTION A \u2014 Supporting Data (Column 2)
For every item listed in Column 2 (DOCUMENTS CLAUDE RETRIEVES AUTOMATICALLY): retrieve it and include the complete, actual data in this section. Not a reference. Not a link. Not a summary. The full data, formatted and ready for a certification reviewer to read and verify.

This is the evidence behind the submission. If a transit schedule is listed in Column 2, the schedule appears here in full. If census density data is listed, the data appears here in full. If a map is listed, the map appears here. Every Column 2 item is a deliverable \u2014 treat it as such.

If any Column 2 item cannot be retrieved, mark it clearly: \u26A0 RETRIEVAL INCOMPLETE \u2014 [reason] \u2014 and describe what the project team must obtain manually as a substitute.

SECTION B \u2014 Deliverables (Column 4)
Produce every item listed in Column 4 of the automation analysis spreadsheet. Produce each item completely. Do not add items not on the list. Do not omit items that are on the list.

Complete Submission Checklist (MANDATORY \u2014 every credit, every run, every program, no exceptions)

This section is required in every output. It gives the project team a complete, actionable picture of everything required for certification review and exactly who is responsible for each item.

Title this section: "Complete Submission Checklist"

Organize it into two groups:

GROUP A \u2014 PROVIDED
List every item from Column 2 (Supporting Data). For each item:
  - Item name
  - Badge: \u2713 PROVIDED
  - Where it appears: the exact section name in this document (e.g., "Table 1 \u2014 Qualifying Transit Stops", "Walking Distance Map", "Points Determination")
  - Source link: a direct, clickable <a href="..."> URL to the original data so the certification reviewer can independently download or verify the source. This is required for every Column 2 item. Use the most specific URL available \u2014 the agency's published schedule page, the GTFS feed download, the Census data permalink, the utility rate schedule PDF, etc. If a direct URL was used to retrieve the data, use that exact URL. Never omit this link.

Also list every deliverable from Column 4:
  - Item name
  - Badge: \u2713 PROVIDED
  - Reference: "See [Section Name] in this document"

GROUP B \u2014 REQUIRED FROM PROJECT TEAM
List every item from Column 1 (Project Team Must Upload). Every item. None may be omitted.
For each item:
  - Item name exactly as it appears in Column 1
  - Badge: \u25C9 REQUIRED \u2014 Project Team
  - What it is: a specific, plain-language description of the document, file, photograph, or commitment needed
  - Why it must come from the project team \u2014 use one of these exact reasons and add specifics:
      \xB7 "Requires physical site access" \u2014 for photographs, site measurements, field observations
      \xB7 "Requires owner decision or signature" \u2014 for commitments, policy letters, signed statements
      \xB7 "Proprietary project document" \u2014 for internal specs, drawings, contracts not publicly available
      \xB7 "Site-specific and cannot be found in any public source" \u2014 for custom calculations or unique conditions
  - Format required: PDF / photograph / signed letter on letterhead / stamped drawing / etc.

Never omit any Column 1 item. Never omit any Column 2 item. If a Column 2 item is not included, mark it \u26A0 RETRIEVAL INCOMPLETE and explain what the project team should verify.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
HTML OUTPUT \u2014 CLASS VOCABULARY (MANDATORY)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

The pipeline injects the Liminal stylesheet into every output. You MUST use these CSS class names. Do NOT write <style> blocks or inline style= attributes \u2014 the stylesheet is provided for you. Use the classes that apply to the content; unused classes are harmless.

DOCUMENT STRUCTURE
Use this pattern for every credit, adapting sections as the credit requires:

  <div class="page-header">
    <h1>Credit Code \u2014 Credit Name</h1>
    <div class="sub">Project Name \xB7 City, State \xB7 Date</div>
  </div>
  <div class="meta-bar"><span>Program:</span> {{PROGRAM_DISPLAY_NAME}} &nbsp; <span>Credit:</span> LT Credit 5</div>

  <div class="section-header">Section Title</div>
  <div class="section-body">
    ... section content ...
  </div>

  <div class="section-subheader">Subsection Title</div>  \u2190 lighter, nested under a section
  <div class="section-body"> ... </div>

  <div class="section-wrap"> ... padding wrapper for free-flowing content ... </div>
  <div class="form-id-bar">Online Submission \u2014 Form Section Identifier</div>
  <hr class="divider">

FORM FIELDS (Part 1 \u2014 online form reproduction)
  <div class="field-row">
    <span class="field-label">Field Name</span>
    <span class="field-value filled">Populated value here</span>
  </div>
  <div class="field-row">
    <span class="field-label">Upload Field</span>
    <span class="field-value upload">[OWNER TO CONFIRM: description of what is needed]</span>
  </div>
  <span class="owner-field">[OWNER TO CONFIRM: description]</span>  \u2190 inline owner item
  <span class="field-id">field_id_123</span>  \u2190 Online form field ID, monospace
  <span class="radio-selected">\u25CF</span> Selected option
  <span class="radio-unselected"></span> Other option

TABLES \u2014 always real HTML tables, never plain text or markdown
  <table>
    <thead><tr><th>Column</th><th>Column</th></tr></thead>
    <tbody>
      <tr><td>Data</td><td>Data</td></tr>
    </tbody>
  </table>
  thead th: #327cb9 background, white text \u2014 automatic from stylesheet
  tbody rows: alternating white/#e8f0f7 \u2014 automatic from stylesheet

CALCULATION BOXES
  <div class="calc-box">
    <div class="step">Step 1: formula or value</div>
    <div class="step">Step 2: result</div>
  </div>

COMPLIANCE RESULTS
  <div class="result-pass">\u2713 COMPLIANT \u2014 3 Points Earned</div>
  <div class="result-fail">\u2717 NOT COMPLIANT</div>
  <div class="result-warn">\u26A0 CONDITIONAL \u2014 owner confirmation required</div>
  <span class="pass">Compliant</span> / <span class="fail">Non-compliant</span>  \u2190 inline
  <div class="point-box">3 / 5 Points</div>
  <div class="point-box-pending">Pending Owner Confirmation</div>
  <div class="compliance-threshold-box">
    <div class="threshold-label">Weekday Directional Trips</div>
    <div class="threshold-value">147</div>
    <div class="threshold-limit">Required: \u2265 100 \u2014 THRESHOLD MET</div>
  </div>

NOTES AND CALLOUTS
  <div class="note">Blue informational note \u2014 for context or methodology</div>
  <div class="info-box">Light blue info box \u2014 for retrieved data summaries</div>
  <div class="warn-note">Yellow warning \u2014 for conditional items or caveats</div>
  <div class="warn-box">Yellow warning box \u2014 larger warning area</div>
  <div class="alert-note">Red alert \u2014 for retrieval failures or critical missing items</div>

SUBMISSION CHECKLIST (Part 3 \u2014 use these exact badge classes)
  <div class="checklist-item">
    <h4>Item Name <span class="badge-provided">\u2713 PROVIDED</span></h4>
    <p>Where it appears: Section name in this document</p>
    <p><a href="https://source-url.gov">Source: agency name</a></p>
  </div>
  <div class="checklist-item">
    <h4>Item Name <span class="badge-required">\u25C9 REQUIRED \u2014 Project Team</span></h4>
    <p>What it is: description</p>
    <p>Why from project team: Proprietary project document / Requires owner signature / etc.</p>
    <p>Format required: PDF / signed letter / stamped drawing</p>
  </div>
  <div class="checklist-item">
    <h4>Item Name <span class="badge-incomplete">\u26A0 RETRIEVAL INCOMPLETE</span></h4>
    <p>Reason retrieval failed and what the project team should verify.</p>
  </div>

LAYOUT HELPERS (use when credit content calls for it)
  <div class="two-col"> ... two equal columns for side-by-side data ... </div>
  <div class="plan-section"><h4>Policy Section Heading</h4> ... policy content ... </div>
  <div class="signature-block">Name: <span class="sig-line"></span> Date: <span class="sig-line"></span></div>
  <div class="source-note">Source: agency.gov, retrieved 2026-05-26</div>
  <ul class="checklist-list"><li>Item one</li><li>Item two</li></ul>

DOCUMENTATION SUMMARY (at the very end of every output)
  <div class="processing-summary">
    <h3>Documentation Summary</h3>
    <p><strong>Credit:</strong> LT Credit 5 \u2014 Access to Quality Transit ({{PROGRAM_DISPLAY_NAME}})</p>
    <p><strong>Deliverables included:</strong> Online Form, Supporting Documentation, Submission Checklist</p>
    <p><strong>Owner confirmation items:</strong> list any [OWNER TO CONFIRM] items here</p>
  </div>

MAP INSERTION
  <img data-map-insert="1" alt="Walking distance map">
  \u2190 This exact element is the only map placeholder. The pipeline replaces it with the actual map image.
  Never use text descriptions or .map-placeholder div for the actual map location.

POLICY DOCUMENTS \u2014 GENERATE INLINE WHEN REQUIRED
When a credit requires a written policy, program, or commitment document as a deliverable \u2014 such as a Green Cleaning Policy, Smoking Policy, Guaranteed Ride Home Program, Integrated Pest Management Plan, or similar written organizational document \u2014 generate the complete policy document inline as a section within Part 2 output. Use <div class="plan-section"> for policy content sections. Include all required elements specified in the credit requirements (eligibility, procedures, responsible parties, etc.).

If a policy is one compliance path option and a different path was selected, do not generate the policy.
If a policy is one compliance path option and no path was selected, generate the policy as the default safe choice.
Do not place any marker or signal in the output. Simply write the policy content as part of the document.`;
  }
});

// pipeline/lib/geocode.ts
async function validateAddress(address) {
  if (!address || address.trim().length < 5) {
    return { valid: false, reason: "No project address was provided. Please add a full street address to your project before submitting." };
  }
  return { valid: true, reason: "Address present" };
}
var init_geocode = __esm({
  "pipeline/lib/geocode.ts"() {
    "use strict";
  }
});

// src/lib/qa-token.ts
function secret() {
  return process.env.QA_SECRET ?? process.env.CRON_SECRET ?? "";
}
function signQaToken(orderId) {
  return (0, import_crypto.createHmac)("sha256", secret()).update(orderId).digest("hex");
}
var import_crypto;
var init_qa_token = __esm({
  "src/lib/qa-token.ts"() {
    "use strict";
    import_crypto = require("crypto");
  }
});

// pipeline/lib/validate-output.ts
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ").replace(/&#\d+;/gi, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function validateNoUnnecessaryCustomerRequests(html) {
  const text = stripHtml(html);
  const violations = [];
  const seen = /* @__PURE__ */ new Set();
  for (const { pattern, description } of BLOCKING_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(text.length, match.index + match[0].length + 80);
      const context = `\u2026${text.slice(start, end).trim()}\u2026`;
      const key = description + "|" + match[0].slice(0, 50).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        violations.push({ description, context });
      }
      if (regex.lastIndex <= match.index) regex.lastIndex = match.index + 1;
    }
  }
  return violations;
}
function outputKeywords(item) {
  return item.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !OUTPUT_STOP_WORDS.has(w));
}
function validateAllOutputsProduced(html, outputs) {
  const text = stripHtml(html).toLowerCase();
  const violations = [];
  for (const item of outputs) {
    const keywords = outputKeywords(item);
    if (keywords.length === 0) continue;
    const matched = keywords.filter((kw) => text.includes(kw));
    const matchRatio = matched.length / keywords.length;
    if (matchRatio < 0.6) {
      violations.push({
        description: `Column 4 output missing from document: "${item}"`,
        context: `Keywords checked: [${keywords.join(", ")}] \u2014 ${matched.length}/${keywords.length} matched`
      });
    }
  }
  return violations;
}
function validateCalculatorGuidePresent(html, creditRow) {
  if (!creditRow.toLowerCase().includes("calculator")) return [];
  const text = stripHtml(html).toLowerCase();
  if (text.includes("calculator input guide")) return [];
  return [{
    description: "Calculator Input Guide missing from output",
    context: "Automation analysis requires a calculator but the output HTML contains no 'Calculator Input Guide' heading. generateCalculatorGuide() may have been skipped or thrown."
  }];
}
var BLOCKING_PATTERNS, OUTPUT_STOP_WORDS;
var init_validate_output = __esm({
  "pipeline/lib/validate-output.ts"() {
    "use strict";
    BLOCKING_PATTERNS = [
      // ── 1. Unfilled auto-retrievable placeholders ────────────────────────────
      // [INSERT TRANSIT DATA], [INSERT TRIP COUNT], [INSERT GTFS DATA], etc.
      {
        pattern: /\[INSERT\s+[^\]]{0,80}(?:TRANSIT\s+(?:SCHEDULE|DATA|TIMETABLE)|TRIP\s+COUNT|GTFS|WALKING\s+DISTANCE\s+(?:MEASUREMENT|DATA)|CENSUS\s+DATA|UTILITY\s+RATE|AERIAL\s+(?:MAP|IMAGE)|WEATHER\s+DATA)[^\]]{0,30}\]/i,
        description: "Unfilled placeholder for auto-retrievable data"
      },
      // ── 2. [OWNER/CUSTOMER TO CONFIRM] on auto-retrievable data ─────────────
      // Only flags when the content is unambiguously auto-retrievable.
      // EXCLUDED: "transit agency" (appears in "transit agency committed to restoring service")
      // EXCLUDED: "service rerouted", "service disruption" (owner decision, not auto-retrievable)
      // EXCLUDED: "site plan", "pedestrian routes", "drawing set" (legitimate customer uploads)
      {
        pattern: /\[(?:CUSTOMER|TEAM|OWNER)\s+TO\s+(?:PROVIDE|CONFIRM)[^\]]{0,120}(?:transit\s+(?:schedule|timetable)|bus\s+(?:schedule|route\s+schedule)|trip\s+counts?|directional\s+(?:trip|count)|one-direction\s+(?:trip|count)|gtfs|census\s+data|utility\s+rates?|aerial\s+(?:map|photo)|weather\s+data|walking\s+distance\s+(?:measurement|data))/i,
        description: "[OWNER/CUSTOMER TO CONFIRM] used on auto-retrievable item"
      },
      // ── 3. Named-subject instruction to customer ─────────────────────────────
      // "customer must provide trip counts" / "project team should collect GTFS data"
      // Requires named subject + modal verb, so it cannot match descriptive text.
      {
        pattern: /(?:customer|owner|project\s+team|applicant|you)\s+(?:should|must|will\s+need\s+to|needs?\s+to|is\s+required\s+to|are\s+required\s+to)\s+(?:provide|submit|obtain|collect|gather|supply)\s+[^.]{0,120}(?:trip\s+counts?|transit\s+(?:schedule|timetable)|directional\s+(?:trip|count)|gtfs|census\s+data|utility\s+rates?)/i,
        description: "Customer instructed by name to obtain auto-retrievable data"
      },
      // ── 4. Full-phrase: provide trip counts from agency timetables ────────────
      // "provide one-direction trip counts for Routes X, sourced from IndyGo timetables"
      // Very specific — the complete phrase that Claude uses when asking for GTFS data.
      {
        pattern: /(?:provide|obtain|collect)\s+[^.]{0,80}trip\s+counts?\s+[^.]{0,80}(?:sourced?\s+from|from\s+the)\s+[^.]{0,80}(?:timetable|published\s+schedule)/i,
        description: "Customer asked to source trip counts from transit agency timetables"
      }
    ];
    OUTPUT_STOP_WORDS = /* @__PURE__ */ new Set([
      "the",
      "and",
      "for",
      "with",
      "from",
      "that",
      "this",
      "are",
      "has",
      "have",
      "its",
      "not",
      "but",
      "all",
      "each",
      "any",
      "per",
      "via",
      "tab",
      "html",
      "file",
      "list",
      "full",
      "leed",
      "well"
    ]);
  }
});

// pipeline/lib/output-cleaner.ts
function inc(counts, id, n = 1) {
  counts[id] = (counts[id] ?? 0) + n;
}
function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/&#\d+;/gi, " ").replace(/\s+/g, " ").trim();
}
function scrubSentencesInBlock(block, counts) {
  const parts = block.split(/(?<=[.!?])\s+/);
  const kept = [];
  for (const sentence of parts) {
    const s = sentence.trim();
    if (!s) {
      kept.push(sentence);
      continue;
    }
    const blockHit = BLOCK_PATTERNS.find(({ re }) => re.test(s));
    if (blockHit) {
      inc(counts, blockHit.id);
      continue;
    }
    const sentenceHit = SENTENCE_PATTERNS.find(({ re }) => re.test(s));
    if (sentenceHit) {
      inc(counts, sentenceHit.id);
      continue;
    }
    kept.push(sentence);
  }
  return kept.join(" ");
}
function scrubPlainText(text, counts) {
  const paragraphs = text.split(/\n{2,}/);
  const cleaned = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (SEPARATOR_LINE_RE.test(trimmed)) {
      inc(counts, "P4-separator");
      continue;
    }
    const blockHit = BLOCK_PATTERNS.find(({ re }) => re.test(trimmed));
    if (blockHit) {
      inc(counts, blockHit.id);
      continue;
    }
    const scrubbed = scrubSentencesInBlock(trimmed, counts);
    if (scrubbed.trim()) {
      cleaned.push(scrubbed);
    }
  }
  return cleaned.join("\n\n");
}
function scrubHtml(html, counts) {
  let result = html;
  const firstTagIdx = result.search(/<(?:!DOCTYPE|html|head|body|h[1-6]|div|section|p|table|style|article|ul|ol|figure)\b/i);
  if (firstTagIdx > 0) {
    const stripped = result.slice(0, firstTagIdx);
    if (stripped.trim()) {
      inc(counts, "pre-html-text-stripped");
      console.log(`  [scrub-narration] Stripped ${stripped.trim().length} chars of pre-HTML text`);
    }
    result = result.slice(firstTagIdx);
  }
  const lastTagEnd = result.lastIndexOf(">");
  if (lastTagEnd !== -1 && lastTagEnd < result.length - 1) {
    const trailing = result.slice(lastTagEnd + 1);
    if (trailing.trim()) {
      inc(counts, "post-html-text-stripped");
    }
    result = result.slice(0, lastTagEnd + 1);
  }
  result = result.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    const text = stripTags(inner);
    if (!text) return match;
    const sentences = text.split(/(?<=[.!?])\s+/);
    const narrationCount = sentences.filter((s) => {
      const t = s.trim();
      return BLOCK_PATTERNS.some(({ re }) => re.test(t)) || SENTENCE_PATTERNS.some(({ re }) => re.test(t));
    }).length;
    if (narrationCount === sentences.length) {
      inc(counts, "HTML-p-narration", narrationCount);
      return "";
    }
    if (sentences.length > 1 && narrationCount / sentences.length > 0.5) {
      inc(counts, "HTML-p-narration-partial", narrationCount);
      return "";
    }
    return match;
  });
  result = result.replace(/^[ \t]*(?:-{3,}|\*{3,}|={3,})[ \t]*$/gm, () => {
    inc(counts, "P4-separator");
    return "";
  });
  result = result.replace(/>([^<]{5,})</g, (_m, textNode) => {
    const scrubbed = scrubSentencesInBlock(textNode, counts);
    return `>${scrubbed}<`;
  });
  const FIELD_ID_RE = /\b([a-z][a-z0-9]*(?:[A-Z][a-zA-Z0-9]*){2,})\b/g;
  let inScriptOrStyle = false;
  result = result.replace(
    /(<(?:script|style)[^>]*>)|(<\/(?:script|style)>)|(>([^<]{3,})<)/gi,
    (match, openScriptStyle, closeScriptStyle, textNodeFull, textContent) => {
      if (openScriptStyle) {
        inScriptOrStyle = true;
        return match;
      }
      if (closeScriptStyle) {
        inScriptOrStyle = false;
        return match;
      }
      if (inScriptOrStyle || !textContent) return match;
      const cleaned = textContent.replace(FIELD_ID_RE, (token) => {
        if (token.length < 10) return token;
        inc(counts, "field-id-wrapped");
        return `<span class="field-id">${token}</span>`;
      });
      return `>${cleaned}<`;
    }
  );
  return result;
}
function containsNarration(content) {
  const text = content.includes("<") ? stripTags(content) : content;
  for (const para of text.split(/\n{2,}/)) {
    const t = para.trim();
    if (BLOCK_PATTERNS.some(({ re }) => re.test(t))) return true;
    for (const s of t.split(/(?<=[.!?])\s+/)) {
      const st = s.trim();
      if (SENTENCE_PATTERNS.some(({ re }) => re.test(st))) return true;
      if (BLOCK_PATTERNS.some(({ re }) => re.test(st))) return true;
    }
  }
  return false;
}
function scrubNarration(input) {
  const counts = {};
  let text = input;
  let fenceCount = 0;
  text = text.replace(/^```(?:html|HTML)?\s*\n?([\s\S]*?)\n?```\s*$/gm, (_m, inner) => {
    fenceCount++;
    return inner.trim();
  });
  if (fenceCount) inc(counts, "code-fence", fenceCount);
  const isHtml = /<!DOCTYPE|<html\b|<body\b|<div\b|<section\b|<p\b|<table\b|<h[1-6]\b/i.test(text);
  if (isHtml) {
    text = scrubHtml(text, counts);
  } else {
    text = scrubPlainText(text, counts);
  }
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]+$/gm, "");
  const total2 = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total2 > 0) {
    console.log(`  [scrub-narration] Removed ${total2} narration instance(s):`);
    for (const [id, n] of Object.entries(counts).sort()) {
      console.log(`    ${id}: ${n}`);
    }
  }
  return { cleaned: text, counts, total: total2 };
}
var SENTENCE_PATTERNS, BLOCK_PATTERNS, SEPARATOR_LINE_RE;
var init_output_cleaner = __esm({
  "pipeline/lib/output-cleaner.ts"() {
    "use strict";
    SENTENCE_PATTERNS = [
      // Pattern 1 — Search / action announcements (what Claude is about to do)
      { id: "P1-ill-search", re: /\bI'?(?:ll| will)\s+search\b/i },
      { id: "P1-let-me-search", re: /\bLet\s+me\s+search\b/i },
      { id: "P1-searching-for", re: /\bSearching\s+for\b/i },
      { id: "P1-ill-look-up", re: /\bI'?(?:ll| will)\s+look\s+up\b/i },
      { id: "P1-let-look-up", re: /\bLet\s+me\s+look\s+up\b/i },
      { id: "P1-ill-retrieve", re: /\bI'?(?:ll| will)\s+retrieve\b/i },
      { id: "P1-ill-find", re: /\bI'?(?:ll| will)\s+find\b/i },
      { id: "P1-now-ill", re: /\bNow\s+I'?ll\b/i },
      { id: "P1-im-going-to", re: /\bI'?m\s+going\s+to\b/i },
      { id: "P1-i-will-now", re: /\bI\s+will\s+now\b/i },
      { id: "P1-first-ill", re: /\bFirst\s+I'?ll\b/i },
      { id: "P1-next-ill", re: /\bNext\s+I'?ll\b/i },
      // "Let me compile / generate / produce / write / create / present / provide / organize / begin"
      { id: "P1-let-me-action", re: /\bLet\s+me\s+(?:now\s+)?(?:compile|generate|produce|write|create|present|provide|organize|structure|format|begin|complete|fill|populate|build|construct|draft)\b/i },
      // "I'll now compile / generate / produce / write / fill / complete / populate"
      { id: "P1-ill-now-action", re: /\bI'?(?:ll| will)\s+now\s+(?:compile|generate|produce|write|create|present|provide|organize|complete|fill|populate|build|construct|draft)\b/i },
      // Pattern 3 — Process narration (completion / state announcements)
      { id: "P3-now-i-have-all", re: /\bNow\s+I\s+have\s+(?:all\s+(?:the\s+)?(?:data|information)|everything)\b/i },
      { id: "P3-now-i-have-evth", re: /\bNow\s+I\s+have\s+everything\b/i },
      // "I now have [comprehensive / complete / detailed / sufficient / enough / all / the data]"
      { id: "P3-i-now-have", re: /\bI\s+now\s+have\s+(?:comprehensive|complete|detailed|sufficient|enough|all|the\s+(?:data|information|context|details|results|findings|information\s+needed|data\s+needed))\b/i },
      { id: "P3-i-have-gathered", re: /\bI\s+have\s+(?:now\s+)?gathered\b/i },
      { id: "P3-i-have-collected", re: /\bI\s+have\s+(?:now\s+)?collected\b/i },
      { id: "P3-i-have-retrieved", re: /\bI\s+have\s+(?:now\s+)?retrieved\b/i },
      { id: "P3-i-have-found-all", re: /\bI\s+have\s+found\s+all\b/i },
      { id: "P3-i-have-compiled", re: /\bI\s+have\s+(?:now\s+)?compiled\b/i },
      { id: "P3-i-have-completed", re: /\bI\s+have\s+(?:now\s+)?completed\b/i },
      { id: "P3-with-info-now", re: /\bWith\s+this\s+(?:data|information|context)\s+I\s+(?:can\s+now|will\s+now|'ll\s+now)\b/i },
      { id: "P3-i-now-have-need", re: /\bI\s+now\s+have\s+what\s+I\s+need\b/i },
      { id: "P3-i-have-what-need", re: /\bI\s+have\s+(?:all\s+)?(?:the\s+)?(?:data|information|context|details)\s+(?:I\s+need|needed)\b/i },
      // Pattern 5 — Data retrieval currency notes inline
      { id: "P5-current-as-of", re: /\b(?:data|information|rates?|values?|results?)\s+(?:is|are)\s+current\s+as\s+of\b/i },
      // Pattern 6 — Internal reasoning / process description
      { id: "P6-i-determined", re: /\bI\s+determined\s+that\b/i },
      { id: "P6-i-calculated", re: /\bI\s+calculated\b/i },
      { id: "P6-i-assessed", re: /\bI\s+assessed\b/i },
      { id: "P6-i-evaluated", re: /\bI\s+evaluated\b/i },
      { id: "P6-based-my-analysis", re: /\bBased\s+on\s+my\s+(?:analysis|review|search|findings|research)\b/i },
      { id: "P6-after-reviewing", re: /\bAfter\s+(?:reviewing|analyzing|searching|examining|researching)\b/i },
      { id: "P6-i-can-now", re: /\bI\s+can\s+now\s+(?:compile|generate|produce|write|create|complete|fill|provide|present)\b/i }
    ];
    BLOCK_PATTERNS = [
      // Pattern 2 — Findings summaries / preambles
      { id: "P2-key-findings", re: /^Key\s+findings?:/i },
      { id: "P2-heres-what", re: /^Here'?s\s+what\s+I\s+found:/i },
      { id: "P2-here-are-results", re: /^Here\s+are\s+the\s+results?:/i },
      { id: "P2-i-found-that", re: /^I\s+found\s+that\b/i },
      { id: "P2-my-search", re: /^My\s+search\s+returned\b/i },
      { id: "P2-search-shows", re: /^The\s+search\s+shows?\b/i },
      { id: "P2-search-results", re: /^Search\s+results?:/i },
      { id: "P2-based-my-search", re: /^Based\s+on\s+my\s+search\b/i },
      // "Based on the search results / the data / this information / these findings"
      { id: "P2-based-on-the", re: /^Based\s+on\s+(?:the\s+|these\s+|this\s+|those\s+)?(?:search\s+results?|data|information|findings?|analysis|results?|above)\b/i },
      { id: "P2-i-was-able", re: /^I\s+was\s+able\s+to\s+find\b/i },
      { id: "P2-i-retrieved-fol", re: /^I\s+retrieved\s+the\s+following\b/i },
      { id: "P2-with-that", re: /^With\s+(?:that|this|these|those)\s+(?:data|information|findings?|results?|context),?\s+I\b/i }
    ];
    SEPARATOR_LINE_RE = /^[ \t]*(?:-{3,}|\*{3,}|={3,})[ \t]*$/;
  }
});

// pipeline/process-order.ts
var process_order_exports = {};
__export(process_order_exports, {
  buildExpectedPdfName: () => buildExpectedPdfName,
  processOrder: () => processOrder
});
function buildExpectedPdfName(program, creditCode, creditName) {
  const code = creditCode.replace(/β/g, "beta");
  const name = creditName.replace(/β/g, "beta");
  if (program === "leed_bdc_v41") {
    const m = code.match(/^([A-Z]+)(c|p)\d+$/i);
    const catAbbrev = m ? m[1].toUpperCase() : code.replace(/[^A-Z]/gi, "").toUpperCase();
    return `LEED_${catAbbrev}_${name}.pdf`;
  }
  if (program === "well_v2") return `WELL_V2_${code}_${name}.pdf`;
  return `WELL_HSR_${code}_${name}.pdf`;
}
function findCategoryFolder(programDir, category, creditCode) {
  if (!fs10.existsSync(programDir)) return void 0;
  const allFolders = fs10.readdirSync(programDir).filter(
    (d) => fs10.statSync(path9.join(programDir, d)).isDirectory()
  );
  const categoryLow = category.toLowerCase();
  const exact = allFolders.find((d) => d.toLowerCase() === categoryLow);
  if (exact) return exact;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalised = allFolders.find((d) => norm(d) === norm(category));
  if (normalised) return normalised;
  const prefixMatch = creditCode.match(/^([A-Z]+)/i);
  const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : null;
  if (prefix) {
    const byPrefix = allFolders.find((d) => {
      const words = d.trim().toUpperCase().split(/\s+/);
      return words.includes(prefix);
    });
    if (byPrefix) return byPrefix;
  }
  return void 0;
}
function findCreditPdfBuffer(program, category, creditCode, creditName) {
  const subdir = PROGRAM_REF_SUBDIR[program];
  if (!subdir) return { found: false, searchedDir: "(unknown program)", filesFound: [] };
  const programDir = path9.join(REF_BASE, subdir);
  const categoryDir = findCategoryFolder(programDir, category, creditCode);
  const searchedDir = categoryDir ? path9.join(programDir, categoryDir) : path9.join(programDir, category);
  if (!categoryDir) return { found: false, searchedDir, filesFound: [] };
  const folderPath = path9.join(programDir, categoryDir);
  const allFiles = fs10.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const expectedName = buildExpectedPdfName(program, creditCode, creditName);
  const exact = allFiles.find((f) => f.toLowerCase() === expectedName.toLowerCase());
  if (exact) {
    const fullPath = path9.join(folderPath, exact);
    return { buffer: fs10.readFileSync(fullPath), resolvedPath: fullPath };
  }
  const nameLower = creditName.toLowerCase();
  const match = allFiles.find((f) => f.includes(creditCode)) ?? allFiles.find((f) => f.toLowerCase().includes(nameLower));
  if (match) {
    const fullPath = path9.join(folderPath, match);
    return { buffer: fs10.readFileSync(fullPath), resolvedPath: fullPath };
  }
  return { found: false, searchedDir, filesFound: allFiles };
}
function scanPdfForAppendixRefs(buffer) {
  const text = buffer.toString("latin1");
  const nums = /* @__PURE__ */ new Set();
  const re = /appendix\s+(\d+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 20) nums.add(n);
  }
  return [...nums].sort((a, b) => a - b);
}
function loadLeedAppendices(referencedNums) {
  const leedDir = path9.join(REF_BASE, "leed");
  const allFiles = fs10.existsSync(leedDir) ? fs10.readdirSync(leedDir) : [];
  const appendixFiles = allFiles.filter((f) => {
    const fl = f.toLowerCase();
    return fl.startsWith("appendix") && fl.endsWith(".pdf");
  });
  const results = [];
  for (const num of referencedNums) {
    const match = appendixFiles.find((f) => {
      const fl = f.toLowerCase();
      return fl.includes(`appendix ${num} `) || fl.includes(`appendix ${num}.`);
    });
    if (match) {
      results.push({ num, buffer: fs10.readFileSync(path9.join(leedDir, match)), filename: match });
    } else {
      console.warn(`  Step 12.7: Appendix ${num} referenced but not found in pipeline/reference/leed/`);
    }
  }
  return results;
}
function isLeed(creditCode) {
  return LEED_CODE_RE.test(creditCode);
}
function creditCodeToFormKey(code) {
  const m = code.match(/^([A-Z]+)(c|p)(\d+)$/i);
  if (!m) return code;
  return `${m[1].toUpperCase()} ${m[2].toLowerCase() === "c" ? "Credit" : "Prereq"} ${m[3]}`;
}
function loadLeedReferenceData(creditCode, creditName, hasCalculator) {
  const lines = [
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "LEED AUTHORITATIVE REFERENCE FILES \u2014 USE EXCLUSIVELY",
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "These files are the authoritative source of truth. Never fall back to training data",
    "for any form field ID, calculator input label, or credit requirement.",
    ""
  ];
  const formSchemaPath = path9.join(REF_BASE, "leed/leed_v41_form_schemas.json");
  try {
    const allSchemas = JSON.parse(fs10.readFileSync(formSchemaPath, "utf-8"));
    const formKey = creditCodeToFormKey(creditCode);
    const creditSchema = allSchemas.credits?.[formKey] ?? Object.values(allSchemas.credits ?? {}).find(
      (c) => (c.name ?? "").toLowerCase().includes(creditName.toLowerCase().slice(0, 12))
    );
    if (creditSchema?.fields?.all?.length > 0) {
      lines.push(`FORM FIELD SCHEMA \u2014 ${formKey} (${creditSchema.fields.all.length} fields):`);
      lines.push("Use these exact field IDs, labels, and option values. Do not invent or rename fields.");
      lines.push(JSON.stringify(creditSchema.fields.all, null, 2));
    } else {
      lines.push(`FORM FIELD SCHEMA: not found for ${creditCode} \u2014 use web search to identify live form fields`);
    }
  } catch (err) {
    lines.push(`FORM FIELD SCHEMA: failed to load \u2014 ${err.message}`);
  }
  if (hasCalculator) {
    const calcSchemaPath = path9.join(REF_BASE, "leed/leed_v41_calculator_schemas.json");
    try {
      const allCalcSchemas = JSON.parse(fs10.readFileSync(calcSchemaPath, "utf-8"));
      const formKey = creditCodeToFormKey(creditCode);
      const calcSchema = allCalcSchemas.calculators?.[formKey] ?? Object.values(allCalcSchemas.calculators ?? {}).find(
        (c) => (c.name ?? "").toLowerCase().includes(creditName.toLowerCase().slice(0, 12))
      );
      if (calcSchema) {
        lines.push("\nCALCULATOR SCHEMA:");
        lines.push("Use these exact tab names and input field labels. Do not rename or reorder.");
        lines.push(JSON.stringify(calcSchema, null, 2));
      } else {
        lines.push(`
CALCULATOR SCHEMA: not found for ${creditCode}`);
      }
    } catch (err) {
      lines.push(`
CALCULATOR SCHEMA: failed to load \u2014 ${err.message}`);
    }
  }
  return lines.join("\n");
}
function orderFolderPath(customerId, projectId, orderId, creditCode) {
  return `${customerId}/${projectId}/orders/${orderId}-${creditCode}`;
}
function attemptPath(base, attempt) {
  return `${base}/attempt-${attempt}`;
}
function outputsPath(base) {
  return `${base}/outputs`;
}
function drawingsPath(customerId, projectId) {
  return `${customerId}/${projectId}/drawings`;
}
async function dbCall(query, label) {
  return withTimeout(Promise.resolve(query), 1e4, `Supabase: ${label}`);
}
function detectRequiredMapType(outputs) {
  const combined = outputs.join(" ").toLowerCase();
  for (const [mapType, keywords] of Object.entries(MAP_OUTPUT_KEYWORDS)) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return mapType;
    }
  }
  return null;
}
function validateAllDeliverables(params) {
  let cleanedHtml = params.htmlContent;
  if (containsNarration(cleanedHtml)) {
    console.warn(`  [validateAllDeliverables] Narration detected \u2014 running second scrub`);
    const rerun = scrubNarration(cleanedHtml);
    cleanedHtml = rerun.cleaned;
    if (rerun.total > 0) console.warn(`    Removed ${rerun.total} additional narration instance(s)`);
    if (containsNarration(cleanedHtml)) {
      console.warn(`  [validateAllDeliverables] Narration survived second scrub \u2014 delivering with QA flag`);
    }
  }
  if (params.requiredMapType && !params.mapGenerated) {
    console.warn(`  [validateAllDeliverables] Map required but not generated \u2014 QA flag only`);
  }
  return { cleanedHtml };
}
async function processOrder(orderId, runId, additionalInstructions) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client2 = new import_sdk6.default({ apiKey, timeout: 18e5, maxRetries: 1 });
  const supabase = createServiceClient();
  console.log(`
[process-order] \u25B6 Order ${orderId} / Run ${runId}`);
  const [runRes, orderRes] = await Promise.all([
    dbCall(supabase.from("runs").select("*").eq("id", runId).single(), "fetch run"),
    dbCall(supabase.from("orders").select("*").eq("id", orderId).single(), "fetch order")
  ]);
  if (runRes.error) throw new Error(`Run not found: ${runRes.error.message}`);
  if (orderRes.error) throw new Error(`Order not found: ${orderRes.error.message}`);
  const run = runRes.data;
  const order = orderRes.data;
  const [projectRes, creditRes, customerRes] = await Promise.all([
    dbCall(supabase.from("projects").select("*").eq("id", order.project_id).single(), "fetch project"),
    dbCall(supabase.from("credits").select("*").eq("id", order.credit_id).single(), "fetch credit"),
    dbCall(supabase.from("customers").select("*").eq("id", order.customer_id).single(), "fetch customer")
  ]);
  if (projectRes.error) throw new Error(`Project not found: ${projectRes.error.message}`);
  if (creditRes.error) throw new Error(`Credit not found: ${creditRes.error.message}`);
  if (customerRes.error) throw new Error(`Customer not found: ${customerRes.error.message}`);
  const project = projectRes.data;
  const credit = creditRes.data;
  const customer = customerRes.data;
  console.log("[Step 2 diagnostic]", {
    cwd: process.cwd(),
    xlsxExists: require("fs").existsSync(require("path").join(process.cwd(), "pipeline/reference/leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx")),
    dirContents: require("fs").readdirSync(require("path").join(process.cwd(), "pipeline")).join(", ")
  });
  console.log(`  Step 2: Loading credit data from automation analysis...`);
  console.log(`  Step 2a: calling extractCreditData for "${credit.credit_code}" (program: ${credit.program})...`);
  const creditData = extractCreditData(credit.credit_code, credit.program);
  console.log(`  Step 2b: extractCreditData returned \u2014 outputs: ${creditData.outputs.join(", ") || "(none)"}`);
  const attemptNumber = run.attempt_number ?? run.run_number ?? 1;
  const orderBase = orderFolderPath(order.customer_id, order.project_id, orderId, credit.credit_code);
  const attemptFolder = attemptPath(orderBase, attemptNumber);
  const outputsFolder = outputsPath(orderBase);
  console.log(`  Step 3: Attempt ${attemptNumber} \u2014 folder: ${attemptFolder}`);
  console.log(`  Step 4: Listing uploads from Storage...`);
  const { data: storageFiles, error: listError } = await dbCall(
    supabase.storage.from(UPLOADS_BUCKET4).list(attemptFolder),
    "list uploads"
  );
  if (listError) throw new Error(`Failed to list uploads: ${listError.message}`);
  const uploads = (storageFiles ?? []).filter((f) => f.name && !f.name.endsWith("/")).map((f) => ({
    storagePath: `${attemptFolder}/${f.name}`,
    filename: f.name,
    mimeType: f.metadata?.mimetype ?? "application/octet-stream"
  }));
  console.log(`    Found ${uploads.length} uploaded file(s)`);
  const { error: step5Err } = await dbCall(
    supabase.from("orders").update({ status: "under_review" }).eq("id", orderId),
    "update order under_review"
  );
  if (step5Err) console.error(`  Step 5 ERROR: ${step5Err.message}`);
  console.log(`  Step 5: Order \u2192 under_review`);
  let knownReviewIssues = [];
  const requiredDocs = credit.required_customer_documents ?? [];
  if (uploads.length === 0 && requiredDocs.length > 0 && attemptNumber === 1) {
    console.log(`  Step 6: No uploads but credit requires ${requiredDocs.length} document(s) \u2014 requesting documents.`);
    await supabase.from("runs").update({
      status: "failed",
      review_issues: requiredDocs,
      completed_at: (/* @__PURE__ */ new Date()).toISOString(),
      error_message: "Required documents not uploaded"
    }).eq("id", runId);
    await supabase.from("orders").update({ status: "documents_requested" }).eq("id", orderId);
    await logAuditEvent({
      eventType: "documents_requested",
      entityType: "order",
      entityId: orderId,
      customerId: order.customer_id,
      metadata: { attemptNumber, issueCount: requiredDocs.length, issues: requiredDocs, reason: "no_uploads" }
    });
    return { orderId, runId, status: "documents_requested", issues: requiredDocs };
  }
  let reviewResult = null;
  if (uploads.length > 0) {
    console.log(`  Step 6: Running document review...`);
    reviewResult = await reviewDocuments(
      orderId,
      order.customer_id,
      credit.credit_code,
      uploads,
      creditData.customerUploads
    );
  } else {
    console.log(`  Step 6: No uploads and no required documents \u2014 proceeding directly.`);
  }
  let drawingReviewIssues = [];
  if (attemptNumber === 1 && !project.auto_extracted) {
    const { data: drawingFiles } = await dbCall(
      supabase.storage.from(UPLOADS_BUCKET4).list(drawingsPath(order.customer_id, order.project_id)),
      "list drawings for review"
    );
    const drawingPathsForReview = (drawingFiles ?? []).filter((f) => f.name?.endsWith(".pdf")).map((f) => `${drawingsPath(order.customer_id, order.project_id)}/${f.name}`);
    if (drawingPathsForReview.length > 0) {
      console.log(`  Step 6.5: Reviewing ${drawingPathsForReview.length} drawing file(s)...`);
      const drawingReview = await reviewDrawings(
        order.customer_id,
        order.project_id,
        drawingPathsForReview
      );
      if (!drawingReview.acceptable) {
        drawingReviewIssues = drawingReview.issues;
        console.log(`  Step 6.5: Drawing review found ${drawingReviewIssues.length} issue(s)`);
      } else {
        console.log(`  Step 6.5: Drawings acceptable`);
      }
    } else {
      console.log(`  Step 6.5: No drawings uploaded \u2014 skipping drawing review`);
    }
  } else if (project.auto_extracted) {
    console.log(`  Step 6.5: Drawings already analyzed \u2014 skipping drawing review`);
  } else {
    console.log(`  Step 6.5: Attempt ${attemptNumber} \u2014 skipping drawing review`);
  }
  const documentIssueStrings = reviewResult?.status === "incomplete" ? reviewResult.issues.map((i) => i.issue) : [];
  const allReviewIssues = [...documentIssueStrings, ...drawingReviewIssues];
  if (allReviewIssues.length > 0) {
    if (attemptNumber === 1) {
      console.log(`  Step 7: Review incomplete (attempt 1) \u2014 ${allReviewIssues.length} issue(s). Notifying customer.`);
      await supabase.from("runs").update({
        status: "failed",
        review_issues: allReviewIssues,
        completed_at: (/* @__PURE__ */ new Date()).toISOString(),
        error_message: "Document review incomplete"
      }).eq("id", runId);
      await supabase.from("orders").update({ status: "documents_requested" }).eq("id", orderId);
      await logAuditEvent({
        eventType: "documents_requested",
        entityType: "order",
        entityId: orderId,
        customerId: order.customer_id,
        metadata: { attemptNumber, issueCount: allReviewIssues.length, issues: allReviewIssues }
      });
      return { orderId, runId, status: "documents_requested", issues: allReviewIssues };
    }
    console.log(`  Step 7: Review incomplete (attempt ${attemptNumber}) \u2014 proceeding with best-effort run. Issues: ${allReviewIssues.join("; ")}`);
    knownReviewIssues = allReviewIssues;
    await supabase.from("runs").update({
      review_issues: allReviewIssues
    }).eq("id", runId);
  }
  console.log(`  Step 7.5: Validating project address: "${project.address ?? "(none)"}"...`);
  const addrResult = await validateAddress(project.address ?? "");
  if (!addrResult.valid) {
    console.warn(`  Step 7.5: \u2717 Address invalid \u2014 ${addrResult.reason}`);
    await supabase.from("runs").update({
      status: "address_invalid",
      error_message: addrResult.reason,
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", runId);
    try {
      await sendAddressInvalidEmail({
        to: customer.email,
        name: customer.name ?? "there",
        creditName: credit.credit_name,
        projectId: project.id,
        reason: addrResult.reason
      });
    } catch (emailErr) {
      console.warn(`  Step 7.5: Failed to send address invalid email: ${emailErr.message}`);
    }
    return { orderId, runId, status: "failed", issues: [addrResult.reason] };
  }
  console.log(`  Step 7.5: \u2713 ${addrResult.reason}`);
  const { error: step8OrderErr } = await dbCall(
    supabase.from("orders").update({ status: "processing" }).eq("id", orderId),
    "update order processing"
  );
  if (step8OrderErr) console.error(`  Step 8 ORDER ERROR: ${step8OrderErr.message}`);
  const { error: step8RunErr } = await dbCall(
    supabase.from("runs").update({ status: "processing" }).eq("id", runId),
    "update run processing"
  );
  if (step8RunErr) console.error(`  Step 8 RUN ERROR: ${step8RunErr.message}`);
  console.log(`  Step 8: Order \u2192 processing`);
  console.log(`  Step 9: Downloading ${uploads.length} customer file(s)...`);
  const uploadBuffers = [];
  for (const upload of uploads) {
    const { data: data2, error } = await dbCall(
      supabase.storage.from(UPLOADS_BUCKET4).download(upload.storagePath),
      `download ${upload.filename}`
    );
    if (error || !data2) throw new Error(`Failed to download ${upload.storagePath}: ${error?.message}`);
    uploadBuffers.push({
      filename: upload.filename,
      buffer: Buffer.from(await data2.arrayBuffer()),
      mimeType: upload.mimeType
    });
    console.log(`    \u2713 ${upload.filename}`);
  }
  console.log(`  Step 10: Checking drawing analysis status...`);
  if (!project.auto_extracted) {
    const { data: drawingFiles } = await dbCall(
      supabase.storage.from(UPLOADS_BUCKET4).list(drawingsPath(order.customer_id, order.project_id)),
      "list drawings"
    );
    const drawingPaths = (drawingFiles ?? []).filter((f) => f.name?.endsWith(".pdf")).map((f) => `${drawingsPath(order.customer_id, order.project_id)}/${f.name}`);
    if (drawingPaths.length > 0) {
      console.log(`    Running drawing analysis on ${drawingPaths.length} drawing(s)...`);
      await analyzeDrawings(order.project_id, order.customer_id, drawingPaths);
    } else {
      console.log(`    No drawings uploaded \u2014 skipping drawing analysis`);
    }
  } else {
    console.log(`    Drawing analysis already complete`);
  }
  console.log(`  Step 10.5: Checking specs extraction status...`);
  let specsProfileBlock = "";
  const specFiles = uploadBuffers.filter((u) => {
    const ext = path9.extname(u.filename).toLowerCase();
    return [".pdf", ".rtf", ".docx", ".doc", ".txt"].includes(ext) && !u.filename.toLowerCase().includes("drawing") && !u.filename.toLowerCase().includes("annotated");
  });
  if (!project.specs_extracted && specFiles.length > 0) {
    console.log(`    Running specs extraction on ${specFiles.length} document(s)...`);
    try {
      const specsProfile = await extractSpecs(order.project_id, order.customer_id, specFiles);
      specsProfileBlock = formatSpecsProfileForContext(specsProfile);
      console.log(`    \u2713 Specs extracted \u2014 ${specsProfile.product_count} products`);
    } catch (err) {
      console.warn(`    \u26A0 Specs extraction failed: ${err.message} \u2014 continuing without specs profile`);
    }
  } else if (project.specs_extracted) {
    console.log(`    Specs already extracted \u2014 loading stored profile...`);
    try {
      const specsProfile = await loadSpecsProfile(order.customer_id, order.project_id);
      if (specsProfile) {
        specsProfileBlock = formatSpecsProfileForContext(specsProfile);
        console.log(`    \u2713 Specs profile loaded \u2014 ${specsProfile.product_count} products`);
      }
    } catch (err) {
      console.warn(`    \u26A0 Could not load specs profile: ${err.message}`);
    }
  } else {
    console.log(`    No spec documents uploaded \u2014 skipping`);
  }
  console.log(`  Step 10.6: Checking document extraction status...`);
  let docProfilesBlock = "";
  const docProfiles = project.doc_profiles_extracted ?? {};
  const docFiles = uploadBuffers.filter((u) => {
    const ext = path9.extname(u.filename).toLowerCase();
    const name = u.filename.toLowerCase();
    return [".pdf", ".rtf", ".docx", ".doc"].includes(ext) && !name.includes("drawing") && !name.includes("annotated") && !name.includes("spec") && !name.includes("specification");
  });
  if (docFiles.length > 0) {
    for (const file of docFiles) {
      try {
        const profile = await extractDocument(order.project_id, order.customer_id, {
          filename: file.filename,
          buffer: file.buffer,
          mimeType: file.mimeType
        });
        docProfiles[profile.type_slug] = true;
        console.log(`    \u2713 ${profile.type_slug} profile extracted from ${file.filename}`);
      } catch (err) {
        console.warn(`    \u26A0 Document extraction failed for ${file.filename}: ${err.message}`);
      }
    }
  }
  try {
    const storedProfiles = await loadAllDocumentProfiles(order.customer_id, order.project_id);
    if (storedProfiles.length > 0) {
      docProfilesBlock = formatAllDocumentProfilesForContext(storedProfiles);
      console.log(`    \u2713 ${storedProfiles.length} document profile(s) loaded for context`);
    }
  } catch (err) {
    console.warn(`    \u26A0 Could not load document profiles: ${err.message}`);
  }
  console.log(`  Step 11: Loading project profile...`);
  const profilePath = `${order.customer_id}/${order.project_id}/project-profile.json`;
  let projectProfile = {};
  const { data: profileData } = await dbCall(
    supabase.storage.from(UPLOADS_BUCKET4).download(profilePath),
    "download project profile"
  );
  if (profileData) {
    try {
      projectProfile = JSON.parse(await profileData.text());
    } catch {
      console.warn(`    Failed to parse project-profile.json \u2014 continuing without it`);
    }
  }
  console.log(`  Step 12: Loading credit requirements PDF from pipeline/reference...`);
  const pdfLookup = findCreditPdfBuffer(
    credit.program,
    credit.category,
    credit.credit_code,
    credit.credit_name
  );
  if ("found" in pdfLookup) {
    const expectedName = buildExpectedPdfName(credit.program, credit.credit_code, credit.credit_name);
    console.error(`  Step 12: \u2717 Requirements PDF not found`);
    console.error(`    Directory searched : ${pdfLookup.searchedDir}`);
    console.error(`    Expected filename  : ${expectedName}`);
    console.error(`    Files present      : ${pdfLookup.filesFound.length === 0 ? "(none)" : pdfLookup.filesFound.join(", ")}`);
    console.error(`    Add the correct PDF to pipeline/reference/ and re-run.`);
    const errMsg = `Requirements PDF not found \u2014 searched: ${pdfLookup.searchedDir} \u2014 expected: ${expectedName}`;
    await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
    await supabase.from("runs").update({
      status: "failed",
      error_message: errMsg,
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", runId);
    return { orderId, runId, status: "failed", issues: [errMsg] };
  }
  const reqPdfBuffer = pdfLookup.buffer;
  console.log(`    \u2713 Found: ${pdfLookup.resolvedPath.replace(process.cwd() + path9.sep, "")}`);
  const appendixDocBlocks = [];
  if (isLeed(credit.credit_code)) {
    const appendixNums = scanPdfForAppendixRefs(reqPdfBuffer);
    if (appendixNums.length > 0) {
      console.log(`  Step 12.7: Found references to appendix/appendices: ${appendixNums.join(", ")}`);
      const appendices = loadLeedAppendices(appendixNums);
      for (const ap of appendices) {
        appendixDocBlocks.push(preparePdfDocument(ap.buffer, `LEED v4.1 BD+C Guide \u2014 Appendix ${ap.num}`));
        console.log(`    \u2713 Loaded: ${ap.filename}`);
      }
      if (appendices.length === 0) {
        console.log(`    No matching appendix files found in platform-reference/leed/`);
      }
    } else {
      console.log(`  Step 12.7: No appendix references found in requirements PDF`);
    }
  }
  let referenceDataBlock = "";
  if (isLeed(credit.credit_code)) {
    console.log(`  Step 12.5: Loading LEED reference files for ${credit.credit_code}...`);
    try {
      referenceDataBlock = loadLeedReferenceData(
        credit.credit_code,
        creditData.creditName,
        creditData.platformFiles.calculatorInfo !== null
      );
      const fieldCount = (referenceDataBlock.match(/"fieldId"/g) ?? []).length;
      console.log(`    \u2713 Reference data loaded (${fieldCount} form fields)`);
    } catch (err) {
      console.warn(`    \u26A0 Reference file load failed: ${err.message} \u2014 continuing without reference data`);
    }
  } else {
    console.warn(`  Step 12.5: WELL reference files not yet loaded \u2014 processing with web search and customer documents only`);
  }
  console.log(`  Step 13: Checking for required map outputs...`);
  const requiredMapType = detectRequiredMapType(creditData.outputs);
  console.log(`    Map required: ${requiredMapType ?? "none"}`);
  console.log(`  Step 14: Building prompt...`);
  const creditDataBlock = formatCreditDataForPrompt(creditData);
  const registrationLines = [];
  if (project.regular_occupants != null) registrationLines.push(`  regular_occupants: ${project.regular_occupants}`);
  if (project.peak_visitors != null) registrationLines.push(`  peak_visitors: ${project.peak_visitors}`);
  const projectDataBlock = [
    "DATA CONFLICT RULE: Where any uploaded document conflicts with owner-entered data below, always defer to the owner-entered data \u2014 the customer has reviewed and confirmed it. Use documents to fill gaps, not to override.",
    "",
    "PROJECT DATA (extracted from construction drawings):",
    ...Object.entries(projectProfile).filter(([k, v]) => k !== "analyzed_at" && v !== null && v !== void 0).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`),
    "",
    "PROJECT ADDRESS (owner-entered \u2014 use this exact address for ALL location-based lookups including transit, walk score, distances, census data, and any web search requiring a location):",
    `  address: ${project.address ?? "(not provided)"}`,
    ...registrationLines.length > 0 ? ["", "PROJECT REGISTRATION DATA (owner-entered \u2014 use these values for all occupancy calculations, do not estimate):"].concat(registrationLines) : [],
    ...specsProfileBlock ? ["", specsProfileBlock] : [],
    ...docProfilesBlock ? ["", docProfilesBlock] : [],
    ...project.project_narrative ? ["", "PROJECT NARRATIVE (owner-provided context \u2014 use this to supplement drawing-extracted data):", `  ${project.project_narrative}`] : []
  ].join("\n");
  const compliancePathBlock = run.compliance_path ? [
    "COMPLIANCE PATH (customer-selected \u2014 follow this path exclusively):",
    `  ${run.compliance_path}`,
    "  Do not select a different option or document multiple options. Document only the path the customer has specified.",
    ""
  ].join("\n") : "";
  const userPromptPart1 = [
    creditDataBlock,
    "",
    projectDataBlock,
    ...compliancePathBlock ? ["", compliancePathBlock] : [],
    "",
    "Generate PART 1 \u2014 THE ONLINE FORM SECTION for this credit as instructed."
  ].join("\n");
  const userPromptPart2 = [
    creditDataBlock,
    "",
    projectDataBlock,
    ...compliancePathBlock ? ["", compliancePathBlock] : [],
    "",
    "Generate PART 2 \u2014 SUPPORTING PROJECT DOCUMENTATION (Section A: Retrieved Data, Section B: Generated Outputs) AND PART 3 \u2014 COMPLETE SUBMISSION CHECKLIST for this credit as instructed. Both are required. Do not omit either."
  ].join("\n");
  const PROGRAM_DISPLAY_NAMES = {
    leed_bdc_v41: "LEED v4.1 BD+C",
    well_v2: "WELL v2",
    well_hsr: "WELL Health-Safety Rating"
  };
  const programDisplayName = PROGRAM_DISPLAY_NAMES[credit.program] ?? credit.program;
  const basePrompt = CREDIT_SUBMISSION_PROMPT.replace(/\{\{PROGRAM_DISPLAY_NAME\}\}/g, programDisplayName);
  const transitMapInstruction = requiredMapType === "transit-stops" ? `

${"\u2550".repeat(60)}
TRANSIT MAP \u2014 REQUIRED STRUCTURED OUTPUT \u2014 NO EXCEPTIONS
${"\u2550".repeat(60)}

This credit requires a walking-distance map to qualifying transit stops. The map is generated programmatically from stop addresses \u2014 it cannot be generated without them.

At the very end of your Part 1 output, after all other content, you MUST append this exact HTML comment:

<!-- QUALIFYING_TRANSIT_STOPS: {"threshold_miles": 0.25, "stops": [{"address":"STOP_STREET_ADDRESS_OR_LAT_LNG","label":"Stop Name"},{"address":"STOP_STREET_ADDRESS_OR_LAT_LNG","label":"Stop Name"},...]} -->

Rules:
- "threshold_miles": the maximum walking distance (in miles) that qualifies for this credit \u2014 set this from the credit requirements, not a guess
- "stops": every stop confirmed as qualifying \u2014 only stops with verified Google Maps walking distances within threshold_miles. Do NOT include stops whose distance you estimated or could not verify via web search
- The "address" field must be a geocodable street address or intersection (e.g. "Main St & 2nd Ave, Chicago, IL") or lat,lng string \u2014 NOT a stop name alone
- The "label" field is the human-readable stop name or route shown on the map
- Valid JSON only \u2014 no trailing commas, no single quotes
- The pipeline re-measures all distances via Google Maps and filters against threshold_miles \u2014 stops you include that are beyond the threshold will be excluded from the map
- If no stops qualify, append: <!-- QUALIFYING_TRANSIT_STOPS: {"threshold_miles": 0.25, "stops": []} -->
` : "";
  const systemPrompt = [
    basePrompt,
    transitMapInstruction,
    ...additionalInstructions ? [`

${"\u2550".repeat(60)}
QA REVIEW INSTRUCTIONS \u2014 INCORPORATE THESE CHANGES:
${"\u2550".repeat(60)}
${additionalInstructions}`] : []
  ].join("");
  const reqDocBlock = preparePdfDocument(reqPdfBuffer, `Requirements: ${credit.credit_code}`);
  const uploadDocBlocks = uploadBuffers.map(
    (u) => u.mimeType === "application/pdf" ? preparePdfDocument(u.buffer, u.filename) : null
  ).filter(Boolean);
  const hasForm = !!creditData.platformFiles.formLink;
  console.log(`  Step 15: Running Claude API (${hasForm ? "two-pass" : "single-pass"}, temperature: 0)...`);
  const refBlock = referenceDataBlock ? [{ type: "text", text: referenceDataBlock }] : [];
  let part1Html = "";
  if (hasForm) {
    const part1Response = await client2.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 64e3,
      temperature: 0,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL],
      messages: [{
        role: "user",
        content: [
          ...refBlock,
          reqDocBlock,
          ...appendixDocBlocks,
          ...uploadDocBlocks,
          { type: "text", text: userPromptPart1 }
        ]
      }]
    });
    const part1AllText = part1Response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    part1Html = scrubNarration(part1AllText).cleaned;
    console.log(`    Part 1 complete \u2014 ${part1Response.usage.output_tokens} output tokens (${part1Response.content.filter((b) => b.type === "text").length} text block(s))`);
  } else {
    console.log(`    No form link \u2014 skipping Part 1, running single-pass`);
  }
  let locationsForMap = [];
  if (requiredMapType && project.address) {
    console.log(`  Step 15.7: Extracting locations from Part 1 output...`);
    const transitComment = part1Html.match(/<!--\s*QUALIFYING_TRANSIT_STOPS:\s*(\{[\s\S]*?\})\s*-->/);
    if (transitComment) {
      try {
        const parsed = JSON.parse(transitComment[1]);
        const thresholdMiles = typeof parsed.threshold_miles === "number" ? parsed.threshold_miles : 0.5;
        const rawStops = (parsed.stops ?? []).filter((l) => l && typeof l.address === "string" && l.address.trim().length > 0).slice(0, 8).map((l, i) => ({ address: l.address.trim(), label: l.label ?? String(i + 1) }));
        console.log(`    Parsed ${rawStops.length} transit stop(s) from structured comment (threshold: ${thresholdMiles} mi)`);
        if (rawStops.length > 0) {
          console.log(`    Re-measuring walking distances via Google Maps...`);
          const routes = await measureWalkingDistances(project.address, rawStops);
          for (const route of routes) {
            const actualMi = route.distanceMiles;
            const qualifies = actualMi <= thresholdMiles;
            console.log(`      ${route.destination.label}: ${actualMi.toFixed(2)} mi (threshold ${thresholdMiles} mi) \u2014 ${qualifies ? "INCLUDED" : "EXCLUDED"}`);
            if (qualifies) {
              locationsForMap.push(route.destination);
            }
          }
          console.log(`    ${locationsForMap.length} of ${rawStops.length} stop(s) confirmed within threshold`);
        }
      } catch (err) {
        console.warn(`  Step 15.7: Transit stop comment parse/measure failed: ${err.message} \u2014 falling back to Haiku`);
      }
    }
    if (locationsForMap.length === 0) {
      try {
        const plainText = part1Html.replace(/<[^>]+>/g, " ").slice(0, 15e3);
        const locExtract = await client2.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{
            role: "user",
            content: `The project is located at: ${project.address}

Extract up to 2 specific named locations (street addresses, transit stops, stations, intersections, named facilities) from the text below that meet BOTH of the following conditions:
1. They are documented as qualifying for points in this credit \u2014 meaning they appear in a compliance table, point calculation, or qualifying items list, not merely mentioned as context or examples.
2. They are in the same city or immediate surrounding area as the project \u2014 not in other cities, regions, or states.

Return ONLY a valid JSON array of strings. If none found return [].

${plainText}`
          }]
        });
        const locText = locExtract.content[0]?.text ?? "[]";
        const jsonMatch = locText.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const raw = JSON.parse(jsonMatch[0]);
          locationsForMap = raw.filter((l) => typeof l === "string" && l.trim().length > 0).slice(0, 2).map((addr, i) => ({ address: addr, label: String(i + 1) }));
        }
        console.log(`    Extracted ${locationsForMap.length} location(s) via Haiku`);
      } catch (err) {
        console.warn(`  Step 15.7: Haiku extraction failed: ${err.message} \u2014 using claudeRetrieves fallback`);
      }
    }
    if (locationsForMap.length === 0) {
      locationsForMap = creditData.claudeRetrieves.slice(0, 2).map((r, i) => ({ address: r, label: String(i + 1) }));
      console.log(`    Using ${locationsForMap.length} claudeRetrieves item(s) as map destinations`);
    }
  }
  let mapBuffer = null;
  let mapBase64 = null;
  if (requiredMapType && project.address && locationsForMap.length > 0) {
    console.log(`  Step 15.8: Generating ${requiredMapType} map (${locationsForMap.length} destination(s))...`);
    try {
      const mapResult = await generateMap({
        originAddress: project.address,
        destinations: locationsForMap,
        mapType: requiredMapType
      });
      mapBuffer = mapResult.pngBuffer;
      mapBase64 = mapBuffer.toString("base64");
      console.log(`  Step 15.8: \u2713 Map generated \u2014 ${mapBuffer.length} bytes`);
    } catch (e) {
      console.warn(`  Step 15.8: Map generation failed: ${e.message} \u2014 continuing without map`);
    }
  } else if (requiredMapType) {
    console.log(`  Step 15.8: Map required but no destinations found \u2014 skipping`);
  } else {
    console.log(`  Step 15.8: No map required`);
  }
  const mapContentBlocks = mapBase64 ? [
    {
      type: "text",
      text: "A walking-distance map has been generated for this project (image below). In Part 2, place exactly one <img data-map-insert='1'> element at the most relevant location (walking distances section, transit access section, or site context section). The system will replace this placeholder with the actual map image."
    },
    {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: mapBase64 }
    }
  ] : [];
  const part2Response = await client2.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 64e3,
    temperature: 0,
    system: systemPrompt,
    tools: [WEB_SEARCH_TOOL],
    messages: [{
      role: "user",
      content: [
        ...refBlock,
        ...hasForm && part1Html ? [{ type: "text", text: `PART 1 OUTPUT (completed \u2014 do not regenerate):
${part1Html}` }] : [],
        ...mapContentBlocks,
        reqDocBlock,
        ...appendixDocBlocks,
        ...uploadDocBlocks,
        { type: "text", text: userPromptPart2 }
      ]
    }]
  });
  const part2AllText = part2Response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const part2Html = scrubNarration(part2AllText).cleaned;
  console.log(`    Part 2 complete \u2014 ${part2Response.usage.output_tokens} output tokens (${part2Response.content.filter((b) => b.type === "text").length} text block(s))`);
  let fullHtml = part1Html;
  const bodyCloseIdx = fullHtml.lastIndexOf("</body>");
  if (bodyCloseIdx !== -1) {
    fullHtml = fullHtml.slice(0, bodyCloseIdx) + "\n" + part2Html + "\n</body></html>";
  } else {
    fullHtml += "\n" + part2Html;
  }
  if (mapBuffer) {
    const mapDataUri = `data:image/png;base64,${mapBuffer.toString("base64")}`;
    fullHtml = fullHtml.replace(
      /<img\s+data-map-insert[^>]*\/?>/gi,
      `<img src="${mapDataUri}" alt="Walking distance map" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;display:block;">`
    );
  }
  let calcGuide = null;
  const hasCalculator = !!creditData.platformFiles.calculatorInfo;
  let calcGuideAppended = false;
  if (hasCalculator) {
    console.log(`  Step 15.5: Generating Calculator Input Guide \u2014 ${creditData.platformFiles.calculatorInfo}`);
    try {
      const calcProjectData = [
        projectDataBlock,
        "",
        `CREDIT: ${creditData.creditNumber} \u2014 ${creditData.creditName}`,
        "",
        "GENERATED HTML OUTPUT (ventilation data):",
        fullHtml.slice(0, 3e4)
      ].join("\n");
      calcGuide = await generateCalculatorGuide(
        client2,
        creditDataBlock,
        creditData.creditName,
        calcProjectData,
        { input: 0, output: 0 }
      );
      if (calcGuide && !calcGuide.skipped) {
        console.log(`  Step 15.5: \u2713 Calculator Input Guide \u2014 ${calcGuide.calculatorName} (${calcGuide.fieldCount} fields, ${calcGuide.tabCount} tabs)`);
        const bodyClose = fullHtml.lastIndexOf("</body>");
        fullHtml = bodyClose !== -1 ? fullHtml.slice(0, bodyClose) + calcGuide.html + "\n</body></html>" : fullHtml + calcGuide.html;
        calcGuideAppended = true;
      } else {
        console.warn(`  Step 15.5: \u26A0 Calculator Guide skipped \u2014 ${calcGuide?.skipReason ?? "unknown reason"}`);
        if (calcGuide?.html) {
          const bodyClose = fullHtml.lastIndexOf("</body>");
          fullHtml = bodyClose !== -1 ? fullHtml.slice(0, bodyClose) + calcGuide.html + "\n</body></html>" : fullHtml + calcGuide.html;
          calcGuideAppended = true;
        }
      }
    } catch (err) {
      console.error(`  Step 15.5: \u2717 Calculator Guide error \u2014 ${err.message}`);
    }
    if (!calcGuideAppended) {
      console.warn(`  Step 15.5: Calculator guide not appended \u2014 injecting placeholder`);
      const placeholder = `
<div class="section-header">USGBC Calculator Input Guide</div>
<div class="section-body">
  <div class="warn-note">This item could not be completed. See the document review summary below.</div>
</div>`;
      const bodyClose = fullHtml.lastIndexOf("</body>");
      fullHtml = bodyClose !== -1 ? fullHtml.slice(0, bodyClose) + placeholder + "\n</body></html>" : fullHtml + placeholder;
    }
  } else {
    console.log(`  Step 15.5: No calculator required for ${creditData.creditNumber}`);
  }
  const calcGuideViolations = validateCalculatorGuidePresent(fullHtml, creditDataBlock);
  calcGuideViolations.forEach((v) => console.warn(`  \u26A0 QA: ${v.description}`));
  const violations = validateNoUnnecessaryCustomerRequests(fullHtml);
  violations.forEach((v) => console.warn(`  \u26A0 QA: unnecessary customer request \u2014 ${v.description}`));
  const missingOutputs = validateAllOutputsProduced(fullHtml, creditData.outputs);
  missingOutputs.forEach((v) => console.warn(`  \u26A0 QA: output may be missing \u2014 ${v.description}`));
  if (knownReviewIssues.length > 0) {
    console.log(`  Appending document review summary (${knownReviewIssues.length} issue(s))`);
    const issueItems = knownReviewIssues.map((iss) => `<li>${iss}</li>`).join("\n        ");
    const reviewSummary = `
<div class="section-header">Document Review Summary</div>
<div class="section-body">
  <div class="warn-box">
    <p>This submission was processed with the following document deficiencies identified during review:</p>
    <ul>
        ${issueItems}
    </ul>
    <p>Items marked "could not be completed" within this document were not generated due to these deficiencies. Reprocessing with complete documentation requires a new order.</p>
  </div>
</div>`;
    const bodyClose = fullHtml.lastIndexOf("</body>");
    fullHtml = bodyClose !== -1 ? fullHtml.slice(0, bodyClose) + reviewSummary + "\n</body></html>" : fullHtml + reviewSummary;
  }
  const { cleanedHtml: gatedHtml } = validateAllDeliverables({
    htmlContent: fullHtml,
    requiredMapType,
    mapGenerated: !!mapBuffer
  });
  fullHtml = gatedHtml;
  if (containsNarration(fullHtml)) {
    console.warn(`  Step 16.5: Narration survived final scrub \u2014 delivering with QA flag`);
  }
  if (fullHtml.length <= 100) {
    console.error(`  Step 16.5: \u2717 No HTML generated \u2014 hard failing`);
    await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
    await supabase.from("runs").update({
      status: "failed",
      error_message: "Claude API did not return HTML output",
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", runId);
    return { orderId, runId, status: "failed", issues: ["Claude API did not return HTML output"] };
  }
  console.log(`  Step 16.5: \u2713 HTML confirmed \u2014 proceeding to delivery`);
  console.log(`  Step 18: Uploading outputs to Storage...`);
  const outputPaths = [];
  const standardHtml = injectTableCss(fullHtml);
  const editableHtml = makeEditable(fullHtml);
  const htmlPath = `${outputsFolder}/submission.html`;
  const { error: htmlErr } = await dbCall(
    supabase.storage.from(OUTPUTS_BUCKET2).upload(htmlPath, Buffer.from(standardHtml), { upsert: true, contentType: "text/html" }),
    "upload submission.html"
  );
  if (htmlErr) throw new Error(`Failed to upload HTML output: ${htmlErr.message}`);
  outputPaths.push(htmlPath);
  console.log(`    \u2713 submission.html`);
  const editablePath = `${outputsFolder}/submission-editable.html`;
  const { error: editErr } = await dbCall(
    supabase.storage.from(OUTPUTS_BUCKET2).upload(editablePath, Buffer.from(editableHtml), { upsert: true, contentType: "text/html" }),
    "upload submission-editable.html"
  );
  if (editErr) console.warn(`    Editable HTML upload failed: ${editErr.message}`);
  else {
    outputPaths.push(editablePath);
    console.log(`    \u2713 submission-editable.html`);
  }
  if (mapBuffer) {
    const mapPath = `${outputsFolder}/walking-distance-map.png`;
    const { error: mapErr } = await dbCall(
      supabase.storage.from(OUTPUTS_BUCKET2).upload(mapPath, new Blob([new Uint8Array(mapBuffer)], { type: "image/png" }), { upsert: true }),
      "upload map PNG"
    );
    if (mapErr) console.warn(`    Map upload failed: ${mapErr.message}`);
    else {
      outputPaths.push(mapPath);
      console.log(`    \u2713 walking-distance-map.png`);
    }
  }
  console.log(`  Step 18: Marking order complete...`);
  const deliveryScheduledAt = new Date(Date.now() + 47 * 60 * 60 * 1e3);
  const { error: step18RunErr } = await dbCall(
    supabase.from("runs").update({
      status: "completed",
      completed_at: (/* @__PURE__ */ new Date()).toISOString(),
      output_html_path: htmlPath
    }).eq("id", runId),
    "update run completed"
  );
  if (step18RunErr) throw new Error(`Step 18: Failed to mark run completed: ${step18RunErr.message}`);
  const { error: step18OrderErr } = await dbCall(
    supabase.from("orders").update({
      status: "complete",
      delivery_scheduled_at: deliveryScheduledAt.toISOString(),
      qa_status: "pending_review"
    }).eq("id", orderId),
    "update order complete"
  );
  if (step18OrderErr) throw new Error(`Step 18: Failed to mark order complete: ${step18OrderErr.message}`);
  const attemptFilePaths = uploads.map((u) => u.storagePath);
  if (attemptFilePaths.length > 0) {
    await supabase.from("cleanup_queue").insert({
      order_id: orderId,
      file_paths: attemptFilePaths
    });
  }
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://liminalsva.com";
    const token = signQaToken(orderId);
    const [standardUrlRes, editableUrlRes] = await Promise.all([
      supabase.storage.from(OUTPUTS_BUCKET2).createSignedUrl(htmlPath, 7 * 24 * 3600),
      supabase.storage.from(OUTPUTS_BUCKET2).createSignedUrl(editablePath, 7 * 24 * 3600)
    ]);
    await sendQAReviewEmail({
      customerName: customer.name ?? "Customer",
      customerEmail: customer.email,
      creditName: credit.credit_name,
      projectName: project.name,
      orderId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      deliveryScheduledAt: deliveryScheduledAt.toISOString(),
      standardHtmlUrl: standardUrlRes.data?.signedUrl ?? `${appUrl}/orders/${orderId}`,
      editableHtmlUrl: editableUrlRes.data?.signedUrl ?? `${appUrl}/orders/${orderId}`,
      approveUrl: `${appUrl}/api/admin/orders/${orderId}/approve?token=${token}`,
      requestChangesUrl: `${appUrl}/admin/orders/${orderId}/review?token=${token}`,
      isRegeneration: !!additionalInstructions,
      changeInstructions: additionalInstructions
    });
    console.log(`  Step 18.5: \u2713 QA review email sent`);
  } catch (e) {
    console.error(`  Step 18.5: QA review email failed: ${e.message}`);
  }
  const totalTokens = part2Response.usage.input_tokens + part2Response.usage.output_tokens;
  await logAuditEvent({
    eventType: "order_complete",
    entityType: "order",
    entityId: orderId,
    customerId: order.customer_id,
    metadata: {
      creditCode: credit.credit_code,
      attemptNumber,
      outputCount: outputPaths.length,
      mapGenerated: !!mapBuffer,
      calcGenerated: !!(calcGuide && !calcGuide.skipped),
      totalTokens
    }
  });
  console.log(`
[process-order] \u2713 Complete \u2014 ${outputPaths.length} output(s) uploaded`);
  return { orderId, runId, status: "complete", outputPaths };
}
var import_sdk6, path9, fs10, envPath3, UPLOADS_BUCKET4, OUTPUTS_BUCKET2, REF_BASE, PROGRAM_REF_SUBDIR, LEED_CODE_RE, MAP_OUTPUT_KEYWORDS, WEB_SEARCH_TOOL;
var init_process_order = __esm({
  "pipeline/process-order.ts"() {
    "use strict";
    import_sdk6 = __toESM(require("@anthropic-ai/sdk"));
    path9 = __toESM(require("path"));
    fs10 = __toESM(require("fs"));
    init_supabase();
    init_extract_xlsx_row();
    init_document_review();
    init_drawing_review();
    init_drawing_analysis();
    init_map_generation();
    init_supabase_ops();
    init_pdf_to_images();
    init_make_editable();
    init_calculator_guide();
    init_specs_extract();
    init_document_extract();
    init_credit_submission();
    init_resend();
    init_geocode();
    init_qa_token();
    init_validate_output();
    init_pipeline_utils();
    init_output_cleaner();
    envPath3 = path9.resolve(__dirname, "../.env.local");
    if (fs10.existsSync(envPath3)) {
      for (const line of fs10.readFileSync(envPath3, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
    UPLOADS_BUCKET4 = "customer-uploads";
    OUTPUTS_BUCKET2 = "order-outputs";
    REF_BASE = path9.join(process.cwd(), "pipeline/reference");
    PROGRAM_REF_SUBDIR = {
      leed_bdc_v41: "leed",
      well_v2: "well-v2",
      well_hsr: "well-hsr"
    };
    LEED_CODE_RE = /^(LT|SS|WE|EA|MR|EQ|IN|IP)(c|p)\d+$/i;
    MAP_OUTPUT_KEYWORDS = {
      "transit-stops": ["transit", "transit stop", "bus stop", "rail station"],
      "bicycle-facilities": ["bicycle", "bike", "cycling", "cycle"],
      "surrounding-density": ["density", "surrounding", "neighborhood context"],
      "site-context": ["site context", "site map", "vicinity map", "walking distance"]
    };
    WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };
  }
});

// pipeline/worker.ts
var path10 = __toESM(require("path"));
var fs11 = __toESM(require("fs"));
console.log("[worker] starting up...");
try {
  const envPath4 = path10.resolve(__dirname, "../.env.local");
  if (fs11.existsSync(envPath4)) {
    for (const line of fs11.readFileSync(envPath4, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
    console.log("[worker] loaded .env.local");
  }
} catch (err) {
  console.error("[worker] failed to load .env.local:", err.message);
}
var REQUIRED_VARS = [
  "WORKER_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "ANTHROPIC_API_KEY"
];
var missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error("[worker] missing required env vars:", missing.join(", "));
  process.exit(1);
}
console.log("[worker] env vars OK");
var express;
try {
  express = require("express");
  console.log("[worker] express loaded");
} catch (err) {
  console.error("[worker] failed to load express:", err.message);
  process.exit(1);
}
var app = express();
var PORT = process.env.PORT ?? 3001;
var SECRET = process.env.WORKER_SECRET;
app.use(express.json());
app.get("/health", (_req2, res) => {
  res.json({ status: "ok" });
});
app.post("/process", async (req, res) => {
  const authHeader = req.headers["x-worker-secret"];
  if (authHeader !== SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { orderId, runId } = req.body ?? {};
  if (!orderId || !runId) {
    res.status(400).json({ error: "Missing orderId or runId" });
    return;
  }
  res.json({ status: "accepted" });
  const startedAt = Date.now();
  console.log(`[worker] job started  orderId=${orderId} runId=${runId}`);
  try {
    const { createClient: createClient2 } = require("@supabase/supabase-js");
    const supabase = createClient2(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: order } = await supabase.from("orders").select("credit_id").eq("id", orderId).single();
    let result;
    if (!order?.credit_id) {
      const { processGapAnalysis: processGapAnalysis2 } = (init_process_gap_analysis(), __toCommonJS(process_gap_analysis_exports));
      result = await processGapAnalysis2(orderId, runId);
    } else {
      const { processOrder: processOrder2 } = (init_process_order(), __toCommonJS(process_order_exports));
      result = await processOrder2(orderId, runId);
    }
    const elapsed = ((Date.now() - startedAt) / 1e3).toFixed(1);
    console.log(`[worker] job complete orderId=${orderId} runId=${runId} status=${result.status} elapsed=${elapsed}s`);
    if (result.status === "documents_requested") {
      try {
        const { data: orderFull } = await supabase.from("orders").select("customer_id, credit_id, credits(credit_name)").eq("id", orderId).single();
        const { data: customer } = await supabase.from("customers").select("email, name").eq("id", orderFull?.customer_id).single();
        const creditName = orderFull?.credits?.credit_name ?? "your credit";
        const { sendDocumentsRequestedEmail: sendDocumentsRequestedEmail2 } = (init_resend(), __toCommonJS(resend_exports));
        await sendDocumentsRequestedEmail2({
          to: customer?.email ?? "",
          name: customer?.name ?? "there",
          creditName,
          orderId,
          issues: result.issues ?? []
        });
        console.log(`[worker] documents-requested email sent for orderId=${orderId}`);
      } catch (emailErr) {
        console.warn(`[worker] failed to send documents-requested email: ${emailErr.message}`);
      }
    }
  } catch (err) {
    const elapsed = ((Date.now() - startedAt) / 1e3).toFixed(1);
    console.error(`[worker] job failed   orderId=${orderId} runId=${runId} elapsed=${elapsed}s error=${err.message}`);
    console.error(err.stack);
  }
});
try {
  app.listen(PORT, () => {
    console.log(`[worker] listening on port ${PORT}`);
  });
} catch (err) {
  console.error("[worker] failed to start server:", err.message);
  process.exit(1);
}
