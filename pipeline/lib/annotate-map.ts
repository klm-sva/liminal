/**
 * Map annotation utilities using Sharp for image compositing.
 * Draws walking route polylines, markers, and distance labels
 * onto a Google Maps Static API base image.
 */

import sharp from "sharp";

export interface Marker {
  x: number;       // pixel x on the 1200x900 canvas
  y: number;       // pixel y
  label: string;   // text label
  color: string;   // hex e.g. "#333333"
  isProject?: boolean;
}

export interface Polyline {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  distanceLabel?: string;
}

export interface AnnotationSpec {
  baseImageBuffer: Buffer;    // PNG from Google Static Maps API
  markers: Marker[];
  polylines: Polyline[];
  citationText: string;       // bottom-right source attribution
  outputWidth?: number;
  outputHeight?: number;
}

/**
 * Build an SVG overlay containing all markers, polylines, and labels.
 * The SVG is composited on top of the base map image using Sharp.
 */
function buildSvgOverlay(
  spec: AnnotationSpec,
  width: number,
  height: number
): string {
  const svgParts: string[] = [];

  // Polylines
  for (const pl of spec.polylines) {
    if (pl.points.length < 2) continue;
    const d = pl.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
    svgParts.push(
      `<path d="${d}" stroke="${pl.color}" stroke-width="${pl.width}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`
    );

    // Distance label at midpoint
    if (pl.distanceLabel) {
      const mid = pl.points[Math.floor(pl.points.length / 2)];
      svgParts.push(`
        <rect x="${mid.x - 28}" y="${mid.y - 12}" width="56" height="18" rx="3" fill="white" opacity="0.85"/>
        <text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="middle"
              font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333333">
          ${pl.distanceLabel}
        </text>`);
    }
  }

  // Markers
  for (const m of spec.markers) {
    const r = m.isProject ? 10 : 8;
    const stroke = m.isProject ? "white" : "white";
    svgParts.push(`
      <circle cx="${m.x}" cy="${m.y}" r="${r}" fill="${m.color}" stroke="${stroke}" stroke-width="2"/>
      <rect x="${m.x + r + 2}" y="${m.y - 9}" width="${m.label.length * 7 + 8}" height="18" rx="3" fill="white" opacity="0.88"/>
      <text x="${m.x + r + 6}" y="${m.y}" dominant-baseline="middle"
            font-family="Arial, sans-serif" font-size="11" font-weight="${m.isProject ? "bold" : "normal"}" fill="#222222">
        ${m.label}
      </text>`);
  }

  // Source citation
  const citationLines = spec.citationText.split("\n");
  const citY = height - 8;
  const lineH = 13;
  citationLines.reverse().forEach((line, i) => {
    svgParts.push(`
      <text x="${width - 8}" y="${citY - i * lineH}" text-anchor="end"
            font-family="Arial, sans-serif" font-size="9" fill="#555555" opacity="0.9">
        ${line}
      </text>`);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgParts.join("")}</svg>`;
}

/**
 * Composite the SVG annotation overlay onto the base map image.
 * Returns a PNG Buffer of the annotated map.
 */
export async function annotateMap(spec: AnnotationSpec): Promise<Buffer> {
  const width  = spec.outputWidth  ?? 1200;
  const height = spec.outputHeight ?? 900;

  // Resize base image to target dimensions
  const base = await sharp(spec.baseImageBuffer)
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();

  const svg = buildSvgOverlay(spec, width, height);
  const svgBuffer = Buffer.from(svg);

  return sharp(base)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

/**
 * Encode a LatLng path as a Google Maps encoded polyline string.
 * Used for the path parameter in Static Maps API requests.
 */
export function encodePolyline(coords: Array<{ lat: number; lng: number }>): string {
  let prevLat = 0;
  let prevLng = 0;
  let result  = "";

  for (const { lat, lng } of coords) {
    const dLat = Math.round((lat - prevLat) * 1e5);
    const dLng = Math.round((lng - prevLng) * 1e5);
    prevLat = lat;
    prevLng = lng;

    for (const val of [dLat, dLng]) {
      let v = val < 0 ? ~(val << 1) : val << 1;
      while (v >= 0x20) {
        result += String.fromCharCode(((0x20 | (v & 0x1f)) + 63));
        v >>= 5;
      }
      result += String.fromCharCode((v + 63));
    }
  }
  return result;
}
