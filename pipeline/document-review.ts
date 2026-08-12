/**
 * pipeline/document-review.ts
 *
 * Reviews uploaded customer documents against the required document list
 * for a specific credit. Uses Claude to assess the complete uploaded set
 * against every requirement before allowing the processing pipeline to
 * proceed.
 *
 * Steps:
 *   1. Load required documents from Col 1 of automation analysis spreadsheet
 *   2. Download every uploaded file
 *   3. Send the entire uploaded set + full requirement list to Claude in one
 *      call, so any document can satisfy any requirement
 *   4. Return complete (all good, proceed) or incomplete (issues list)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as path from "path";
import * as fs from "fs";
import { createServiceClient } from "./lib/supabase";
import { preparePdfDocument } from "./lib/pdf-to-images";
import { logAuditEvent } from "./lib/supabase-ops";

// Load env when running standalone
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

export interface UploadedDocument {
  storagePath: string;    // path in customer-uploads bucket
  filename: string;       // original filename
  mimeType: string;
}

export interface DocumentIssue {
  requiredDocument: string;
  uploadedFilename: string | null;   // null = no document in the set satisfies this requirement
  issue: string;
}

export interface DocumentNote {
  requiredDocument: string;
  uploadedFilename: string;
  note: string;
}

export interface DocumentReviewResult {
  orderId: string;
  creditCode: string;
  status: "complete" | "incomplete";
  issues: DocumentIssue[];          // blocking — empty when status === "complete"
  notes: DocumentNote[];            // non-blocking caveats on otherwise-satisfied requirements
  reviewedAt: string;
}

const DOCUMENT_REVIEW_PROMPT = `You are a building certification specialist reviewing the complete set of documents a project team uploaded for a single credit.

You are given the credit this review is for, the full list of required documents, and every file the project team uploaded. Evaluate the uploaded set AS A WHOLE against the requirements. Follow these rules exactly:

1. First, identify every uploaded file: what specific type of document it is (e.g. "mechanical drawing", "architectural floor plan", "window schedule", "product cut sheet") and what specific information in it is relevant to this credit.
2. For each requirement, check whether ANY document in the uploaded set satisfies it — consider every file, not just the one that seems most obviously intended for it. State the specific information from that document that satisfies the requirement.
3. Only mark a requirement "missing" if NO uploaded document satisfies it at all.
4. Never fault a document for failing to satisfy a DIFFERENT requirement. A document that fully serves its own purpose is acceptable even if it says nothing about other requirements — e.g., a floor plan showing operable window locations is valid even though it does not show mechanical equipment; a mechanical drawing is valid even though it does not show operable windows.
5. Be lenient on completeness. If a document is the correct type and clearly relevant to a requirement but is missing a minor expected detail, mark that requirement "satisfied_with_notes" — this is informational only, never a blocker. Only mark a requirement "missing" if the uploaded set contains no document of the correct type at all, or if the only candidate document is fundamentally the wrong type, blank, corrupted, or illegible.
6. Only list a file in "irrelevantFiles" if it does not relate to ANY requirement for this credit. A file that partially or fully satisfies at least one requirement is never irrelevant.

PRECISION RULE — APPLIES TO EVERY "note" AND "missingDetail" YOU WRITE:
Name the exact, specific missing element — never a vague restatement of the requirement category. Compare:
- BAD: "Strategy-specific documentation uploads" / "Mechanical drawing documentation incomplete"
- GOOD: "Mechanical drawing is missing the outdoor air intake locations" / "Floor plan does not show which windows are operable — a window schedule or notation is needed"

NEVER copy raw source-list phrasing into "note" or "missingDetail". Specifically, never let these fields start with or contain meta-instructional lead-ins like "For each selected strategy:", "For each applicable...:", "As applicable:", "If selected:", or similar template language — that phrasing describes how the requirement list was written, not what the project team is missing. Rewrite it into a concrete, specific description of the actual missing item, grounded in what this credit requires and in what the uploaded documents already show. "requiredDocument" is the only field allowed to hold the raw requirement text — it is for internal tracking and must never be shown to the project team directly.

Respond with a single JSON object:
{
  "documents": [
    {
      "filename": string,
      "documentType": string,          // specific type, e.g. "Mechanical drawing", "Architectural floor plan"
      "relevantContent": string        // specific information in this file relevant to this credit
    }
  ],
  "requirements": [
    {
      "requiredDocument": string,        // exact text of the requirement as given — internal tracking only, never shown to the project team
      "status": "satisfied" | "satisfied_with_notes" | "missing",
      "satisfiedBy": string | null,      // filename of the document that satisfies this requirement, or null if missing
      "satisfiedDetail": string | null,  // specific information from that document that satisfies the requirement
      "note": string | null,             // present only for "satisfied_with_notes" — precise, specific description of the minor gap
      "missingDetail": string | null     // present only for "missing" — precise, specific, customer-facing description of exactly what is absent
    }
  ],
  "irrelevantFiles": string[]            // filenames relating to none of the requirements; empty array if none
}

Return only the JSON object.`;

interface DocumentSetAssessment {
  documents: Array<{
    filename: string;
    documentType: string;
    relevantContent: string;
  }>;
  requirements: Array<{
    requiredDocument: string;
    status: "satisfied" | "satisfied_with_notes" | "missing";
    satisfiedBy: string | null;
    satisfiedDetail: string | null;
    note: string | null;
    missingDetail: string | null;
  }>;
  irrelevantFiles: string[];
}

// Defensive fallback only — the prompt instructs Claude to never write this
// phrasing into customer-facing fields. Strips leading meta-instructional
// clauses (e.g. "For each selected strategy:") from raw spreadsheet text in
// case a fallback ever needs to fall back to the raw requirement string.
function sanitizeTemplateLanguage(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/^for\s+[^:]{1,100}:\s*/i, "")
    .replace(/^if\s+[^:]{1,100}:\s*/i, "")
    .trim();
}

