/**
 * PDF analysis for drawing sets.
 *
 * Instead of converting PDF pages to raster images (which requires
 * system dependencies like GraphicsMagick), we send PDFs directly to
 * Claude as document blocks. Claude's vision capability reads all pages
 * and returns structured data in a single call.
 *
 * This file handles preparing PDF buffers for the Anthropic API and
 * aggregating multi-page results.
 */

import * as fs from "fs";

export interface PreparedDocument {
  type: "document";
  source: {
    type: "base64";
    media_type: "application/pdf";
    data: string;
  };
  title: string;
}

/**
 * Prepare a PDF file buffer as an Anthropic document block.
 * Reads from a local path or accepts a Buffer directly.
 */
export function preparePdfDocument(
  input: string | Buffer,
  title: string
): PreparedDocument {
  const buf = typeof input === "string" ? fs.readFileSync(input) : input;
  return {
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: buf.toString("base64"),
    },
    title,
  };
}

/**
 * Prepare multiple PDF buffers (e.g., multiple drawing sheets) as an
 * array of document blocks for a single API call.
 */
export function preparePdfDocuments(
  inputs: Array<{ data: string | Buffer; title: string }>
): PreparedDocument[] {
  return inputs.map(({ data, title }) => preparePdfDocument(data, title));
}
