/**
 * pipeline/lib/gtfs-transit.ts
 *
 * Downloads and parses GTFS feeds to produce accurate transit stop trip counts
 * for LEED v4.1 LT Credit 5 (Access to Quality Transit) and any future credit
 * that requires structured transit schedule data.
 *
 * Flow:
 *   1. Discover GTFS feed URLs near a lat/lon via The Mobility Database public catalog
 *   2. Download the GTFS ZIP for each relevant agency
 *   3. Parse stops, routes, trips, calendar, stop_times
 *   4. Cluster stops by proximity (same physical location, different direction stop_ids)
 *   5. Return GtfsStopResult[] with real trip counts, route names, and LEED qualification
 *
 * No API key required — The Mobility Database catalog is public. GTFS feeds are published
 * openly by transit agencies.
 */

import axios from "axios";
import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { axiosGetWithRetry } from "./pipeline-utils";

// ─── Constants ────────────────────────────────────────────────────────────────

// LEED v4.1 LT Credit 5 — distance thresholds by mode
const RAIL_RADIUS_MILES = 0.5;   // subway, rail, ferry
const BUS_RADIUS_MILES  = 0.25;  // bus, BRT, streetcar, tram

// LEED trip thresholds (directional trips = total ÷ 2)
const BUS_MIN_DIRECTIONAL  = 100;
const RAIL_MIN_DIRECTIONAL = 4;

// Stop clustering: stops within this distance are the same physical location
const CLUSTER_RADIUS_MILES = 0.03; // ~160 feet

// GTFS route_type values that qualify as rail/ferry for the 0.5 mile threshold
const RAIL_ROUTE_TYPES = new Set([0, 1, 2, 4, 5, 7, 12]);

// Cache GTFS ZIPs on disk so repeated test runs don't re-download (24h TTL)
const CACHE_DIR  = path.join(os.tmpdir(), "liminal-gtfs-cache");
const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours in ms

// Mobility Database catalog rows whose feed is no longer maintained at that URL
const INACTIVE_CATALOG_STATUSES = new Set(["deprecated", "inactive"]);

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ScheduleRow {
  route:      string;   // route short name (e.g. "17", "Red Line")
  times:      string[]; // sorted weekday departure times, e.g. ["05:30:00", "05:58:00", ...]
  count:      number;   // total departures (both directions combined)
}

export interface GtfsStopResult {
  name:                    string;
  lat:                     number;
  lon:                     number;
  distanceMiles:           number;
  routeNames:              string[];
  routeType:               number;    // lowest (most premium) route_type in cluster
  isRail:                  boolean;
  weekdayTrips:            number;    // total both directions (template divides by 2)
  weekendTrips:            number;    // total both directions
  weekdayDirectional:      number;    // weekdayTrips / 2 — for LEED threshold check
  qualifiesLeedPath1:      boolean;
  dataSource:              string;
  agencyName:              string;
  feedUrl:                 string;
  weekdaySchedule:         ScheduleRow[]; // departure times by route — embedded in output
}

// ─── Haversine distance in miles ──────────────────────────────────────────────

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function miesToFeet(miles: number): number {
  return Math.round(miles * 5280);
}

// ─── GTFS CSV parser ──────────────────────────────────────────────────────────
// Handles BOM, \r\n, and quoted fields. GTFS values rarely contain commas
// (trip_ids, stop_ids, times) so simple splitting is reliable for schedule files.

// Split a single CSV line respecting double-quoted fields (RFC 4180).
// GTFS schedule files (stops.txt, trips.txt, etc.) rarely have quoted commas,
// but the Mobility Database catalog does — agency names like
// "San Diego International Airport, Metropolitan Transit System (MTS)" contain
// a comma inside quotes. A naive split(",") shifts all subsequent columns by 1,
// causing URL and bounding-box fields to read as empty and the row to be skipped.
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ  = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } // escaped ""
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function parseGtfsCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? "";
    }
    results.push(obj);
  }
  return results;
}

// ─── Mobility Database catalog — find GTFS feed URLs near a location ─────────
// Uses The Mobility Database public catalog CSV (no API key required).
// Filters rows whose bounding box contains the project lat/lon.

