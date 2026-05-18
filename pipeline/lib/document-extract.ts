/**
 * pipeline/lib/document-extract.ts
 *
 * Universal project document pre-extractor — dynamic, no fixed type list.
 *
 * Runs ONCE per document when a project file is uploaded. A single Claude call
 * identifies the document type and extracts all LEED-relevant data simultaneously.
 * The profile includes a pre-formatted context_block ready for injection into any
 * credit prompt — no post-processing or type-specific formatters required.
 *
 * Handles any professional document: geotechnical reports, energy models, Phase I/II
 * ESAs, commissioning reports, stormwater plans, traffic studies, water audits,
 * structural reports, OPR/BOD documents, habitat surveys, ventilation reports,
 * construction waste plans, acoustics reports, lighting calculations, and anything
 * else a project team uploads.
 *
 * Storage path: {customer_id}/{project_id}/doc-profiles/{type_slug}.json
 */

import Anthropic    from "@anthropic-ai/sdk";
import * as fs      from "fs";
import * as path    from "path";
import * as os      from "os";
import { execSync } from "child_process";
import { createServiceClient } from "./supabase";

const UPLOADS_BUCKET = "customer-uploads";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentProfile {
  type_name:         string;               // e.g. "Geotechnical Investigation Report"
  type_slug:         string;               // e.g. "geotechnical", "stormwater-plan"
  extracted_at:      string;
  source_file:       string;
  firm:              string | null;
  author:            string | null;
  date:              string | null;
  project_reference: string | null;
  data:              Record<string, unknown>; // all extracted structured fields
  context_block:     string;               // pre-formatted plain-text for credit injection
  summary:           string;
  token_usage:       { input: number; output: number };
}

// ── Single extraction prompt — handles any document type ──────────────────────

const EXTRACTION_PROMPT = `You are analyzing a professional document uploaded as part of a LEED v4.1 building certification project.

Read this document carefully and extract all information relevant to LEED credit submissions.

Return a JSON object with this exact structure:
{
  "type_name": "Full human-readable document type — e.g. 'Geotechnical Investigation Report', 'Energy Model Output', 'Stormwater Management Plan', 'Phase I Environmental Site Assessment', 'Traffic Impact Study', 'Commissioning Report', 'Water Audit', 'Structural Report', 'Owner's Project Requirements', 'Construction Waste Management Plan', 'Acoustics Report', 'Photometric/Lighting Calculation Report', 'Indoor Air Quality Management Plan', 'Habitat Survey', 'Ventilation Design Report', 'Site Survey', 'Mechanical Schedule', or whatever this document actually is",
  "type_slug": "kebab-case short identifier — e.g. 'geotechnical', 'energy-model', 'stormwater-plan', 'phase-i-esa', 'traffic-study', 'commissioning', 'water-audit', 'structural', 'opr', 'waste-management-plan', 'acoustics', 'lighting', 'iaq-plan', 'habitat-survey', 'ventilation', 'site-survey', 'mechanical-schedule'",
  "firm": "authoring firm name or null",
  "author": "author/engineer name and credentials or null",
  "date": "document date as string or null",
  "project_reference": "project name and/or address found in the document or null",
  "data": {
    // Extract ALL quantitative values, thresholds, compliance determinations, and key findings.
    // Organize into logical sub-objects by topic. Use whatever fields fit this document type.
    // Be thorough — include every number, area, rating, classification, recommendation, and conclusion
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
    // Use judgment for any other document type — extract whatever is credit-relevant.
  },
  "context_block": "Compact plain-text block formatted for injection into a LEED credit analysis AI prompt. Structure: lead with document type name, firm, author, date, and project reference on the first line. Then present all key findings as short labeled lines or bullet points grouped by topic. Include every number, threshold, classification, and compliance determination. End with any open items, limitations, or recommendations that could affect credit eligibility. Target 250-450 words — dense with data, no filler prose.",
  "summary": "2-3 sentence plain English summary of what this document is, its key findings, and which LEED credits it is most relevant to."
}

Return ONLY the JSON — no markdown fences, no explanation.`;

// ── Text conversion ────────────────────────────────────────────────────────────

