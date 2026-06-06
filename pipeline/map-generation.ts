/**
 * pipeline/map-generation.ts
 *
 * Generates walking distance maps using Google Maps APIs.
 *
 * Correct route rendering approach:
 *   1. Call Directions API (walking) for each destination
 *   2. Extract overview_polyline.points from each response
 *   3. Decode the encoded polyline to get lat/lng bounds (for padding)
 *   4. Pass the original encoded polyline string to the Static Maps API
 *      using path=color:...|weight:4|enc:ENCODED_POLYLINE
 *   5. Static Maps API draws routes along real sidewalks and pedestrian paths
 *
 * Zoom and center are NEVER hardcoded. The Static Maps API `visible` parameter
 * receives the four corners of the padded bounding box (15% padding on all sides)
 * so Google automatically calculates the optimal center and zoom level that fits
 * all routes with comfortable margin.
 *
 * Routes are NEVER drawn as straight lines. All route geometry comes from
 * the Directions API and is rendered by the Static Maps API.
 */

import axios from "axios";
import * as path from "path";
import * as fs from "fs";
import { axiosGetWithRetry } from "./lib/pipeline-utils";

// Load env when running standalone
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

const MAPS_API_KEY = () => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY not set in .env.local");
  return key;
};

export type MapType = "transit-stops" | "bicycle-facilities" | "surrounding-density" | "site-context";

export interface Destination {
  address: string;
  label: string;
}

export interface MapRequest {
  originAddress: string;
  destinations: Destination[];
  mapType: MapType;
  outputPath?: string;
}

export interface WalkingRoute {
  destination: Destination;
  distanceFeet: number;
  distanceMiles: number;
  durationMinutes: number;
  encodedPolyline: string;
  polylinePoints: Array<{ lat: number; lng: number }>;
  originLatLng: { lat: number; lng: number };
  destLatLng: { lat: number; lng: number };
}

export interface MapResult {
  pngBuffer: Buffer;
  routes: WalkingRoute[];
  mapType: MapType;
}

// ─── Polyline decoder ─────────────────────────────────────────────────────────

function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// ─── Directions API ───────────────────────────────────────────────────────────

async function getRoute(
  origin: string,
  dest: Destination,
  mode: "walking" | "bicycling" = "walking",
): Promise<WalkingRoute | null> {
  const key = MAPS_API_KEY();
  const res = await axiosGetWithRetry(
    "https://maps.googleapis.com/maps/api/directions/json",
    { params: { origin, destination: dest.address, mode, alternatives: false, key } },
    10000,
    `Directions API (${mode}): ${dest.address}`,
  );

  const data = res.data;
  if (data.status !== "OK" || !data.routes?.length) {
    console.warn(`  ⚠ No route: ${origin} → ${dest.address} (${data.status})`);
    return null;
  }

  const route           = data.routes[0];
  const leg             = route.legs[0];
  const encodedPolyline = route.overview_polyline.points;

  return {
    destination:     dest,
    distanceFeet:    Math.round(leg.distance.value * 3.28084),
    distanceMiles:   parseFloat((leg.distance.value / 1609.34).toFixed(2)),
    durationMinutes: Math.round(leg.duration.value / 60),
    encodedPolyline,
    polylinePoints:  decodePolyline(encodedPolyline),
    originLatLng:    { lat: leg.start_location.lat, lng: leg.start_location.lng },
    destLatLng:      { lat: leg.end_location.lat,   lng: leg.end_location.lng  },
  };
}

// Keep the original name as a wrapper for backwards compatibility
async function getWalkingRoute(origin: string, dest: Destination): Promise<WalkingRoute | null> {
  return getRoute(origin, dest, "walking");
}

/**
 * Measure actual walking distances for a list of destinations without generating a map.
 * Used to re-qualify transit stops after GTFS straight-line pre-filtering.
 */
export async function measureWalkingDistances(
  originAddress: string,
  destinations: Destination[],
): Promise<WalkingRoute[]> {
  const routes: WalkingRoute[] = [];
  for (const dest of destinations) {
    const route = await getWalkingRoute(originAddress, dest);
    if (route) routes.push(route);
  }
  return routes;
}

/**
 * Measure actual bicycling distances along the bicycle network for a list of destinations.
 * Used for LT Credit 6 — Bicycle Facilities destination verification.
 */
export async function measureBicyclingDistances(
  originAddress: string,
  destinations: Destination[],
): Promise<WalkingRoute[]> {
  const routes: WalkingRoute[] = [];
  for (const dest of destinations) {
    const route = await getRoute(originAddress, dest, "bicycling");
    if (route) routes.push(route);
  }
  return routes;
}

// ─── Static Maps API with encoded polylines ───────────────────────────────────