const MOBILITY_DB_CATALOG = "https://bit.ly/catalogs-csv";

export async function findGtfsFeedUrls(lat: number, lon: number): Promise<Array<{ url: string; name: string; fallbackUrl?: string }>> {
  console.log(`  [GTFS] Searching Mobility Database catalog for feeds near ${lat.toFixed(4)}, ${lon.toFixed(4)}...`);

  let catalogText = "";
  try {
    const res = await axiosGetWithRetry(MOBILITY_DB_CATALOG, {}, 30000, "Mobility Database catalog");
    catalogText = typeof res.data === "string" ? res.data : Buffer.from(res.data).toString("utf-8");
  } catch (e) {
    console.warn(`  [GTFS] Mobility Database catalog fetch failed: ${(e as Error).message}`);
    return [];
  }

  const rows = parseGtfsCsv(catalogText);

  const byId = new Map<string, Record<string, string>>();
  for (const r of rows) {
    const id = r["mdb_source_id"];
    if (id) byId.set(id, r);
  }

  const bboxMatches = rows.filter((r) => {
    if (r["data_type"] !== "gtfs")           return false;
    if (r["location.country_code"] !== "US") return false;

    const url = r["urls.latest"] || r["urls.direct_download"];
    if (!url) return false;

    const minLat = parseFloat(r["location.bounding_box.minimum_latitude"]  ?? "");
    const maxLat = parseFloat(r["location.bounding_box.maximum_latitude"]  ?? "");
    const minLon = parseFloat(r["location.bounding_box.minimum_longitude"] ?? "");
    const maxLon = parseFloat(r["location.bounding_box.maximum_longitude"] ?? "");

    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) return false;
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
  });

  // Deprecated/inactive rows often have a `redirect.id` pointing at the catalog
  // row for the same provider's current feed. Follow it (bounded, cycle-safe)
  // until we land on a live row, so we never silently prefer a stale listing
  // over the agency's current one just because both match the bounding box.
  const resolved = new Map<string, { url: string; name: string; fallbackUrl?: string }>();

  for (const row of bboxMatches) {
    let current = row;
    const seen  = new Set<string>();

    while (
      INACTIVE_CATALOG_STATUSES.has(current["status"]) &&
      current["redirect.id"] &&
      !seen.has(current["mdb_source_id"])
    ) {
      seen.add(current["mdb_source_id"]);
      const next = byId.get(current["redirect.id"]);
      if (!next) break;
      current = next;
    }

    if (INACTIVE_CATALOG_STATUSES.has(current["status"])) {
      console.log(`  [GTFS] Skipping "${row["provider"] || row["name"]}" — deprecated/inactive with no live replacement`);
      continue;
    }

    // Prefer the Mobility Database's own mirror (urls.latest), but keep the
    // agency's direct URL as a fallback — the mirror has been observed to
    // 404 for feeds the catalog otherwise lists as live/current.
    const primaryUrl  = current["urls.latest"];
    const directUrl    = current["urls.direct_download"];
    const url          = primaryUrl || directUrl;
    if (!url) continue;
    const fallbackUrl  = primaryUrl && directUrl && directUrl !== primaryUrl ? directUrl : undefined;

    const key = current["mdb_source_id"] || url;
    if (resolved.has(key)) continue;
    resolved.set(key, { url, name: current["provider"] || current["name"] || "Unknown Agency", fallbackUrl });
  }

  console.log(`  [GTFS] Found ${resolved.size} live feed(s) covering this location`);

  return [...resolved.values()];
}

// ─── GTFS ZIP download with disk cache ───────────────────────────────────────