type ContentBlock = Anthropic.TextBlockParam | Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam;

function buildFileContentBlocks(filename: string, buffer: Buffer): ContentBlock[] {
  const isPdf = filename.toLowerCase().endsWith(".pdf");
  return [
    { type: "text", text: `FILE: ${filename}` },
    isPdf
      ? (preparePdfDocument(buffer, filename) as Anthropic.DocumentBlockParam)
      : ({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") },
        } as Anthropic.ImageBlockParam),
  ];
}

async function reviewDocumentSet(
  client: Anthropic,
  creditCode: string,
  requiredDocs: string[],
  files: Array<{ filename: string; buffer: Buffer }>
): Promise<DocumentSetAssessment> {
  const contentBlocks: ContentBlock[] = [
    {
      type: "text",
      text: `Credit: ${creditCode}\n\nRequired documents for this credit:\n${requiredDocs.map((d, i) => `${i + 1}. ${d}`).join("\n")}${
        files.length === 0 ? "\n\n(No files were uploaded by the project team.)" : ""
      }`,
    },
    ...files.flatMap((f) => buildFileContentBlocks(f.filename, f.buffer)),
    {
      type: "text",
      text: "Review this complete set of uploaded documents against the required document list and return the JSON assessment.",
    },
  ];

  const response = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 8000,
    system:     DOCUMENT_REVIEW_PROMPT,
    messages:   [{ role: "user", content: contentBlocks }],
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  const json = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(json) as DocumentSetAssessment;
}

