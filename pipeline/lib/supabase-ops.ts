/**
 * AI Processing Pipeline — Supabase orchestration layer.
 *
 * CRITICAL ISOLATION RULE — enforced at code level:
 * Every run MUST source files from exactly two places:
 *   1. credit-requirements bucket — ONLY the paths mapped to credits.requirements_pdf_path
 *      (and optionally credits.calculator_path)
 *   2. customer-uploads bucket — ONLY the paths stored in runs.customer_upload_paths
 *
 * No other files, no other credits, no training data, no cross-credit contamination.
 * Violations of this rule produce incorrect compliance documentation.
 */

import { createServiceClient } from "./supabase";
import type { Credit, Order, Run } from "../../src/types/database";

const REQUIREMENTS_BUCKET = "credit-requirements";
const UPLOADS_BUCKET      = "customer-uploads";
const OUTPUTS_BUCKET      = "order-outputs";

// ─── Storage helpers ───────────────────────────────────────────────────────────

async function downloadToBase64(
  supabase: ReturnType<typeof createServiceClient>,
  bucket: string,
  path: string
): Promise<{ data: string; mimeType: string }> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Failed to download ${bucket}/${path}: ${error?.message}`);
  }
  const buffer = await data.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = data.type || "application/octet-stream";
  return { data: base64, mimeType };
}

async function uploadOutput(
  supabase: ReturnType<typeof createServiceClient>,
  path: string,
  content: Blob,
  mimeType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(OUTPUTS_BUCKET)
    .upload(path, content, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Failed to upload output ${path}: ${error.message}`);
}

// ─── Context assembly ──────────────────────────────────────────────────────────

export interface PipelineFile {
  label:    string;
  bucket:   string;
  path:     string;
  base64:   string;
  mimeType: string;
}

export interface PipelineContext {
  credit:      Credit;
  order:       Order;
  run:         Run;
  systemFiles: PipelineFile[];
  customerFiles: PipelineFile[];
  promptText:  string;
  wellVerificationRowNote: string | null;
}

export async function assemblePipelineContext(
  orderId: string,
  runId: string
): Promise<PipelineContext> {
  const supabase = createServiceClient();

  const [runResult, orderResult] = await Promise.all([
    supabase.from("runs").select("*").eq("id", runId).single(),
    supabase.from("orders").select("*").eq("id", orderId).single(),
  ]);

  if (runResult.error)   throw new Error(`Run not found: ${runResult.error.message}`);
  if (orderResult.error) throw new Error(`Order not found: ${orderResult.error.message}`);

  const run   = runResult.data as Run;
  const order = orderResult.data as Order;

  const creditResult = await supabase.from("credits").select("*").eq("id", order.credit_id!).single();
  if (creditResult.error) throw new Error(`Credit not found: ${creditResult.error.message}`);
  const credit = creditResult.data as Credit;

  if (run.order_id !== orderId) throw new Error("Run/order mismatch");

  const systemFiles: PipelineFile[]   = [];
  const customerFiles: PipelineFile[] = [];

  // 1. Requirements PDF (always required)
  const reqPdf = await downloadToBase64(supabase, REQUIREMENTS_BUCKET, credit.requirements_pdf_path);
  systemFiles.push({
    label:    `Requirements PDF — ${credit.credit_code}`,
    bucket:   REQUIREMENTS_BUCKET,
    path:     credit.requirements_pdf_path,
    base64:   reqPdf.data,
    mimeType: reqPdf.mimeType,
  });

  // 2. LEED calculator (only if this credit has one)
  if (credit.has_calculator && credit.calculator_path) {
    const calc = await downloadToBase64(supabase, REQUIREMENTS_BUCKET, credit.calculator_path);
    systemFiles.push({
      label:    `Calculator — ${credit.credit_code}`,
      bucket:   REQUIREMENTS_BUCKET,
      path:     credit.calculator_path,
      base64:   calc.data,
      mimeType: calc.mimeType,
    });
  }

  // 3. WELL verification row (only for WELL programs)
  let wellVerificationRowNote: string | null = null;

  if (
    (credit.program === "well_v2" || credit.program === "well_hsr") &&
    credit.well_verification_row !== null
  ) {
    const excelPath = credit.program === "well_v2"
      ? "well-v2/verification-requirements.xlsx"
      : "well-hsr/verification-requirements.xlsx";
    const verif = await downloadToBase64(supabase, REQUIREMENTS_BUCKET, excelPath);
    systemFiles.push({
      label:    `Verification Requirements Excel — row ${credit.well_verification_row}`,
      bucket:   REQUIREMENTS_BUCKET,
      path:     excelPath,
      base64:   verif.data,
      mimeType: verif.mimeType,
    });
    wellVerificationRowNote =
      `Refer to row ${credit.well_verification_row} of the attached verification-requirements.xlsx for the exact IWBI verification method for this feature.`;
  }

  // 4. Customer uploads (ONLY paths stored against this run)
  if (!run.customer_upload_paths || run.customer_upload_paths.length === 0) {
    throw new Error(`Run ${runId} has no customer upload paths. Cannot process.`);
  }

  for (const uploadPath of run.customer_upload_paths) {
    const file = await downloadToBase64(supabase, UPLOADS_BUCKET, uploadPath);
    customerFiles.push({
      label:    `Customer upload: ${uploadPath.split("/").pop()}`,
      bucket:   UPLOADS_BUCKET,
      path:     uploadPath,
      base64:   file.data,
      mimeType: file.mimeType,
    });
  }

  return { credit, order, run, systemFiles, customerFiles, promptText: credit.prompt_text, wellVerificationRowNote };
}

// ─── Run status management ─────────────────────────────────────────────────────

export async function markRunProcessing(runId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("runs").update({ status: "processing" }).eq("id", runId);
  if (error) throw new Error(`Failed to mark run processing: ${error.message}`);
}

export async function markRunCompleted(
  runId: string,
  outputs: {
    output_docx_path:        string;
    output_html_path:        string;
    output_form_path?:       string;
    output_calculator_path?: string;
  }
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("runs").update({
    status:                 "completed",
    completed_at:           new Date().toISOString(),
    output_docx_path:       outputs.output_docx_path,
    output_html_path:       outputs.output_html_path,
    output_form_path:       outputs.output_form_path ?? null,
    output_calculator_path: outputs.output_calculator_path ?? null,
  }).eq("id", runId);
  if (error) throw new Error(`Failed to mark run completed: ${error.message}`);
}

export async function markRunFailed(runId: string, message: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("runs").update({
    status:        "failed",
    completed_at:  new Date().toISOString(),
    error_message: message,
  }).eq("id", runId);
  if (error) throw new Error(`Failed to mark run failed: ${error.message}`);
}

export async function uploadRunOutput(
  customerId: string,
  orderId: string,
  runNumber: number,
  filename: string,
  content: Blob,
  mimeType: string
): Promise<string> {
  const supabase = createServiceClient();
  const path = `${customerId}/${orderId}/${runNumber}/${filename}`;
  await uploadOutput(supabase, path, content, mimeType);
  return path;
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export interface AuditEvent {
  eventType:  string;
  entityType: string;
  entityId:   string;
  customerId: string;
  metadata?:  Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_log").insert({
    event_type:  event.eventType,
    entity_type: event.entityType,
    entity_id:   event.entityId,
    customer_id: event.customerId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata:    (event.metadata ?? {}) as any,
  });
  if (error) {
    console.warn(`[audit] Failed to log ${event.eventType}: ${error.message}`);
  }
}
