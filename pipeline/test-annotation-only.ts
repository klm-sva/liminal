/**
 * Standalone test for the annotated site plan step only.
 * Run: npx ts-node pipeline/test-annotation-only.ts
 */
import * as fs   from "fs";
import * as path from "path";
import Anthropic  from "@anthropic-ai/sdk";
import { locateFeaturesOnPage, annotateDrawing } from "./lib/drawing-annotator";

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

const CIVIL = "/Users/kelsey/Desktop/program automation /example drawing set/Civil006.pdf";
const OUT   = path.resolve(__dirname, "output/lt-bicycle-facilities-annotated-site-plan.png");

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const buf    = fs.readFileSync(CIVIL);

  // Render full page at 150 DPI → 2500px longest side JPEG
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs") as typeof import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require("@napi-rs/canvas") as typeof import("@napi-rs/canvas");
  const sharp = (await import("sharp")).default;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `file://${require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")}`;

  const pdf  = await pdfjsLib.getDocument({ data: new Uint8Array(buf) } as any).promise;
  const pg   = await pdf.getPage(1);
  const vp   = pg.getViewport({ scale: 150 / 72 });
  const W    = Math.round(vp.width);
  const H    = Math.round(vp.height);
  const cvs  = createCanvas(W, H);
  const ctx  = cvs.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  await pg.render({ canvasContext: ctx as any, viewport: vp, canvas: cvs as any }).promise;

  const longest    = Math.max(W, H);
  const resizeOpts = longest > 2500 ? (W >= H ? { width: 2500 } : { height: 2500 }) : {};
  const jpeg       = await sharp(cvs.toBuffer("image/png")).resize(resizeOpts).jpeg({ quality: 92 }).toBuffer();
  console.log(`Full page: ${Math.round(jpeg.length / 1024)} KB — sending to Claude for feature location...`);

  // Civil drawings label racks generically — locate rack symbols/callouts and
  // apply LEED-specific labels (long-term / short-term) in the annotation layer.
  const locs = await locateFeaturesOnPage(client, jpeg, "image/jpeg", [
    "bicycle rack, bike rack, or bicycle parking symbol or callout (primary cluster nearest building entry)",
    "bicycle rack, bike rack, or bicycle parking symbol or callout (secondary cluster or visitor-side location)",
  ]);

  console.log("Location results:", JSON.stringify(locs, null, 2));

  const found = locs.filter((l): l is NonNullable<typeof l> => l !== null);
  if (found.length === 0) {
    console.log("No features located — cannot generate annotated drawing.");
    return;
  }

  const colors  = ["#2b4044", "#327cb9"];
  const labels  = ["LONG-TERM BICYCLE STORAGE",  "SHORT-TERM BICYCLE STORAGE"];
  const sublbls = ["~16 spaces • secured, covered", "~16 spaces • visible from entry"];

  const features = locs.map((loc, i) =>
    loc ? { label: labels[i], sublabel: sublbls[i], tileCol: 0, tileRow: 0, pctX: loc.pctX, pctY: loc.pctY, color: colors[i] } : null
  ).filter((f): f is NonNullable<typeof f> => f !== null);

  console.log(`Annotating drawing with ${features.length} callout(s)...`);
  const png = await annotateDrawing(buf, features, 1, 1);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, png);
  console.log(`Saved: ${OUT} (${Math.round(png.length / 1024)} KB)`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
