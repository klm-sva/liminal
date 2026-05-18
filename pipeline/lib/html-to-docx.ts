/**
 * HTML → DOCX converter.
 *
 * Converts a complete or partial HTML string into a docx Document.
 * Tables in the HTML are converted to real docx Table objects with borders,
 * header row styling, and proper column width. Images with base64 data URIs
 * are embedded as ImageRun objects.
 *
 * Rules enforced here match the pipeline output rules:
 *   - Every <table> becomes a real docx Table (never plain text)
 *   - <img src="data:..."> images are embedded directly
 *   - Heading levels, bold, italic, bullets are preserved
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { parse as parseHtml, HTMLElement as NHTMLElement, Node } from "node-html-parser";

export { Packer };

// ─── Colour palette ───────────────────────────────────────────────────────────

const BLUE_HEADER  = "327cb9";
const LIGHT_BLUE   = "e8f0f7";
const BORDER_GREY  = "cccccc";
const TEXT_DARK    = "222222";
const TEXT_GREY    = "515062";

// ─── Table builder ────────────────────────────────────────────────────────────

function buildTable(el: NHTMLElement): Table {
  const allRows = el.querySelectorAll("tr");

  const tableRows: TableRow[] = allRows.map((tr, rowIndex) => {
    const cells = tr.querySelectorAll("th, td");
    const isHeader = rowIndex === 0 || cells.some((c) => c.tagName === "TH");

    return new TableRow({
      tableHeader: isHeader,
      children: cells.map((cell) => {
        const text = cell.text.trim();
        const colspan = parseInt(cell.getAttribute("colspan") ?? "1", 10);
        return new TableCell({
          columnSpan: colspan > 1 ? colspan : undefined,
          verticalAlign: VerticalAlign.CENTER,
          shading: isHeader
            ? { fill: BLUE_HEADER, type: ShadingType.SOLID, color: "FFFFFF" }
            : { fill: rowIndex % 2 === 0 ? "FFFFFF" : LIGHT_BLUE, type: ShadingType.SOLID },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: BORDER_GREY },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GREY },
            left:   { style: BorderStyle.SINGLE, size: 4, color: BORDER_GREY },
            right:  { style: BorderStyle.SINGLE, size: 4, color: BORDER_GREY },
          },
          children: [new Paragraph({
            children: [new TextRun({
              text,
              bold:  isHeader,
              color: isHeader ? "FFFFFF" : TEXT_DARK,
              size:  isHeader ? 20 : 18,
            })],
            spacing: { before: 60, after: 60 },
          })],
        });
      }),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows:  tableRows,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 6, color: BORDER_GREY },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_GREY },
      left:   { style: BorderStyle.SINGLE, size: 6, color: BORDER_GREY },
      right:  { style: BorderStyle.SINGLE, size: 6, color: BORDER_GREY },
    },
  });
}

// ─── Image builder ────────────────────────────────────────────────────────────

function buildImageParagraph(el: NHTMLElement): Paragraph | null {
  const src = el.getAttribute("src") ?? "";
  const dataMatch = src.match(/^data:([^;]+);base64,(.+)$/);
  if (!dataMatch) return null;

  const mimeType  = dataMatch[1];
  const b64       = dataMatch[2];
  const imgBuffer = Buffer.from(b64, "base64");

  // Determine image type for docx
  const typeMap: Record<string, "jpg" | "png" | "gif" | "bmp"> = {
    "image/jpeg": "jpg",
    "image/jpg":  "jpg",
    "image/png":  "png",
    "image/gif":  "gif",
    "image/bmp":  "bmp",
  };
  const imgType = typeMap[mimeType] ?? "png";

  // Default to full-width image (approx A4 margins = 595pt → ~800px at 96dpi)
  const widthEmu  = 5486400;  // 6 inches in EMU
  const heightEmu = 4114800;  // 4.5 inches in EMU (4:3)

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { before: 240, after: 240 },
    children:  [
      new ImageRun({
        data:           imgBuffer,
        type:           imgType,
        transformation: { width: widthEmu / 9144, height: heightEmu / 9144 },
      }),
    ],
  });
}

// ─── Text run builder ─────────────────────────────────────────────────────────

function getTextRuns(el: NHTMLElement): TextRun[] {
  const runs: TextRun[] = [];

  function walkInline(node: Node) {
    if (node.nodeType === 3) {
      // Text node
      const text = node.text;
      if (text) runs.push(new TextRun({ text, color: TEXT_DARK }));
      return;
    }
    if (!(node instanceof NHTMLElement)) return;
    const tag = node.tagName?.toLowerCase();
    const isBold   = ["strong", "b"].includes(tag);
    const isItalic = ["em", "i"].includes(tag);
    const isCode   = ["code", "pre"].includes(tag);
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = child.text;
        if (text) runs.push(new TextRun({ text, bold: isBold, italics: isItalic, font: isCode ? "Courier New" : undefined, color: TEXT_DARK }));
      } else if (child instanceof NHTMLElement) {
        walkInline(child);
      }
    }
  }
  walkInline(el);
  return runs.length ? runs : [new TextRun({ text: el.text.trim(), color: TEXT_DARK })];
}

// ─── Main walker ──────────────────────────────────────────────────────────────

function walk(el: NHTMLElement): Array<Paragraph | Table> {
  const tag = el.tagName?.toLowerCase() ?? "";
  const items: Array<Paragraph | Table> = [];

  if (["script", "style", "head", "nav", "footer"].includes(tag)) return items;

  if (tag === "h1") {
    return [new Paragraph({
      text:    el.text.trim(),
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 180 },
      run:     { color: BLUE_HEADER, bold: true },
    })];
  }
  if (tag === "h2") {
    return [new Paragraph({
      text:    el.text.trim(),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 140 },
      run:     { color: BLUE_HEADER, bold: true },
    })];
  }
  if (tag === "h3") {
    return [new Paragraph({
      text:    el.text.trim(),
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 },
      run:     { color: TEXT_GREY, bold: true },
    })];
  }
  if (tag === "h4" || tag === "h5" || tag === "h6") {
    return [new Paragraph({
      children: [new TextRun({ text: el.text.trim(), bold: true, color: TEXT_GREY })],
      spacing:  { before: 160, after: 80 },
    })];
  }
  if (tag === "p") {
    const text = el.text.trim();
    if (!text) return items;
    return [new Paragraph({
      children: getTextRuns(el),
      spacing:  { after: 120 },
    })];
  }
  if (tag === "li") {
    const text = el.text.trim();
    if (!text) return items;
    const parentTag = (el.parentNode as NHTMLElement)?.tagName?.toLowerCase();
    if (parentTag === "ol") {
      return [new Paragraph({
        children:        [new TextRun({ text, color: TEXT_DARK })],
        numbering:       { reference: "default-numbering", level: 0 },
        spacing:         { after: 60 },
      })];
    }
    return [new Paragraph({
      children: [new TextRun({ text, color: TEXT_DARK })],
      bullet:   { level: 0 },
      spacing:  { after: 60 },
    })];
  }
  if (tag === "img") {
    const para = buildImageParagraph(el);
    if (para) return [para];
    return items;
  }
  if (tag === "table") {
    return [
      new Paragraph({ children: [], spacing: { before: 120, after: 0 } }),
      buildTable(el),
      new Paragraph({ children: [], spacing: { before: 0, after: 120 } }),
    ];
  }
  if (tag === "hr") {
    return [new Paragraph({
      children: [],
      border:   { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_GREY } },
      spacing:  { before: 120, after: 120 },
    })];
  }

  // Container elements — recurse into children
  for (const child of el.childNodes) {
    if (child instanceof NHTMLElement) {
      items.push(...walk(child));
    } else if (child.nodeType === 3 && tag === "body") {
      const text = child.text?.trim();
      if (text) items.push(new Paragraph({ children: [new TextRun({ text, color: TEXT_DARK })], spacing: { after: 80 } }));
    }
  }
  return items;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function htmlToDocx(html: string, mapPngBuffer?: Buffer): Document {
  const root = parseHtml(html);
  const body = root.querySelector("body") ?? root;

  const children: Array<Paragraph | Table> = walk(body as NHTMLElement);

  // If a map buffer is provided and there are no embedded images, inject at the start
  if (mapPngBuffer && !html.includes("data:image/png;base64")) {
    const mapPara = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { before: 240, after: 240 },
      children:  [
        new ImageRun({
          data:           mapPngBuffer,
          type:           "png",
          transformation: { width: 600, height: 450 },
        }),
      ],
    });
    // Insert after first heading
    const firstHeadingIdx = children.findIndex((c) => c instanceof Paragraph && (c as any).root?.properties?.heading);
    if (firstHeadingIdx !== -1) {
      children.splice(firstHeadingIdx + 1, 0, mapPara);
    } else {
      children.unshift(mapPara);
    }
  }

  return new Document({
    numbering: {
      config: [{
        reference: "default-numbering",
        levels: [{
          level:     0,
          format:    "decimal",
          text:      "%1.",
          alignment: AlignmentType.LEFT,
          style:     { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1",
          run: { bold: true, size: 36, color: BLUE_HEADER },
          paragraph: { spacing: { before: 360, after: 180 } },
        },
        {
          id: "Heading2", name: "Heading 2",
          run: { bold: true, size: 28, color: BLUE_HEADER },
          paragraph: { spacing: { before: 280, after: 140 } },
        },
        {
          id: "Heading3", name: "Heading 3",
          run: { bold: true, size: 24, color: TEXT_GREY },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: children.length ? children : [new Paragraph({ children: [] })],
    }],
  });
}
