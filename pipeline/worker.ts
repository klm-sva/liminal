/**
 * pipeline/worker.ts
 *
 * Standalone HTTP worker that runs the pipeline with no timeout.
 * Deploy on any server (Railway, DigitalOcean, etc.) that can run Node.js.
 *
 * Required env vars:
 *   WORKER_SECRET          — shared secret, must match the Vercel env var
 *   PORT                   — optional, defaults to 3001
 *   (all pipeline env vars) — SUPABASE_*, ANTHROPIC_API_KEY, etc.
 *
 * Start: npx ts-node --skip-project pipeline/worker.ts
 */

import * as path    from "path";
import * as fs      from "fs";
import express      from "express";
import { processOrder } from "./process-order";

// Load .env.local when running locally
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

const app    = express();
const PORT   = process.env.PORT ?? 3001;
const SECRET = process.env.WORKER_SECRET;

app.use(express.json());

app.post("/process", async (req: express.Request, res: express.Response) => {
  const authHeader = req.headers["x-worker-secret"];
  if (!SECRET || authHeader !== SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { orderId, runId } = (req.body ?? {}) as { orderId?: string; runId?: string };
  if (!orderId || !runId) {
    res.status(400).json({ error: "Missing orderId or runId" });
    return;
  }

  // Acknowledge immediately — pipeline runs in background
  res.json({ status: "accepted" });

  const startedAt = Date.now();
  console.log(`[worker] job started  orderId=${orderId} runId=${runId}`);

  try {
    const result = await processOrder(orderId, runId);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[worker] job complete orderId=${orderId} runId=${runId} status=${result.status} elapsed=${elapsed}s`);
  } catch (err) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.error(`[worker] job failed   orderId=${orderId} runId=${runId} elapsed=${elapsed}s error=${(err as Error).message}`);
  }
});

app.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[worker] listening on port ${PORT}`);
});
