/**
 * pipeline/lib/policy-generator.ts
 *
 * Universal policy handler.
 *
 * Two modes per requirement:
 *   • Existing policy uploaded → review against credit requirements, output updated
 *     version with any compliance gaps filled. Changes marked [ADDED FOR COMPLIANCE].
 *   • No existing policy → generate complete draft with [PLACEHOLDER] fields.
 *
 * Applies universally to all credits and features across LEED and WELL.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";
import { makeEditable } from "./make-editable";

// ─── Policy detection ─────────────────────────────────────────────────────────

const POLICY_PATTERNS: RegExp[] = [
  /signed\s+\w+\s+policy/i,
  /written\s+\w+\s+policy/i,
  /\w+\s+policy\s+(letter|document|statement|commitment)/i,
  /policy\s+(on|for|regarding)\s+/i,
  /commitment\s+letter/i,
  /signed\s+commitment/i,
  /signed\s+statement/i,
  /management\s+plan/i,
  /operations\s+(and\s+maintenance\s+)?plan/i,
  /maintenance\s+plan/i,
  /transportation\s+demand\s+management/i,
  /tdm\s+program/i,
  /green\s+cleaning\s+policy/i,
  /smoking\s+policy/i,
  /tobacco\s+policy/i,
  /lighting\s+policy/i,
  /thermal\s+comfort\s+policy/i,
  /indoor\s+air\s+quality\s+policy/i,
  /acoustic\s+policy/i,
  /wellness\s+policy/i,
  /tenant\s+guide(lines?)?/i,
  /lease\s+(agreement|language|addendum)/i,
  /\bpolicy\b/i,
];

export interface PolicyRequirement {
  rawText:    string;
  policyType: string;
}

export interface UploadedPolicy {
  filename: string;   // original filename e.g. "green-cleaning-policy.pdf"
  text:     string;   // extracted text content
}

export interface PolicyDraft {
  policyType:  string;
  mode:        "new-draft" | "reviewed";  // whether this was generated or updated from uploaded
  filename:    string;
  outputPath:  string;
  html:        string;
  tokensIn:    number;
  tokensOut:   number;
}

export function detectPolicyRequirements(creditRow: string): PolicyRequirement[] {
  const fragments = creditRow
    .split(/[;\|\n]|(?<=[a-z])\s+and\s+(?=[a-z])/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const found: PolicyRequirement[] = [];
  const seen  = new Set<string>();

  for (const fragment of fragments) {
    if (!POLICY_PATTERNS.some((p) => p.test(fragment))) continue;

    const label = derivePolicyLabel(fragment);
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());

    found.push({ rawText: fragment, policyType: label });
  }

  return found;
}

function derivePolicyLabel(text: string): string {
  const clean = text
    .replace(/^(submit|provide|upload|include|attach|signed|written|completed|approved)\s+/i, "")
    .replace(/\s+(on\s+(company|organization|project)\s+letterhead.*|signed\s+by.*|as\s+required.*)$/i, "")
    .replace(/\s+\(.*?\)/g, "")
    .trim();

  return clean
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 80);
}

// ─── Uploaded policy matching ─────────────────────────────────────────────────
// Find the best uploaded document for a given policy type by keyword overlap.
// Normalizes both strings to lowercase word tokens and counts shared words.

function findMatchingUpload(
  policyType: string,
  uploads: UploadedPolicy[],
): UploadedPolicy | null {
  if (uploads.length === 0) return null;

  const stopWords = new Set(["a", "an", "the", "and", "or", "of", "for", "in", "on", "to", "policy"]);
  const typeTokens = new Set(
    policyType.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !stopWords.has(t)),
  );

  let best: UploadedPolicy | null = null;
  let bestScore = 0;

  for (const upload of uploads) {
    const nameTokens = upload.filename.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    // Also scan first 500 chars of content for policy title keywords
    const contentTokens = upload.text.slice(0, 500).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    const allTokens = new Set([...nameTokens, ...contentTokens]);

    let score = 0;
    for (const t of typeTokens) {
      if (allTokens.has(t)) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      best = upload;
    }
  }

  // Require at least one meaningful keyword overlap to avoid false matches
  return bestScore >= 1 ? best : null;
}

// ─── Generate new policy draft ────────────────────────────────────────────────

async function generatePolicyHtml(
  client:      Anthropic,
  requirement: PolicyRequirement,
  context: {
    creditName:             string;
    certProgram:            string;
    projectAddress:         string;
    creditRequirementsText: string;
    creditRow:              string;
  },
  usage: { input: number; output: number },
): Promise<string> {
  const prompt = `You are drafting a formal policy document for a building certification submission.

CREDIT / FEATURE: ${context.creditName}
CERTIFICATION PROGRAM: ${context.certProgram}
PROJECT ADDRESS: ${context.projectAddress}

POLICY REQUIRED: ${requirement.policyType}
ORIGINAL REQUIREMENT TEXT: ${requirement.rawText}

CREDIT REQUIREMENTS (for context on what the policy must address):
${context.creditRequirementsText}

CREDIT AUTOMATION ANALYSIS ROW:
${context.creditRow}

TASK:
Draft a complete, professional policy document that satisfies the above requirement for certification submission.

RULES:
1. Output ONLY the HTML body content — no DOCTYPE, no <html>, no <head>, no <body> tags.
2. Use placeholder fields in ALL CAPS in square brackets for any information the organization must supply:
   - [ORGANIZATION NAME]
   - [BUILDING NAME / ADDRESS]
   - [EFFECTIVE DATE]
   - [POLICY REVIEW DATE]
   - [AUTHORIZED SIGNATORY NAME]
   - [AUTHORIZED SIGNATORY TITLE]
   - [DEPARTMENT / CONTACT NAME]
   - Any other project-specific fields
3. The policy must address every requirement listed in the credit/feature for this document type.
4. Include all standard policy sections: Purpose, Scope, Policy Statement, Procedures/Requirements, Responsibilities, Review and Update.
5. Write in formal organizational policy language — clear, specific, and actionable.
6. The policy must be complete enough to submit directly after the owner fills in the placeholders and signs.
7. Do not include any narration, preamble, or explanation — output the policy document only.
8. Use clean HTML with inline styles matching this color scheme:
   - Headers: color #2b4044
   - Body text: color #1a1a1a, font-family Arial, font-size 13px
   - Section headers: color #327cb9, border-bottom 1px solid #327cb9
   - Placeholder fields: background #fff3cd, color #856404, padding 0 4px, border-radius 2px
   - Signature block: border-top 2px solid #2b4044, margin-top 40px, padding-top 16px`;

  const response = await client.messages.create({
    model:       "claude-sonnet-4-6",
    max_tokens:  8000,
    temperature: 0,
    messages:    [{ role: "user", content: prompt }],
  });

  usage.input  += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("")
    .trim();
}

// ─── Review and update an existing policy ────────────────────────────────────

async function reviewPolicyHtml(
  client:          Anthropic,
  requirement:     PolicyRequirement,
  existingPolicy:  UploadedPolicy,
  context: {
    creditName:             string;
    certProgram:            string;
    projectAddress:         string;
    creditRequirementsText: string;
    creditRow:              string;
  },
  usage: { input: number; output: number },
): Promise<string> {
  const prompt = `You are a certification compliance specialist reviewing an existing organizational policy.

CREDIT / FEATURE: ${context.creditName}
CERTIFICATION PROGRAM: ${context.certProgram}
PROJECT ADDRESS: ${context.projectAddress}

POLICY BEING REVIEWED: ${requirement.policyType}
ORIGINAL REQUIREMENT TEXT: ${requirement.rawText}
SOURCE FILE: ${existingPolicy.filename}

CREDIT REQUIREMENTS (every item the policy must address for certification):
${context.creditRequirementsText}

CREDIT AUTOMATION ANALYSIS ROW:
${context.creditRow}

EXISTING POLICY TEXT:
${existingPolicy.text}

TASK:
Review the existing policy against the certification requirements above. Identify any compliance gaps — requirements the policy does not currently address — and produce a complete updated version of the policy that fills those gaps.

RULES:
1. Output ONLY the HTML body content — no DOCTYPE, no <html>, no <head>, no <body> tags.
2. Preserve all existing policy content. Do not remove, weaken, or reword any existing provisions unless they directly conflict with the certification requirements.
3. For every compliance gap, add the missing content clearly marked with:
   <span style="background:#d1ecf1;color:#0c5460;padding:0 4px;border-radius:2px;font-size:11px;">[ADDED FOR ${context.certProgram.includes("WELL") ? "WELL" : "LEED"} COMPLIANCE]</span>
4. If existing text needs minor revision to meet a requirement, add the corrected version immediately after the original line, marked:
   <span style="background:#f8d7da;color:#721c24;padding:0 4px;border-radius:2px;font-size:11px;">[REVISED FOR COMPLIANCE — replace line above]</span>
5. Use placeholder fields in ALL CAPS in square brackets for any missing organizational details:
   - [ORGANIZATION NAME], [AUTHORIZED SIGNATORY NAME], [EFFECTIVE DATE], etc.
6. If the policy already fully satisfies all requirements, output the policy as clean HTML with no changes marked — just confirm coverage.
7. Do not include any narration, preamble, or explanation — output the updated policy document only.
8. Use clean HTML with inline styles:
   - Headers: color #2b4044
   - Body text: color #1a1a1a, font-family Arial, font-size 13px
   - Section headers: color #327cb9, border-bottom 1px solid #327cb9
   - Placeholder fields: background #fff3cd, color #856404, padding 0 4px, border-radius 2px
   - Signature block: border-top 2px solid #2b4044, margin-top 40px, padding-top 16px`;

  const response = await client.messages.create({
    model:       "claude-sonnet-4-6",
    max_tokens:  8000,
    temperature: 0,
    messages:    [{ role: "user", content: prompt }],
  });

  usage.input  += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("")
    .trim();
}

// ─── Policy slug helper ───────────────────────────────────────────────────────

function policySlug(creditSlug: string, policyType: string, mode: "new-draft" | "reviewed"): string {
  const policyPart = policyType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const suffix = mode === "reviewed" ? "reviewed" : "draft";
  return `${creditSlug}-${policyPart}-${suffix}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePolicyDrafts(
  client:      Anthropic,
  creditRow:   string,
  context: {
    creditName:             string;
    certProgram:            string;
    projectAddress:         string;
    creditRequirementsText: string;
    creditSlug:             string;
    outputDir:              string;
    uploadedDocuments?:     UploadedPolicy[];
  },
  usage: { input: number; output: number },
): Promise<PolicyDraft[]> {
  const requirements = detectPolicyRequirements(creditRow);

  if (requirements.length === 0) {
    console.log(`  [policy] No policy requirements detected in Column 1`);
    return [];
  }

  console.log(`  [policy] ${requirements.length} policy requirement(s) detected:`);
  requirements.forEach((r) => console.log(`    • ${r.policyType}`));

  const uploads = context.uploadedDocuments ?? [];
  const drafts: PolicyDraft[] = [];

  for (const req of requirements) {
    const t0 = Date.now();

    const match = findMatchingUpload(req.policyType, uploads);
    const mode: "new-draft" | "reviewed" = match ? "reviewed" : "new-draft";

    if (match) {
      console.log(`  [policy] Reviewing uploaded policy for: ${req.policyType} (source: ${match.filename})...`);
    } else {
      console.log(`  [policy] Drafting new policy for: ${req.policyType}...`);
    }

    try {
      const bodyHtml = match
        ? await reviewPolicyHtml(client, req, match, {
            creditName:             context.creditName,
            certProgram:            context.certProgram,
            projectAddress:         context.projectAddress,
            creditRequirementsText: context.creditRequirementsText,
            creditRow,
          }, usage)
        : await generatePolicyHtml(client, req, {
            creditName:             context.creditName,
            certProgram:            context.certProgram,
            projectAddress:         context.projectAddress,
            creditRequirementsText: context.creditRequirementsText,
            creditRow,
          }, usage);

      const slug       = policySlug(context.creditSlug, req.policyType, mode);
      const today      = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const fullHtml   = wrapPolicyHtml(bodyHtml, req.policyType, context.creditName, today, mode, match?.filename);
      const editableHtml = makeEditable(fullHtml);
      const outputPath = path.join(context.outputDir, `${slug}.html`);

      fs.mkdirSync(context.outputDir, { recursive: true });
      fs.writeFileSync(outputPath, editableHtml);

      const modeLabel = mode === "reviewed" ? "reviewed + updated" : "new draft";
      console.log(`  [policy] ✓ ${req.policyType} — ${modeLabel} — ${Math.round(editableHtml.length / 1024)} KB → ${path.basename(outputPath)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

      drafts.push({
        policyType:  req.policyType,
        mode,
        filename:    path.basename(outputPath),
        outputPath,
        html:        editableHtml,
        tokensIn:    0,
        tokensOut:   0,
      });
    } catch (err) {
      console.warn(`  [policy] ⚠ Failed to process "${req.policyType}": ${(err as Error).message}`);
    }
  }

  return drafts;
}

// ─── HTML wrapper ─────────────────────────────────────────────────────────────

function wrapPolicyHtml(
  body:         string,
  policyType:   string,
  creditName:   string,
  date:         string,
  mode:         "new-draft" | "reviewed",
  sourceFile?:  string,
): string {
  const banner = mode === "reviewed"
    ? `<div class="draft-banner" style="background:#d1ecf1;border-color:#bee5eb;color:#0c5460;">
  <strong>REVIEWED &amp; UPDATED — Compliance Review Complete</strong><br/>
  This policy was reviewed against ${escHtml(creditName)} requirements on ${escHtml(date)}.
  ${sourceFile ? `Source file: <em>${escHtml(sourceFile)}</em>. ` : ""}
  Sections marked <span style="background:#d1ecf1;color:#0c5460;padding:0 3px;border-radius:2px;">[ADDED FOR COMPLIANCE]</span>
  or <span style="background:#f8d7da;color:#721c24;padding:0 3px;border-radius:2px;">[REVISED FOR COMPLIANCE]</span>
  were added or amended to meet certification requirements. Review all changes, then have an authorized representative sign before submitting.
</div>`
    : `<div class="draft-banner">
  <strong>DRAFT — Review Required Before Submission</strong><br/>
  Complete all <span style="background:#fff3cd;color:#856404;padding:0 3px;border-radius:2px;">[PLACEHOLDER]</span> fields,
  have an authorized representative review the document, and obtain a wet or electronic signature before submitting to the certification reviewer.
  This draft was generated on ${escHtml(date)}.
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(policyType)} — ${mode === "reviewed" ? "Reviewed" : "Draft"}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 32px; max-width: 860px; }
    h1   { font-size: 20px; color: #2b4044; border-bottom: 2px solid #2b4044; padding-bottom: 8px; margin-bottom: 4px; }
    h2   { font-size: 14px; color: #327cb9; border-bottom: 1px solid #327cb9; padding-bottom: 4px; margin-top: 24px; }
    h3   { font-size: 13px; color: #2b4044; margin-top: 16px; }
    p, li { line-height: 1.6; margin-bottom: 8px; }
    .draft-banner {
      background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;
      padding: 10px 16px; margin-bottom: 24px; font-size: 12px; color: #856404;
    }
    .draft-banner strong { font-size: 13px; }
    .credit-ref { font-size: 11px; color: #666; margin-bottom: 24px; }
  </style>
</head>
<body>

${banner}

<h1>${escHtml(policyType)}</h1>
<div class="credit-ref">${mode === "reviewed" ? "Reviewed for" : "Generated for"}: ${escHtml(creditName)}</div>

${body}

</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Checklist HTML helper ────────────────────────────────────────────────────

export function policyChecklistHtml(drafts: PolicyDraft[]): string {
  if (drafts.length === 0) return "";

  const items = drafts.map((d) => {
    const isReviewed = d.mode === "reviewed";
    const badge = isReviewed
      ? `<span style="background:#d1ecf1;color:#0c5460;border:1px solid #bee5eb;border-radius:3px;padding:2px 8px;font-size:11px;font-weight:bold;">✓ REVIEWED &amp; UPDATED</span>`
      : `<span style="background:#d4edda;color:#155724;border:1px solid #c3e6cb;border-radius:3px;padding:2px 8px;font-size:11px;font-weight:bold;">✓ DRAFT PROVIDED</span>`;
    const action = isReviewed
      ? "Review all compliance additions/revisions marked in the document, confirm with your team, then obtain authorized signature before submitting."
      : "Review draft, fill all [PLACEHOLDER] fields, and obtain authorized signature before submitting.";
    return `
  <tr>
    <td style="padding:8px 12px;border-bottom:1px solid #dee2e6;">
      <strong>${escHtml(d.policyType)}</strong><br/>
      <span style="font-size:11px;color:#666;">File: ${escHtml(d.filename)}</span>
    </td>
    <td style="padding:8px 12px;border-bottom:1px solid #dee2e6;">${badge}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #dee2e6;font-size:11px;color:#666;">${escHtml(action)}</td>
  </tr>`;
  }).join("");

  const reviewedCount = drafts.filter((d) => d.mode === "reviewed").length;
  const newCount      = drafts.length - reviewedCount;
  const summary = [
    reviewedCount > 0 ? `${reviewedCount} reviewed` : null,
    newCount      > 0 ? `${newCount} new draft${newCount !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");

  return `
<div style="background:#d4edda;border:1px solid #c3e6cb;border-radius:4px;padding:12px 16px;margin:16px 0;">
  <strong style="color:#155724;">✓ Policy Document(s) — ${drafts.length} file${drafts.length !== 1 ? "s" : ""} (${summary})</strong>
  <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;">
    <thead>
      <tr style="background:#c3e6cb;">
        <th style="padding:6px 12px;text-align:left;">Policy Document</th>
        <th style="padding:6px 12px;text-align:left;">Status</th>
        <th style="padding:6px 12px;text-align:left;">Action Required</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table>
</div>`;
}
