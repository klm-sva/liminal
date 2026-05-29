/**
 * pipeline/document-review.ts
 *
 * Reviews uploaded customer documents against the required document list
 * for a specific credit. Uses Claude to assess each document's quality and
 * completeness before allowing the processing pipeline to proceed.
 *
 * Steps:
 *   1. Load required documents from Col 1 of automation analysis spreadsheet
 *   2. Match uploaded files against required documents
 *   3. Send each uploaded document to Claude for quality review
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
  uploadedFilename: string | null;   // null = not uploaded at all
  issue: string;
}

export interface DocumentReviewResult {
  orderId: string;
  creditCode: string;
  status: "complete" | "incomplete";
  issues: DocumentIssue[];          // empty when status === "complete"
  reviewedAt: string;
}

const DOCUMENT_REVIEW_PROMPT = `You are a LEED certification specialist reviewing a document submitted by a project team. Your task is to assess whether this document is complete, legible, and appropriate for the stated purpose.

You will be told what document type is required. Review the provided file and determine:
1. Is this the correct document type?
2. Is it complete (not truncated, not blank, not corrupted)?
3. Is it legible and professionally prepared?
4. Does it contain the key information normally expected in this document type?

Respond with a single JSON object:
{
  "acceptable": boolean,
  "issue": string | null
}

Set "acceptable" to true if the document is suitable for LEED submission.
Set "acceptable" to false and provide a concise "issue" string describing the specific problem.
The "issue" string must be written for the project team to read — be specific and actionable.
Return only the JSON object.`;

async function reviewDocument(
  client: Anthropic,
  requiredDocumentDescription: string,
  fileBuffer: Buffer,
  filename: string
): Promise<{ acceptable: boolean; issue: string | null }> {
  const isPdf = filename.toLowerCase().endsWith(".pdf");

  const contentBlocks: Anthropic.MessageParam["content"] = isPdf
    ? [
        preparePdfDocument(fileBuffer, filename) as Anthropic.DocumentBlockParam,
        {
          type: "text",
          text: `Required document type: ${requiredDocumentDescription}\n\nReview this document and return the JSON assessment.`,
        },
      ]
    : [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: fileBuffer.toString("base64"),
          },
        } as Anthropic.ImageBlockParam,
        {
          type: "text",
          text: `Required document type: ${requiredDocumentDescription}\n\nReview this document and return the JSON assessment.`,
        },
      ];

  const response = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 512,
    system:     DOCUMENT_REVIEW_PROMPT,
    messages:   [{ role: "user", content: contentBlocks }],
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const json = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(json);
  } catch {
    console.warn(`  ⚠ Review response was not valid JSON for ${filename}: ${rawText.slice(0, 200)}`);
    return { acceptable: false, issue: "Document review could not be completed — please re-upload." };
  }
}

function matchUploadToRequirement(
  requiredDescription: string,
  uploads: UploadedDocument[]
): UploadedDocument | null {
  const keywords = requiredDescription
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  let bestMatch: UploadedDocument | null = null;
  let bestScore = 0;

  for (const upload of uploads) {
    const name = upload.filename.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    const score = keywords.filter((kw) => name.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = upload;
    }
  }

  // Require at least one keyword match
  return bestScore > 0 ? bestMatch : null;
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

  console.log(`[document-review] Order ${orderId} — ${creditCode} — ${uploads.length} upload(s)`);

  if (requiredDocs.length === 0) {
    console.log(`  No required documents defined for ${creditCode} — auto-passing review`);
    return {
      orderId,
      creditCode,
      status: "complete",
      issues: [],
      reviewedAt: new Date().toISOString(),
    };
  }

  console.log(`  Required: ${requiredDocs.length} document(s) per automation analysis`);

  const issues: DocumentIssue[] = [];

  // 2. For each required document — match, download, review
  for (const requiredDoc of requiredDocs) {
    const matched = matchUploadToRequirement(requiredDoc, uploads);

    if (!matched) {
      console.log(`  ✗ Missing: "${requiredDoc}"`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: null,
        issue: `Required document not uploaded: ${requiredDoc}`,
      });
      continue;
    }

    // Download from Supabase Storage
    const { data, error } = await supabase.storage
      .from("customer-uploads")
      .download(matched.storagePath);

    if (error || !data) {
      console.warn(`  ⚠ Failed to download ${matched.storagePath}: ${error?.message}`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: matched.filename,
        issue: "File could not be retrieved for review — please re-upload.",
      });
      continue;
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    // 3. Send to Claude for review
    console.log(`  Reviewing "${matched.filename}" for: ${requiredDoc}`);
    const review = await reviewDocument(client, requiredDoc, buffer, matched.filename);

    if (!review.acceptable) {
      console.log(`  ✗ Issue: ${review.issue}`);
      issues.push({
        requiredDocument: requiredDoc,
        uploadedFilename: matched.filename,
        issue: review.issue ?? "Document did not pass review.",
      });
    } else {
      console.log(`  ✓ Accepted: "${matched.filename}"`);
    }
  }

  const status = issues.length === 0 ? "complete" : "incomplete";
  console.log(`  Review result: ${status} (${issues.length} issue(s))`);

  // 4. Audit log
  await logAuditEvent({
    eventType:  "document_review_complete",
    entityType: "order",
    entityId:   orderId,
    customerId,
    metadata:   {
      creditCode,
      status,
      issueCount:    issues.length,
      uploadCount:   uploads.length,
      requiredCount: requiredDocs.length,
    },
  });

  return {
    orderId,
    creditCode,
    status,
    issues,
    reviewedAt: new Date().toISOString(),
  };
}