function toText(buffer: Buffer, filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const tmp = path.join(os.tmpdir(), `certify-doc-${Date.now()}${ext}`);
  try {
    fs.writeFileSync(tmp, buffer);
    if ([".rtf", ".docx", ".doc"].includes(ext)) {
      try {
        return execSync(`textutil -convert txt -stdout "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      } catch {
        return execSync(`strings "${tmp}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf-8");
      }
    }
    return buffer.toString("utf-8");
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// ── Build content blocks ───────────────────────────────────────────────────────

function buildContentBlocks(buffer: Buffer, filename: string): Anthropic.ContentBlockParam[] {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") {
    return [{
      type:   "document",
      source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
    } as any];
  }
  const text = toText(buffer, filename);
  return [{ type: "text", text: text.slice(0, 100_000) }];
}

// ── Core extraction — one call, detect + extract simultaneously ───────────────

async function runExtraction(
  client:   Anthropic,
  content:  Anthropic.ContentBlockParam[],
  filename: string,
  usage:    { input: number; output: number },
): Promise<Omit<DocumentProfile, "extracted_at" | "source_file" | "token_usage">> {

  const response = await client.messages.create({
    model:       "claude-sonnet-4-6",
    max_tokens:  4000,
    temperature: 0,
    messages:    [{ role: "user", content: [...content, { type: "text", text: EXTRACTION_PROMPT }] }],
  });

  usage.input  += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;

  const text  = response.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("").trim();
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    // Fallback: unrecognized document
    return {
      type_name:         "Unknown Document",
      type_slug:         "unknown",
      firm:              null,
      author:            null,
      date:              null,
      project_reference: null,
      data:              { raw_excerpt: text.slice(0, 500) },
      context_block:     `UNRECOGNIZED DOCUMENT — ${filename}\nCould not extract structured data from this file.`,
      summary:           `Unrecognized document: ${filename}. Manual review required.`,
    };
  }

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      type_name:         parsed.type_name         ?? "Unknown Document",
      type_slug:         (parsed.type_slug         ?? "unknown").replace(/[^a-z0-9-]/g, "-").toLowerCase(),
      firm:              parsed.firm              ?? null,
      author:            parsed.author            ?? null,
      date:              parsed.date              ?? null,
      project_reference: parsed.project_reference ?? null,
      data:              parsed.data              ?? {},
      context_block:     parsed.context_block     ?? "",
      summary:           parsed.summary           ?? "",
    };
  } catch {
    return {
      type_name:         "Unknown Document",
      type_slug:         "unknown",
      firm:              null,
      author:            null,
      date:              null,
      project_reference: null,
      data:              { parse_error: text.slice(0, 500) },
      context_block:     `DOCUMENT — ${filename}\nCould not parse extraction output.`,
      summary:           `Document extraction failed for ${filename}.`,
    };
  }
}

// ── Public: extract without Supabase (for tests) ──────────────────────────────

export async function extractDocumentContent(
  file:   { filename: string; buffer: Buffer; mimeType: string },
  client: Anthropic,
  usage:  { input: number; output: number },
): Promise<DocumentProfile> {

  console.log(`  [doc-extract] Extracting ${file.filename}...`);
  const content = buildContentBlocks(file.buffer, file.filename);
  const result  = await runExtraction(client, content, file.filename, usage);

  console.log(`  [doc-extract] ✓ ${result.type_name} (${result.type_slug})`);

  return {
    ...result,
    extracted_at: new Date().toISOString(),
    source_file:  file.filename,
    token_usage:  { ...usage },
  };
}

// ── Public: extract and store in Supabase (for production) ────────────────────

export async function extractDocument(
  projectId:  string,
  customerId: string,
  file:       { filename: string; buffer: Buffer; mimeType: string },
): Promise<DocumentProfile> {

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client   = new Anthropic({ apiKey });
  const supabase = createServiceClient();
  const usage    = { input: 0, output: 0 };

  const profile = await extractDocumentContent(file, client, usage);

  const storagePath = `${customerId}/${projectId}/doc-profiles/${profile.type_slug}.json`;
  const { error: uploadError } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(storagePath, JSON.stringify(profile, null, 2), { contentType: "application/json", upsert: true });

  if (uploadError) throw new Error(`Failed to upload ${profile.type_slug} profile: ${uploadError.message}`);

  // Record extracted type in project row
  await supabase
    .from("projects")
    .select("doc_profiles_extracted")
    .eq("id", projectId)
    .single()
    .then(({ data }) => {
      const current = (data?.doc_profiles_extracted as Record<string, boolean>) ?? {};
      current[profile.type_slug] = true;
      return supabase.from("projects").update({ doc_profiles_extracted: current }).eq("id", projectId);
    });

  console.log(`  [doc-extract] ✓ ${profile.type_slug} stored — ${profile.type_name}`);
  return profile;
}

// ── Public: load all stored profiles for a project ────────────────────────────

export async function loadAllDocumentProfiles(
  customerId: string,
  projectId:  string,
): Promise<DocumentProfile[]> {

  const supabase = createServiceClient();
  const prefix   = `${customerId}/${projectId}/doc-profiles`;

  const { data: files, error } = await supabase.storage.from(UPLOADS_BUCKET).list(prefix);
  if (error || !files?.length) return [];

  const profiles = await Promise.all(
    files
      .filter(f => f.name.endsWith(".json"))
      .map(async (f) => {
        const { data, error: dlErr } = await supabase.storage
          .from(UPLOADS_BUCKET)
          .download(`${prefix}/${f.name}`);
        if (dlErr || !data) return null;
        try {
          return JSON.parse(await data.text()) as DocumentProfile;
        } catch {
          return null;
        }
      }),
  );

  return profiles.filter((p): p is DocumentProfile => p !== null);
}

// ── Public: load a single profile by slug ─────────────────────────────────────

export async function loadDocumentProfile(
  customerId: string,
  projectId:  string,
  typeSlug:   string,
): Promise<DocumentProfile | null> {

  const supabase    = createServiceClient();
  const storagePath = `${customerId}/${projectId}/doc-profiles/${typeSlug}.json`;

  const { data, error } = await supabase.storage.from(UPLOADS_BUCKET).download(storagePath);
  if (error || !data) return null;

  try {
    return JSON.parse(await data.text()) as DocumentProfile;
  } catch {
    return null;
  }
}

// ── Public: format for credit context injection ───────────────────────────────

export function formatDocumentProfileForContext(profile: DocumentProfile): string {
  return profile.context_block || `${profile.type_name} — ${profile.source_file}\n${profile.summary}`;
}

export function formatAllDocumentProfilesForContext(profiles: DocumentProfile[]): string {
  if (!profiles.length) return "";
  return profiles.map(formatDocumentProfileForContext).join("\n\n");
}
