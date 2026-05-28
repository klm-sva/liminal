import Anthropic         from "@anthropic-ai/sdk";
import { createServiceClient }   from "./lib/supabase";
import { injectTableCss, makeEditable } from "./lib/make-editable";
import { extractPdfContentFromBuffer }  from "./lib/pdf-extract";
import { buildLeedGapAnalysisPrompt }   from "./prompts/gap-analysis-leed";
import { buildWellV2GapAnalysisPrompt } from "./prompts/gap-analysis-well-v2";
import { buildWellHsrGapAnalysisPrompt } from "./prompts/gap-analysis-well-hsr";

const UPLOADS_BUCKET = "customer-uploads";
const OUTPUTS_BUCKET = "order-outputs";

const PROGRAM_LABELS: Record<string, string> = {
  leed_bd_c: "LEED BD+C v4.1",
  well_v2:   "WELL v2",
  well_hsr:  "WELL Health-Safety Rating",
};

function gapUploadFolder(customerId: string, program: string, orderId: string, attempt: number): string {
  return `${customerId}/gap-analysis/${program}/${orderId}/attempt-${attempt}`;
}

function gapOutputFolder(customerId: string, program: string, orderId: string): string {
  return `${customerId}/gap-analysis/${program}/${orderId}/outputs`;
}

