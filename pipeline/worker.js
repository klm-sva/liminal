/**
 * pipeline/worker.js
 *
 * Standalone HTTP worker that runs the pipeline with no timeout.
 * Deploy on any server (Railway, DigitalOcean, etc.) that can run Node.js.
 *
 * Required env vars:
 *   WORKER_SECRET          — shared secret, must match the Vercel env var
 *   PORT                   — optional, defaults to 3001
 *   (all pipeline env vars) — SUPABASE_*, ANTHROPIC_API_KEY, etc.
 *
 * Start: node pipeline/worker.js
 */

// Load .env.local when running locally
const path = require("path");
const fs   = require("fs");
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const express = require("express");

const app    = express();
const PORT   = process.env.PORT || 3001;
const SECRET = process.env.WORKER_SECRET;

app.use(express.json());

app.post("/process", async (req, res) => {
  // Validate secret
  const authHeader = req.headers["x-worker-secret"];
  if (!SECRET || authHeader !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { orderId, runId } = req.body ?? {};
  if (!orderId || !runId) {
    return res.status(400).json({ error: "Missing orderId or runId" });
  }

  // Acknowledge immediately — pipeline runs in background
  res.json({ status: "accepted" });

  const startedAt = Date.now();
  console.log(`[worker] job started  orderId=${orderId} runId=${runId}`);

  try {
    // Import here so env vars are loaded before the module initialises
    const { processOrder } = require("./process-order");
    const result = await processOrder(orderId, runId);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[worker] job complete orderId=${orderId} runId=${runId} status=${result.status} elapsed=${elapsed}s`);
  } catch (err) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.error(`[worker] job failed   orderId=${orderId} runId=${runId} elapsed=${elapsed}s error=${err.message}`);
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`[worker] listening on port ${PORT}`);
});