async function downloadGtfsZip(feedUrl: string, agencyName: string): Promise<Buffer> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Cache key: sanitise URL into a safe filename
  const cacheKey  = feedUrl.replace(/[^a-z0-9]/gi, "_").slice(-80);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.zip`);

  if (fs.existsSync(cachePath)) {
    const age = Date.now() - fs.statSync(cachePath).mtimeMs;
    if (age < CACHE_TTL) {
      console.log(`  [GTFS] Using cached feed for ${agencyName} (${Math.round(age / 3600000)}h old)`);
      return fs.readFileSync(cachePath);
    }
  }

  console.log(`  [GTFS] Downloading feed for ${agencyName} from ${feedUrl}...`);
  const res = await axios.get(feedUrl, {
    responseType: "arraybuffer",
    timeout:      60000,
    maxContentLength: 300 * 1024 * 1024, // 300 MB max
  });
  const buf = Buffer.from(res.data);
  fs.writeFileSync(cachePath, buf);
  console.log(`  [GTFS] Downloaded ${Math.round(buf.length / 1024 / 1024 * 10) / 10} MB — cached`);
  return buf;
}

async function downloadGtfsZipWithFallback(feed: { url: string; name: string; fallbackUrl?: string }): Promise<Buffer> {
  try {
    return await downloadGtfsZip(feed.url, feed.name);
  } catch (e) {
    if (!feed.fallbackUrl) throw e;
    console.warn(`  [GTFS] Primary URL failed for ${feed.name} (${(e as Error).message}) — trying direct_download fallback`);
    return await downloadGtfsZip(feed.fallbackUrl, feed.name);
  }
}

// ─── GTFS ZIP parser ──────────────────────────────────────────────────────────

interface ParsedGtfs {
  stops:    Map<string, { name: string; lat: number; lon: number }>;
  routes:   Map<string, { shortName: string; longName: string; type: number }>;
  trips:    Map<string, { routeId: string; serviceId: string; directionId: number }>;
  // stop_id → set of trip_ids that visit it on weekdays / weekends
  stopWeekdayTrips:  Map<string, Set<string>>;
  stopWeekendTrips:  Map<string, Set<string>>;
  // stop_id → set of route_ids
  stopRoutes: Map<string, Set<string>>;
  // stop_id → list of {routeId, departure_time} for weekday service (for schedule output)
  stopWeekdayDepartures: Map<string, Array<{ routeId: string; time: string }>>;
  agencyName: string;
}

function parseGtfsZip(zipBuffer: Buffer, agencyName: string): ParsedGtfs {
  const zip = new AdmZip(zipBuffer);

  const readEntry = (name: string): Record<string, string>[] => {
    // Some agencies put files in a subdirectory inside the ZIP
    const entry = zip.getEntry(name)
      ?? zip.getEntries().find((e) => e.entryName.endsWith("/" + name) || e.entryName === name);
    if (!entry) {
      console.warn(`  [GTFS] ${name} not found in ${agencyName} feed`);
      return [];
    }
    console.log(`  [GTFS] Parsing ${name} (${Math.round(entry.header.size / 1024)} KB uncompressed)...`);
    return parseGtfsCsv(entry.getData().toString("utf-8"));
  };

  // Agency name (override if available)
  const agencyRows = readEntry("agency.txt");
  const resolvedAgency = agencyRows[0]?.agency_name ?? agencyName;

  // stops.txt
  const stopsMap = new Map<string, { name: string; lat: number; lon: number }>();
  for (const row of readEntry("stops.txt")) {
    if (!row.stop_id) continue;
    stopsMap.set(row.stop_id, {
      name: row.stop_name ?? "",
      lat:  parseFloat(row.stop_lat  ?? "0"),
      lon:  parseFloat(row.stop_lon  ?? "0"),
    });
  }
  console.log(`  [GTFS] ${stopsMap.size} stops loaded`);

  // routes.txt
  const routesMap = new Map<string, { shortName: string; longName: string; type: number }>();
  for (const row of readEntry("routes.txt")) {
    if (!row.route_id) continue;
    routesMap.set(row.route_id, {
      shortName: row.route_short_name ?? "",
      longName:  row.route_long_name  ?? "",
      type:      parseInt(row.route_type ?? "3", 10),
    });
  }

  // calendar.txt — determine which service_ids run on weekdays vs weekends.
  //
  // We do NOT reject rows because their end_date has passed relative to today.
  // A feed's publish cadence is not evidence service stopped — if the catalog
  // lists this source as live (not deprecated/inactive), the most recently
  // published schedule period in the file IS the current schedule as far as
  // we know, full stop. We do still need to pick ONE period rather than every
  // period the agency has ever published, though: agencies often leave
  // multiple non-concurrent periods in the same file (e.g. an academic-year
  // calendar and a summer-session calendar) — summing both would double-count
  // trips that never actually ran on the same day. So: take whichever rows
  // belong to the most recently published period (latest end_date; rows with
  // no end_date are treated as open-ended and always win).
  const weekdayServiceIds = new Set<string>();
  const weekendServiceIds = new Set<string>();

  const calendarRows = readEntry("calendar.txt").filter((r) => r.service_id);
  const openEndedRows = calendarRows.filter((r) => !r.end_date);
  let currentPeriodRows: Record<string, string>[];

  if (openEndedRows.length > 0) {
    currentPeriodRows = openEndedRows;
  } else if (calendarRows.length > 0) {
    const latestEndDate = calendarRows.reduce((max, r) => (r.end_date > max ? r.end_date : max), "");
    currentPeriodRows = calendarRows.filter((r) => r.end_date === latestEndDate);
  } else {
    currentPeriodRows = [];
  }

  for (const row of currentPeriodRows) {
    const weekday = ["monday", "tuesday", "wednesday", "thursday", "friday"].some((d) => row[d] === "1");
    const weekend = ["saturday", "sunday"].some((d) => row[d] === "1");
    if (weekday) weekdayServiceIds.add(row.service_id);
    if (weekend) weekendServiceIds.add(row.service_id);
  }

  // If calendar.txt has no rows at all, fall back to calendar_dates.txt —
  // same principle: use whatever's published, don't second-guess its age.
  if (calendarRows.length === 0) {
    console.warn(`  [GTFS] calendar.txt has no service rows — trying calendar_dates.txt`);
    const byService = new Map<string, Set<number>>(); // service_id → Set<day of week 1-7>
    for (const row of readEntry("calendar_dates.txt")) {
      if (!row.service_id || row.exception_type !== "1") continue;
      const d = new Date(row.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
      if (isNaN(d.getTime())) continue;
      const dow = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
      if (!byService.has(row.service_id)) byService.set(row.service_id, new Set());
      byService.get(row.service_id)!.add(dow);
    }
    for (const [sid, days] of byService) {
      if ([1, 2, 3, 4, 5].some((d) => days.has(d))) weekdayServiceIds.add(sid);
      if ([0, 6].some((d) => days.has(d)))            weekendServiceIds.add(sid);
    }
  }
  console.log(`  [GTFS] Active service_ids — weekday: ${weekdayServiceIds.size}, weekend: ${weekendServiceIds.size}`);

  // trips.txt
  const tripsMap = new Map<string, { routeId: string; serviceId: string; directionId: number }>();
  for (const row of readEntry("trips.txt")) {
    if (!row.trip_id) continue;
    tripsMap.set(row.trip_id, {
      routeId:     row.route_id    ?? "",
      serviceId:   row.service_id  ?? "",
      directionId: parseInt(row.direction_id ?? "0", 10),
    });
  }
  console.log(`  [GTFS] ${tripsMap.size} trips loaded`);

  // stop_times.txt — build stop → trips index + capture departure times for schedule output
  // Only the first stop_time per trip_id at each stop_id matters (arrival counts once)
  const stopWeekdayTrips       = new Map<string, Set<string>>();
  const stopWeekendTrips       = new Map<string, Set<string>>();
  const stopRoutes             = new Map<string, Set<string>>();
  const stopWeekdayDepartures  = new Map<string, Array<{ routeId: string; time: string }>>();
  const seenStopTrip           = new Set<string>(); // deduplicate (stop_id, trip_id)

  let rowCount = 0;
  for (const row of readEntry("stop_times.txt")) {
    const { trip_id, stop_id, departure_time } = row;
    if (!trip_id || !stop_id) continue;

    const dedupeKey = `${stop_id}|${trip_id}`;
    if (seenStopTrip.has(dedupeKey)) continue;
    seenStopTrip.add(dedupeKey);

    const trip = tripsMap.get(trip_id);
    if (!trip) continue;

    if (!stopRoutes.has(stop_id)) stopRoutes.set(stop_id, new Set());
    stopRoutes.get(stop_id)!.add(trip.routeId);

    if (weekdayServiceIds.has(trip.serviceId)) {
      if (!stopWeekdayTrips.has(stop_id)) stopWeekdayTrips.set(stop_id, new Set());
      stopWeekdayTrips.get(stop_id)!.add(trip_id);
      // Save departure time for schedule table (only if a valid time is present)
      if (departure_time && departure_time.length > 0) {
        if (!stopWeekdayDepartures.has(stop_id)) stopWeekdayDepartures.set(stop_id, []);
        stopWeekdayDepartures.get(stop_id)!.push({ routeId: trip.routeId, time: departure_time });
      }
    }
    if (weekendServiceIds.has(trip.serviceId)) {
      if (!stopWeekendTrips.has(stop_id)) stopWeekendTrips.set(stop_id, new Set());
      stopWeekendTrips.get(stop_id)!.add(trip_id);
    }
    rowCount++;
  }
  console.log(`  [GTFS] ${rowCount} stop_time records processed`);

  return { stops: stopsMap, routes: routesMap, trips: tripsMap, stopWeekdayTrips, stopWeekendTrips, stopRoutes, stopWeekdayDepartures, agencyName: resolvedAgency };
}

// ─── Cluster nearby stops into physical locations ─────────────────────────────
// Transit agencies assign separate stop_ids for each direction at the same
// intersection. LEED evaluates the transit LOCATION, not the individual stop_id,
// so we group stop_ids within CLUSTER_RADIUS_MILES into one logical stop.

interface StopCluster {
  name:       string;
  lat:        number;
  lon:        number;
  stopIds:    string[];
  routeIds:   Set<string>;
}

function clusterStops(
  nearbyStopIds: string[],
  gtfs: ParsedGtfs,
): StopCluster[] {
  const clusters: StopCluster[] = [];

  for (const stopId of nearbyStopIds) {
    const stop = gtfs.stops.get(stopId);
    if (!stop) continue;

    // Find existing cluster within CLUSTER_RADIUS_MILES
    const existing = clusters.find(
      (c) => haversineMiles(c.lat, c.lon, stop.lat, stop.lon) <= CLUSTER_RADIUS_MILES,
    );

    if (existing) {
      existing.stopIds.push(stopId);
      // Prefer longer/more descriptive name
      if (stop.name.length > existing.name.length) existing.name = stop.name;
      // Merge routes
      for (const rid of (gtfs.stopRoutes.get(stopId) ?? [])) existing.routeIds.add(rid);
    } else {
      clusters.push({
        name:     stop.name,
        lat:      stop.lat,
        lon:      stop.lon,
        stopIds:  [stopId],
        routeIds: new Set(gtfs.stopRoutes.get(stopId) ?? []),
      });
    }
  }

  return clusters;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns all qualifying transit stops near a project address, with accurate
 * trip counts sourced directly from GTFS schedule data.
 *
 * @param projectLat  WGS-84 latitude of the project functional entry
 * @param projectLon  WGS-84 longitude of the project functional entry
 * @param feedUrls    Array of { url, name } from findGtfsFeedUrls()
 */
export async function getGtfsStopsNearProject(
  projectLat: number,
  projectLon: number,
  feedUrls:   Array<{ url: string; name: string; fallbackUrl?: string }>,
): Promise<GtfsStopResult[]> {
  const allResults: GtfsStopResult[] = [];

  for (const feed of feedUrls) {
    console.log(`\n  [GTFS] Processing feed: ${feed.name}`);
    let zipBuffer: Buffer;
    try {
      zipBuffer = await downloadGtfsZipWithFallback(feed);
    } catch (e) {
      console.warn(`  [GTFS] Download failed for ${feed.name}: ${(e as Error).message} — skipping`);
      continue;
    }

    let gtfs: ParsedGtfs;
    try {
      gtfs = parseGtfsZip(zipBuffer, feed.name);
    } catch (e) {
      console.warn(`  [GTFS] Parse failed for ${feed.name}: ${(e as Error).message} — skipping`);
      continue;
    }

    // Find all stop_ids within the maximum search radius (0.5 miles — rail threshold)
    const nearbyStopIds: string[] = [];
    for (const [stopId, stop] of gtfs.stops) {
      const dist = haversineMiles(projectLat, projectLon, stop.lat, stop.lon);
      if (dist <= RAIL_RADIUS_MILES) nearbyStopIds.push(stopId);
    }
    console.log(`  [GTFS] ${nearbyStopIds.length} stop_ids within ${RAIL_RADIUS_MILES} miles`);

    if (nearbyStopIds.length === 0) continue;

    // Cluster direction-specific stop_ids into physical locations
    const clusters = clusterStops(nearbyStopIds, gtfs);
    console.log(`  [GTFS] ${clusters.length} physical stop locations after clustering`);

    for (const cluster of clusters) {
      // Sum trips across all stop_ids in the cluster (both directions)
      let totalWeekdayTrips = 0;
      let totalWeekendTrips = 0;
      for (const sid of cluster.stopIds) {
        totalWeekdayTrips += (gtfs.stopWeekdayTrips.get(sid)?.size ?? 0);
        totalWeekendTrips += (gtfs.stopWeekendTrips.get(sid)?.size ?? 0);
      }

      // Directional trips = total / 2 (service is symmetric; LEED uses one direction)
      const weekdayDirectional = Math.round(totalWeekdayTrips / 2);
      const weekendDirectional = Math.round(totalWeekendTrips / 2);

      // Determine the lowest (most premium) route_type in this cluster
      const routeTypes  = [...cluster.routeIds].map((rid) => gtfs.routes.get(rid)?.type ?? 3);
      const minRouteType = Math.min(...routeTypes, 3);
      const isRail       = RAIL_ROUTE_TYPES.has(minRouteType);

      // Distance from project to this stop cluster
      const distMiles = haversineMiles(projectLat, projectLon, cluster.lat, cluster.lon);

      // LEED Path 1 qualification
      const distThreshold = isRail ? RAIL_RADIUS_MILES : BUS_RADIUS_MILES;
      const tripThreshold = isRail ? RAIL_MIN_DIRECTIONAL : BUS_MIN_DIRECTIONAL;
      const qualifies     = distMiles <= distThreshold && weekdayDirectional >= tripThreshold;

      // Route names for display
      const routeNames = [...cluster.routeIds]
        .map((rid) => {
          const r = gtfs.routes.get(rid);
          return r?.shortName || r?.longName || rid;
        })
        .filter(Boolean)
        .sort();

      // Build weekday schedule: aggregate departure times across all stop_ids in cluster,
      // grouped by route. These are the exact departure times used for trip counting.
      const departuresByRoute = new Map<string, Set<string>>();
      for (const sid of cluster.stopIds) {
        for (const dep of (gtfs.stopWeekdayDepartures.get(sid) ?? [])) {
          const routeLabel = (gtfs.routes.get(dep.routeId)?.shortName || gtfs.routes.get(dep.routeId)?.longName || dep.routeId).trim();
          if (!departuresByRoute.has(routeLabel)) departuresByRoute.set(routeLabel, new Set());
          departuresByRoute.get(routeLabel)!.add(dep.time);
        }
      }
      const weekdaySchedule: ScheduleRow[] = [...departuresByRoute.entries()]
        .map(([route, timesSet]) => {
          const times = [...timesSet].sort();
          return { route, times, count: times.length };
        })
        .sort((a, b) => a.route.localeCompare(b.route, undefined, { numeric: true }));

      allResults.push({
        name:               cluster.name,
        lat:                cluster.lat,
        lon:                cluster.lon,
        distanceMiles:      Math.round(distMiles * 10000) / 10000,
        routeNames,
        routeType:          minRouteType,
        isRail,
        weekdayTrips:       totalWeekdayTrips,
        weekendTrips:       totalWeekendTrips,
        weekdayDirectional,
        qualifiesLeedPath1: qualifies,
        dataSource:         `GTFS: ${gtfs.agencyName} — ${feed.url}`,
        agencyName:         gtfs.agencyName,
        feedUrl:            feed.url,
        weekdaySchedule,
      });
    }
  }

  // Sort: qualifying first, then by distance
  return allResults.sort((a, b) => {
    if (a.qualifiesLeedPath1 !== b.qualifiesLeedPath1) return a.qualifiesLeedPath1 ? -1 : 1;
    return a.distanceMiles - b.distanceMiles;
  });
}

// ─── Pre-purchase availability check ──────────────────────────────────────────
// Cheap existence check, meant to run BEFORE checkout so the customer can be
// warned if we have no usable transit data for their address. Downloads the
// same feed(s) the full run would use, but skips parsing stops/trips/
// stop_times (the large files) — only calendar.txt/calendar_dates.txt are
// read. A feed counts as usable if the catalog lists it as live (handled by
// findGtfsFeedUrls) AND it actually publishes a schedule — we do not reject
// it for being published a while ago; publish age isn't evidence service
// stopped.

export interface TransitAvailabilityResult {
  available:    boolean;
  reason:       string;
  feedsChecked: number;
}

function hasPublishedServiceInFeed(zipBuffer: Buffer): boolean {
  const zip = new AdmZip(zipBuffer);

  const readEntry = (name: string): Record<string, string>[] => {
    const entry = zip.getEntry(name)
      ?? zip.getEntries().find((e) => e.entryName.endsWith("/" + name) || e.entryName === name);
    if (!entry) return [];
    return parseGtfsCsv(entry.getData().toString("utf-8"));
  };

  if (readEntry("calendar.txt").some((row) => row.service_id)) return true;
  if (readEntry("calendar_dates.txt").some((row) => row.service_id && row.exception_type === "1")) return true;

  return false;
}

/**
 * Determines whether we can currently produce trustworthy GTFS-based transit
 * data for a project location, without doing the full stop-clustering/trip-
 * counting work. Used to gate checkout for any credit that relies on this
 * data source (LEED LTc5, WELL v2 V05's non-Transit-Score path).
 */
export async function checkTransitDataAvailability(
  lat: number,
  lon: number,
): Promise<TransitAvailabilityResult> {
  const feeds = await findGtfsFeedUrls(lat, lon);

  if (feeds.length === 0) {
    return { available: false, reason: "No transit data provider covers this location.", feedsChecked: 0 };
  }

  for (const feed of feeds) {
    try {
      const zipBuffer = await downloadGtfsZipWithFallback(feed);
      if (hasPublishedServiceInFeed(zipBuffer)) {
        return {
          available:    true,
          reason:       `Transit schedule data available from ${feed.name}.`,
          feedsChecked: feeds.length,
        };
      }
      console.log(`  [GTFS] ${feed.name} feed has no published service calendar`);
    } catch (e) {
      console.warn(`  [GTFS] Availability check failed for ${feed.name}: ${(e as Error).message}`);
    }
  }

  return {
    available:    false,
    reason:       "No usable transit schedule data is available from providers for this location.",
    feedsChecked: feeds.length,
  };
}

/**
 * Convert GtfsStopResult[] to CreditLocation[] for the LT Credit 5 template.
 * Walking distances (feet/minutes) are filled in by Google Maps after this step.
 */
export function gtfsResultsToCreditLocations(
  results: GtfsStopResult[],
  today: string,
): import("./lt-transit-template").CreditLocation[] {
  return results.map((r) => ({
    name:                   r.name,
    address:                `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`,
    type:                   "transit_stop" as const,
    transit_type:           r.isRail ? "heavy_rail" as const : (r.routeType === 0 ? "light_rail" as const : "bus" as const),
    walking_distance_miles: r.distanceMiles,
    walking_distance_feet:  miesToFeet(r.distanceMiles),
    weekday_trips:          r.weekdayTrips,
    weekend_trips:          r.weekendTrips,
    qualifies:              r.qualifiesLeedPath1,
    points_contributed:     r.qualifiesLeedPath1 ? 1 : 0,
    data_source:            `${r.dataSource} — Retrieved ${today}`,
    routes:                 r.routeNames,
    transit_agency:         r.agencyName,
    weekdaySchedule:        r.weekdaySchedule,
  }));
}