export async function reviewDocuments(
  orderId: string,
  customerId: string,
  creditCode: string,
  uploads: UploadedDocument[],
  requiredDocs: string[]
): Promise<DocumentReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client   = new Anthropic({ apiKey, timeout: 180000, maxRetries: 0 });
  const supabase = createServiceClient();

  const reviewedAt = new Date().toISOString();

  console.log(`[document-review] Order ${orderId} — ${creditCode} — ${uploads.length} upload(s)`);

  if (requiredDocs.length === 0) {
    console.log(`  No required documents defined for ${creditCode} — auto-passing review`);
    return { orderId, creditCode, status: "complete", issues: [], notes: [], reviewedAt };
  }

  console.log(`  Required: ${requiredDocs.length} document(s) per automation analysis`);

  // Download the complete uploaded set — every file is reviewed together,
  // not matched one-to-one against a single requirement. If nothing was
  // uploaded, we still call the model with an empty file set so every
  // "missing" description is written specifically rather than echoing the
  // raw requirement text back at the customer.
  let files: Array<{ filename: string; buffer: Buffer }> = [];
  if (uploads.length > 0) {
    console.log(`  Downloading ${uploads.length} uploaded file(s) for review...`);
    for (const upload of uploads) {
      const { data, error } = await supabase.storage
        .from("customer-uploads")
        .download(upload.storagePath);

      if (error || !data) {
        console.warn(`  ⚠ Failed to download ${upload.storagePath}: ${error?.message}`);
        continue;
      }

      files.push({ filename: upload.filename, buffer: Buffer.from(await data.arrayBuffer()) });
    }

    if (files.length === 0) {
      // All downloads failed — fail open so a storage error doesn't block the order
      console.warn(`  ⚠ No files could be downloaded — passing review to avoid blocking order`);
      return { orderId, creditCode, status: "complete", issues: [], notes: [], reviewedAt };
    }
  } else {
    console.log(`  No documents uploaded — reviewing full requirement list against an empty set`);
  }

  let assessment: DocumentSetAssessment;
  try {
    assessment = await reviewDocumentSet(client, creditCode, requiredDocs, files);
  } catch (err) {
    console.warn(`  ⚠ Document set review failed: ${(err as Error).message} — passing review to avoid blocking order`);
    return { orderId, creditCode, status: "complete", issues: [], notes: [], reviewedAt };
  }

  if (assessment.documents?.length) {
    for (const doc of assessment.documents) {
      console.log(`  📄 ${doc.filename} — ${doc.documentType}: ${doc.relevantContent}`);
    }
  }

  const issues: DocumentIssue[] = [];
  const notes: DocumentNote[] = [];

  for (const req of assessment.requirements ?? []) {
    if (req.status === "missing") {
      const detail = sanitizeTemplateLanguage(req.missingDetail) || sanitizeTemplateLanguage(req.requiredDocument);
      console.log(`  ✗ Missing: ${detail}`);
      issues.push({
        requiredDocument: req.requiredDocument,
        uploadedFilename: null,
        issue: detail,
      });
    } else if (req.status === "satisfied_with_notes") {
      const detail = sanitizeTemplateLanguage(req.note) || "Provided, but missing a minor expected detail.";
      console.log(`  ⚠ Satisfied with note: "${req.requiredDocument}" (${req.satisfiedBy}) — ${detail}`);
      notes.push({
        requiredDocument: req.requiredDocument,
        uploadedFilename: req.satisfiedBy ?? "unknown",
        note: detail,
      });
    } else {
      console.log(`  ✓ Satisfied: "${req.requiredDocument}" by "${req.satisfiedBy}" — ${req.satisfiedDetail ?? ""}`);
    }
  }

  if (assessment.irrelevantFiles?.length) {
    console.log(`  ℹ Irrelevant to this credit: ${assessment.irrelevantFiles.join(", ")}`);
  }

  const status = issues.length === 0 ? "complete" : "incomplete";
  console.log(`  Review result: ${status} (${issues.length} issue(s), ${notes.length} note(s))`);

  // 4. Audit log
  await logAuditEvent({
    eventType:  "document_review_complete",
    entityType: "order",
    entityId:   orderId,
    customerId,
    metadata:   {
      creditCode,
      status,
      issueCount:      issues.length,
      noteCount:       notes.length,
      uploadCount:     uploads.length,
      requiredCount:   requiredDocs.length,
      irrelevantCount: assessment.irrelevantFiles?.length ?? 0,
    },
  });

  return { orderId, creditCode, status, issues, notes, reviewedAt };
}
