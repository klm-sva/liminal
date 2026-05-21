/**
 * Upload local pipeline reference files to Supabase Storage bucket
 * "platform-reference", preserving the full folder structure.
 *
 * Run with:
 *   npx ts-node scripts/upload-reference-files.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Folder structure uploaded:
 *   pipeline/reference/leed/     → platform-reference/leed/
 *   pipeline/reference/well-v2/  → platform-reference/well-v2/
 *   pipeline/reference/well-hsr/ → platform-reference/well-hsr/
 *
 * Uploads all PDFs, XLSXs, JSON files, and text files. Skips .DS_Store and READMEs.
 */

import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Load env from .env.local
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET   = "platform-reference";
const REF_DIR  = path.resolve(__dirname, "../pipeline/reference");

const MIME: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".json": "application/json",
  ".pdf":  "application/pdf",
  ".md":   "text/markdown",
  ".txt":  "text/plain",
};

// Files to skip unconditionally
const SKIP_FILES = new Set([".DS_Store", "README.md", ".gitkeep"]);

let uploadCount = 0;
let skipCount   = 0;
let errorCount  = 0;

async function uploadFile(localPath: string, remotePath: string): Promise<void> {
  const ext      = path.extname(localPath).toLowerCase();
  const mimeType = MIME[ext] ?? "application/octet-stream";
  const buffer   = fs.readFileSync(localPath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, buffer, { contentType: mimeType, upsert: true });

  if (error) {
    console.error(`  ✗ ${remotePath} — ${error.message}`);
    errorCount++;
  } else {
    const sizeKB = (buffer.length / 1024).toFixed(0);
    console.log(`  ✓ ${remotePath}  (${sizeKB} KB)`);
    uploadCount++;
  }
}

// Recursively walk a local folder and upload all eligible files,
// preserving the folder structure under remotePrefix.
async function uploadFolder(localFolder: string, remotePrefix: string): Promise<void> {
  if (!fs.existsSync(localFolder)) {
    console.log(`  ⏭  ${remotePrefix}/ — not found locally, skipping`);
    return;
  }

  const entries = fs.readdirSync(localFolder);

  for (const entry of entries) {
    if (SKIP_FILES.has(entry) || entry.startsWith(".")) {
      skipCount++;
      continue;
    }

    const localEntry  = path.join(localFolder, entry);
    const remoteEntry = `${remotePrefix}/${entry}`;
    const stat        = fs.statSync(localEntry);

    if (stat.isDirectory()) {
      // Recurse into subfolder
      console.log(`\n  📁 ${remoteEntry}/`);
      await uploadFolder(localEntry, remoteEntry);
    } else if (stat.isFile()) {
      await uploadFile(localEntry, remoteEntry);
    }
  }
}

async function ensureBucket(): Promise<void> {
  const { data: existing, error } = await supabase.storage.getBucket(BUCKET);

  if (existing) {
    const access = existing.public ? "public" : "private";
    console.log(`✓ Bucket "${BUCKET}" exists (${access})`);

    if (existing.public) {
      console.warn(`  ⚠ Bucket is public — reference files should be private. Consider updating in Supabase Storage settings.`);
    }
    return;
  }

  if (error && !error.message.includes("not found") && !error.message.includes("does not exist")) {
    throw new Error(`Could not check bucket: ${error.message}`);
  }

  // Bucket does not exist — create it as private
  console.log(`  Bucket "${BUCKET}" not found — creating with private access...`);
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public:               false,
    fileSizeLimit:        50 * 1024 * 1024, // 50 MB per file
    allowedMimeTypes:     [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/json",
      "text/markdown",
      "text/plain",
    ],
  });

  if (createError) throw new Error(`Failed to create bucket: ${createError.message}`);
  console.log(`✓ Bucket "${BUCKET}" created (private)`);
}

async function main() {
  console.log(`\nLiminal — Upload Reference Files to Supabase Storage`);
  console.log(`Bucket: ${BUCKET}\n`);

  // Step 1: Ensure bucket exists
  await ensureBucket();
  console.log();

  // Step 2: Upload each program folder recursively
  const programFolders = ["leed", "well-v2", "well-hsr"];

  for (const folder of programFolders) {
    console.log(`\n📂 ${folder}/`);
    await uploadFolder(path.join(REF_DIR, folder), folder);
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Uploaded : ${uploadCount} file(s)`);
  console.log(`  Skipped  : ${skipCount} file(s)`);
  console.log(`  Errors   : ${errorCount} file(s)`);
  console.log(`${"─".repeat(50)}\n`);

  if (errorCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
