/**
 * pipeline/lib/ref-cache.ts
 *
 * Lazy-loading, in-memory cache for files stored in the platform-reference
 * Supabase Storage bucket. Downloads each file once per pipeline run and
 * caches the buffer so subsequent calls are free.
 *
 * Replaces all local filesystem reads of pipeline/reference/ — those break
 * on Vercel because __dirname resolves into .next/server/ at runtime.
 */

import * as XLSX from "xlsx";

const BUCKET = "platform-reference";

// Automation analysis XLSX path within the bucket, keyed by credit program slug
const AUTOMATION_XLSX_PATH: Record<string, string> = {
  leed_bdc_v41: "leed/LEED_v41_BDC_Automation_Analysis_v9.xlsx",
  well_v2:      "well-v2/WELL_v2_Automation_Analysis_v4.xlsx",
  well_hsr:     "well-hsr/WELL_HSR_Automation_Analysis_v3.xlsx",
};

interface StorageItem {
  name:     string;
  isFolder: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class RefCache {
  private buffers  = new Map<string, Buffer>();
  private listings = new Map<string, StorageItem[]>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private supabase: any) {}

  // ── Core download / cache ───────────────────────────────────────────────────

  async getBuffer(storagePath: string): Promise<Buffer> {
    const hit = this.buffers.get(storagePath);
    if (hit) return hit;

    const { data, error } = await this.supabase.storage.from(BUCKET).download(storagePath);
    if (error || !data) {
      console.error(`[platform-reference] Download failed for "${storagePath}":`, {
        message:    error?.message,
        statusCode: (error as any)?.statusCode ?? (error as any)?.status,
        error:      error?.name,
        details:    JSON.stringify(error),
      });
      throw new Error(
        `[platform-reference] Cannot download "${storagePath}": ${error?.message ?? "no data returned"}`,
      );
    }
    const buf = Buffer.from(await data.arrayBuffer());
    this.buffers.set(storagePath, buf);
    return buf;
  }

  async getJson<T = unknown>(storagePath: string): Promise<T> {
    const buf = await this.getBuffer(storagePath);
    return JSON.parse(buf.toString("utf-8")) as T;
  }

  // ── Directory listing ───────────────────────────────────────────────────────

  private async listItems(folderPath: string): Promise<StorageItem[]> {
    const hit = this.listings.get(folderPath);
    if (hit) return hit;

    const { data, error } = await this.supabase.storage.from(BUCKET).list(folderPath);
    if (error) {
      console.warn(`[platform-reference] Cannot list "${folderPath}": ${error.message}`);
      this.listings.set(folderPath, []);
      return [];
    }

    const items: StorageItem[] = (data ?? []).map(
      (f: { name: string; id: string | null }) => ({ name: f.name, isFolder: f.id === null }),
    );
    this.listings.set(folderPath, items);
    return items;
  }

  /** Returns names of virtual subdirectories at the given path. */
  async listSubfolders(folderPath: string): Promise<string[]> {
    return (await this.listItems(folderPath)).filter((i) => i.isFolder).map((i) => i.name);
  }

  /** Returns names of actual files (non-folder objects) at the given path. */
  async listFiles(folderPath: string): Promise<string[]> {
    return (await this.listItems(folderPath)).filter((i) => !i.isFolder).map((i) => i.name);
  }

  // ── Typed accessors ─────────────────────────────────────────────────────────

  /** Downloads the automation analysis XLSX for the given program and returns the Buffer. */
  async getAutomationXlsx(program: string): Promise<Buffer> {
    const storagePath = AUTOMATION_XLSX_PATH[program];
    if (!storagePath) {
      throw new Error(
        `[platform-reference] No automation XLSX configured for program "${program}"`,
      );
    }
    return this.getBuffer(storagePath);
  }

  /** Storage path for the LEED v4.1 form field schema JSON. */
  readonly formSchemasPath = "leed/leed_v41_form_schemas.json";

  /** Storage path for the LEED v4.1 calculator schema JSON. */
  readonly calcSchemasPath = "leed/leed_v41_calculator_schemas.json";
}
