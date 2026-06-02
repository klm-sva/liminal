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
 * Build:  npm run build:worker
 * Start:  node pipeline/worker.js
 */

import * as path from "path";
import * as fs   from "fs";

// ── Step 1: log immediately so Railway shows something even if we crash ────────
console.log("[worker] starting up...");

// ── Step 2: load .env.local for local development ─────────────────────────────
try {
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
    console.log("[worker] loaded .env.local");
  }
} catch (err) {
  console.error("[worker] failed to load .env.local:", (err as Error).message);
}

// ── Step 3: validate required env vars ────────────────────────────────────────
const REQUIRED_VARS = [
  "WORKER_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "ANTHROPIC_API_KEY",
];
const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error("[worker] missing required env vars:", missing.join(", "));
  process.exit(1);
}
console.log("[worker] env vars OK");

// ── Step 4: load express ───────────────────────────────────────────────────────
let express: typeof import("express");
try {
  express = require("express");
  console.log("[worker] express loaded");
} catch (err) {
  console.error("[worker] failed to load express:", (err as Error).message);
  process.exit(1);
}

const app    = express();
const PORT   = process.env.PORT ?? 3001;
const SECRET = process.env.WORKER_SECRET!;

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", (_req: any, res: any) => {
  res.json({ status: "ok" });
});

app.post("/process", async (req: any, res: any) => {
  const authHeader = req.headers["x-worker-secret"];
  if (authHeader !== SECRET) {
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
    // Route to gap analysis or credit pipeline based on order type
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: order } = await supabase
      .from("orders")
      .select("credit_id")
      .eq("id", orderId)
      .single();

    let result: { status: string; issues?: string[] };
    if (!order?.credit_id) {
      const { processGapAnalysis } = require("./process-gap-analysis");
      result = await processGapAnalysis(orderId, runId);
    } else {
      const { processOrder } = require("./process-order");
      result = await processOrder(orderId, runId);
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[worker] job complete orderId=${orderId} runId=${runId} status=${result.status} elapsed=${elapsed}s`);

    // Send documents-requested email — this can only be done here since the worker
    // calls processOrder directly and the Vercel internal route is never used.
    if (result.status === "documents_requested") {
      try {
        const { data: orderFull } = await supabase
          .from("orders")
          .select("customer_id, credit_id, credits(credit_name)")
          .eq("id", orderId)
          .single();
        const { data: customer } = await supabase
          .from("customers")
          .select("email, name")
          .eq("id", orderFull?.customer_id)
          .single();
        const creditName = (orderFull?.credits as { credit_name: string } | null)?.credit_name ?? "your credit";
        const { sendDocumentsRequestedEmail } = require("../src/lib/resend");
        await sendDocumentsRequestedEmail({
          to:        customer?.email ?? "",
          name:      customer?.name  ?? "there",
          creditName,
          orderId,
          issues:    result.issues ?? [],
        });
        console.log(`[worker] documents-requested email sent for orderId=${orderId}`);
      } catch (emailErr) {
        console.warn(`[worker] failed to send documents-requested email: ${(emailErr as Error).message}`);
      }
    }
  } catch (err) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.error(`[worker] job failed   orderId=${orderId} runId=${runId} elapsed=${elapsed}s error=${(err as Error).message}`);
    console.error((err as Error).stack);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

try {
  app.listen(PORT, () => {
    console.log(`[worker] listening on port ${PORT}`);
  });
} catch (err) {
  console.error("[worker] failed to start server:", (err as Error).message);
  process.exit(1);
}
