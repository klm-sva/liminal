/**
 * Upload local pipeline reference files to Supabase Storage bucket
 * "platform-reference".
 *
 * Run with:
 *   npx ts-node scripts/upload-reference-files.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import * as fs from "fs";
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

async function uploadFolder(localFolder: string, remotePrefix: string): Promise<void> {
  const entries = fs.readdirSync(localFolder);
  const files   = entries.filter((e) => {
    const full = path.join(localFolder, e);
    return fs.statSync(full).isFile();
  });

  // Skip folders that contain only README files (WELL placeholders)
  const nonReadme = files.filter((f) => f !== "README.md");
  if (nonReadme.length === 0) {
    console.log(`  ⏭  ${remotePrefix}/ — placeholder only, skipping`);
    return;
  }

  for (const file of files) {
    if (file === "README.md") continue; // never upload READMEs to storage

    const localPath  = path.join(localFolder, file);
    const remotePath = `${remotePrefix}/${file}`;
    const ext        = path.extname(file).toLowerCase();
    const mimeType   = MIME[ext] ?? "application/octet-stream";
    const buffer     = fs.readFileSync(localPath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(remotePath, buffer, { contentType: mimeType, upsert: true });

    if (error) {
      console.error(`  ✗ ${remotePath} — ${error.message}`);
    } else {
      const sizeKB = (buffer.length / 1024).toFixed(0);
      console.log(`  ✓ ${remotePath}  (${sizeKB} KB)`);
    }
  }
}

async function main() {
  console.log(`\nUploading reference files to Supabase bucket: ${BUCKET}\n`);

  const folders: Array<{ local: string; remote: string }> = [
    { local: path.join(REF_DIR, "leed"),     remote: "leed"     },
    { local: path.join(REF_DIR, "well-v2"),  remote: "well-v2"  },
    { local: path.join(REF_DIR, "well-hsr"), remote: "well-hsr" },
  ];

  for (const { local, remote } of folders) {
    if (!fs.existsSync(local)) {
      console.log(`  ⏭  ${remote}/ — folder not found locally, skipping`);
      continue;
    }
    console.log(`${remote}/`);
    await uploadFolder(local, remote);
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