export async function processGapAnalysis(orderId: string, runId: string): Promise<{ status: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client   = new Anthropic({ apiKey, timeout: 600000, maxRetries: 1 });
  const supabase = createServiceClient();

  console.log(`\n[gap-analysis] ▶ Order ${orderId} / Run ${runId}`);

  // ── Step 1: Load order, run, customer ─────────────────────────────────────
  const [runRes, orderRes] = await Promise.all([
    supabase.from("runs").select("*").eq("id", runId).single(),
    supabase.from("orders").select("*").eq("id", orderId).single(),
  ]);

  if (runRes.error)   throw new Error(`Run not found: ${runRes.error.message}`);
  if (orderRes.error) throw new Error(`Order not found: ${orderRes.error.message}`);

  const run   = runRes.data;
  const order = orderRes.data;
  const program: string = order.gap_analysis_program ?? "leed_bd_c";

  const customerRes = await supabase
    .from("customers")
    .select("*")
    .eq("id", order.customer_id)
    .single();

  if (customerRes.error) throw new Error(`Customer not found: ${customerRes.error.message}`);
  const customer = customerRes.data;

  console.log(`  Step 1: Order loaded — program=${program} customer=${customer.email}`);

  // ── Step 2: Load questionnaire responses ──────────────────────────────────
  const { data: responseRow, error: responseError } = await supabase
    .from("gap_analysis_responses")
    .select("responses")
    .eq("customer_id", order.customer_id)
    .eq("program", program)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (responseError || !responseRow) {
    console.warn(`  Step 2: No questionnaire responses found for customer=${order.customer_id} program=${program}`);
  }

  const responses = (responseRow?.responses ?? {}) as Record<string, unknown>;
  console.log(`  Step 2: Questionnaire responses loaded — ${Object.keys(responses).length} fields`);

  // ── Step 3: Update order → under_review ───────────────────────────────────
  await supabase.from("orders").update({ status: "under_review" }).eq("id", orderId);
  console.log(`  Step 3: Order → under_review`);

  // ── Step 4: List uploaded documents ───────────────────────────────────────
  const attemptNumber  = run.attempt_number ?? run.run_number ?? 1;
  const uploadsFolder  = gapUploadFolder(order.customer_id, program, orderId, attemptNumber);

  const { data: storageFiles } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .list(uploadsFolder);

  const uploads = (storageFiles ?? [])
    .filter((f) => f.name && !f.name.endsWith("/"))
    .map((f) => ({ path: `${uploadsFolder}/${f.name}`, name: f.name }));

  console.log(`  Step 4: Found ${uploads.length} uploaded file(s)`);

  // ── Step 5: Extract text from uploaded PDFs ───────────────────────────────
  let documentContext = "";

  for (const upload of uploads) {
    try {
      const { data: fileData } = await supabase.storage
        .from(UPLOADS_BUCKET)
        .download(upload.path);

      if (!fileData) continue;

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const isPdf  = upload.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        const result = await extractPdfContentFromBuffer(
          client,
          buffer,
          upload.name,
          "Extract all text content from this document. Return the full text.",
        );
        if (result?.text?.trim()) {
          documentContext += `\n--- ${upload.name} ---\n${result.text.slice(0, 8000)}\n`;
        }
      }
    } catch (err) {
      console.warn(`  Step 5: Failed to extract ${upload.name}: ${(err as Error).message}`);
    }
  }

  console.log(`  Step 5: Document context — ${documentContext.length} chars`);

  // ── Step 6: Build prompt ───────────────────────────────────────────────────
  const promptFn =
    program === "well_v2"   ? buildWellV2GapAnalysisPrompt  :
    program === "well_hsr"  ? buildWellHsrGapAnalysisPrompt :
    buildLeedGapAnalysisPrompt;

  const prompt = promptFn({ responses, documentContext });
  console.log(`  Step 6: Prompt built — ${prompt.length} chars`);

  // ── Step 7: Call Claude ────────────────────────────────────────────────────
  console.log(`  Step 7: Calling Claude...`);

  const message = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 16000,
    messages: [
      {
        role:    "user",
        content: prompt,
      },
    ],
  });

  const rawHtml = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  console.log(`  Step 7: Claude returned ${rawHtml.length} chars`);

  if (rawHtml.length < 200) {
    throw new Error(`Gap analysis output too short (${rawHtml.length} chars) — likely a prompt failure`);
  }

  // ── Step 8: Wrap HTML with full page structure and CSS ────────────────────
  const programLabel = PROGRAM_LABELS[program] ?? program;
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${programLabel} Gap Analysis</title>
</head>
<body>
${rawHtml}
</body>
</html>`;

  const standardHtml = injectTableCss(fullHtml);
  const editableHtml = makeEditable(fullHtml);

  // ── Step 9: Upload outputs to Storage ─────────────────────────────────────
  const outputFolder  = gapOutputFolder(order.customer_id, program, orderId);
  const htmlPath      = `${outputFolder}/gap-analysis.html`;
  const editablePath  = `${outputFolder}/gap-analysis-editable.html`;

  const [uploadStd, uploadEdit] = await Promise.all([
    supabase.storage.from(OUTPUTS_BUCKET).upload(
      htmlPath,
      new Blob([standardHtml], { type: "text/html" }),
      { upsert: true },
    ),
    supabase.storage.from(OUTPUTS_BUCKET).upload(
      editablePath,
      new Blob([editableHtml], { type: "text/html" }),
      { upsert: true },
    ),
  ]);

  if (uploadStd.error)  console.error(`  Step 9: standard upload failed: ${uploadStd.error.message}`);
  if (uploadEdit.error) console.error(`  Step 9: editable upload failed: ${uploadEdit.error.message}`);

  console.log(`  Step 9: Outputs uploaded`);

  // ── Step 10: Generate signed URLs ─────────────────────────────────────────
  const TTL = 7 * 24 * 3600;
  const [signedStd, signedEdit] = await Promise.all([
    supabase.storage.from(OUTPUTS_BUCKET).createSignedUrl(htmlPath,     TTL),
    supabase.storage.from(OUTPUTS_BUCKET).createSignedUrl(editablePath, TTL),
  ]);

  // ── Step 11: Update run → completed ───────────────────────────────────────
  await supabase.from("runs").update({
    status:           "completed",
    completed_at:     new Date().toISOString(),
    output_html_path: htmlPath,
  }).eq("id", runId);

  // ── Step 12: Update order → delivered ─────────────────────────────────────
  await supabase.from("orders").update({
    status:       "delivered",
    delivered_at: new Date().toISOString(),
  }).eq("id", orderId);

  console.log(`  Step 12: Order → delivered`);
  console.log(`[gap-analysis] ✓ Complete`);

  return { status: "delivered" };
}