async function fetchMapWithRoutes(
  routes: WalkingRoute[],
  visibleCorners: Array<{ lat: number; lng: number }>,
  imgWidth: number,
  imgHeight: number
): Promise<Buffer> {
  const key   = MAPS_API_KEY();
  const scale = 2;

  // Build URL manually to support multiple same-key params (path=, markers=, visible=)
  const base = "https://maps.googleapis.com/maps/api/staticmap";
  const params: string[] = [
    `size=${imgWidth / scale}x${imgHeight / scale}`,
    `scale=${scale}`,
    `maptype=roadmap`,
    `style=feature:poi|visibility:off`,
    `style=feature:transit|element:labels|visibility:off`,
    `key=${key}`,
  ];

  // Pass padded bounding box corners as visible= so Google auto-calculates center/zoom
  for (const pt of visibleCorners) {
    params.push(`visible=${pt.lat},${pt.lng}`);
  }

  // Origin marker — dark pin, label S
  const origin = routes[0].originLatLng;
  params.push(`markers=color:0x2b4044|size:mid|label:S|${origin.lat},${origin.lng}`);

  // Destination markers — blue pins, numbered
  // Google Static Maps only supports single-character labels. Labels 1–9 pass through;
  // labels 10+ map to A, B, C … so the pin matches the letter shown in the table footer.
  for (const route of routes) {
    const n = parseInt(route.destination.label, 10);
    const pinChar = (!isNaN(n) && n >= 10)
      ? String.fromCharCode(65 + n - 10)  // 10→A, 11→B, 12→C …
      : route.destination.label.slice(0, 1);
    params.push(`markers=color:0x327cb9|size:mid|label:${pinChar}|${route.destLatLng.lat},${route.destLatLng.lng}`);
  }

  // Walking routes — encoded polylines drawn by Static Maps API along real paths
  for (const route of routes) {
    params.push(`path=color:0x327cb9CC|weight:4|enc:${encodeURIComponent(route.encodedPolyline)}`);
  }

  const url = `${base}?${params.join("&")}`;
  const res = await axiosGetWithRetry(url, { responseType: "arraybuffer" }, 10000, "Static Maps API");
  return Buffer.from(res.data);
}

// ─── Citation overlay (Sharp) ─────────────────────────────────────────────────

async function addCitationOverlay(
  imageBuffer: Buffer,
  citationText: string,
  width: number,
  height: number
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  const lines    = citationText.split("\n");
  const lineH    = 14;
  const padding  = 6;
  const boxH     = lines.length * lineH + padding * 2;
  const boxW     = Math.max(...lines.map((l) => l.length)) * 6.5 + padding * 2;
  const boxX     = width  - boxW - 8;
  const boxY     = height - boxH - 8;

  const textEls = lines.map((line, i) =>
    `<text x="${boxX + padding}" y="${boxY + padding + lineH * i + 10}"
           font-family="Arial, sans-serif" font-size="10" fill="#444444">${line}</text>`
  ).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="3" fill="white" opacity="0.82"/>
    ${textEls}
  </svg>`;

  return sharp(imageBuffer)
    .resize(width, height, { fit: "cover" })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateMap(request: MapRequest): Promise<MapResult> {
  const WIDTH  = 1200;
  const HEIGHT = 900;

  console.log(`[map-generation] ${request.mapType} — ${request.destinations.length} destination(s)`);

  const primaryMode = request.mapType === "bicycle-facilities" ? "bicycling" : "walking";

  // 1. Get routes from Directions API. For bicycle credits, try bicycling mode first
  // and fall back to walking if bicycling returns no route — bicycling mode coverage
  // is incomplete and silently drops destinations that walking mode handles fine.
  const routes: WalkingRoute[] = [];
  for (const dest of request.destinations) {
    let route = await getRoute(request.originAddress, dest, primaryMode);
    if (!route && primaryMode === "bicycling") {
      route = await getRoute(request.originAddress, dest, "walking");
      if (route) console.log(`    ↳ ${dest.label}: bicycling route unavailable — using walking route`);
    }
    if (route) routes.push(route);
  }
  if (routes.length === 0) throw new Error(`No routes returned from Google Maps Directions API`);

  // 2. Calculate padded bounding box from all route geometry (polyline points + markers)
  const allPoints = routes.flatMap((r) => r.polylinePoints);
  allPoints.push(routes[0].originLatLng);
  routes.forEach((r) => allPoints.push(r.destLatLng));

  const lats   = allPoints.map((p) => p.lat);
  const lngs   = allPoints.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // Add 15% padding on all sides so no route is clipped at any edge
  const latPad = (maxLat - minLat) * 0.15;
  const lngPad = (maxLng - minLng) * 0.15;
  const visibleCorners = [
    { lat: minLat - latPad, lng: minLng - lngPad },
    { lat: minLat - latPad, lng: maxLng + lngPad },
    { lat: maxLat + latPad, lng: minLng - lngPad },
    { lat: maxLat + latPad, lng: maxLng + lngPad },
  ];

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  console.log(`  Center: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}  bounds: ±${(latPad * 111).toFixed(2)}km lat / ±${(lngPad * 111 * Math.cos(centerLat * Math.PI / 180)).toFixed(2)}km lng padding`);

  // 3. Fetch map — Google auto-calculates center/zoom from visible corners
  console.log(`  Fetching map with ${routes.length} encoded polyline route(s)...`);
  const mapImage = await fetchMapWithRoutes(routes, visibleCorners, WIDTH, HEIGHT);

  // 4. Add citation text overlay
  const today       = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const citationText = request.mapType === "bicycle-facilities"
    ? `Source: Google Maps — Bicycling distances along bicycle network routes.\n${today}`
    : `Source: Google Maps — Walking distances along pedestrian routes.\n${today}`;
  const pngBuffer   = await addCitationOverlay(mapImage, citationText, WIDTH, HEIGHT);

  // 5. Write to file if requested
  if (request.outputPath) {
    const { mkdirSync, writeFileSync } = await import("fs");
    mkdirSync(path.dirname(request.outputPath), { recursive: true });
    writeFileSync(request.outputPath, pngBuffer);
    console.log(`  ✓ Map saved: ${request.outputPath}`);
  }

  console.log(`  ✓ Map generated (${Math.round(pngBuffer.length / 1024)} KB PNG)`);
  routes.forEach((r) =>
    console.log(`    • ${r.destination.label}: ${r.distanceFeet.toLocaleString()} ft (${r.durationMinutes} min walk)`)
  );

  return { pngBuffer, routes, mapType: request.mapType };
}
