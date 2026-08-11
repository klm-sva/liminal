/**
 * pipeline/drawing-review.ts
 *
 * Reviews uploaded drawing files for legibility and usability before
 * the extraction pipeline runs. Only called on attempt 1 — attempt 2+
 * skips review and processes whatever the customer provided.
 *
 * Returns acceptable=true (proceed) or a list of issues to send back
 * to the customer via the standard documents_requested flow.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "./lib/supabase";
import { preparePdfDocument } from "./lib/pdf-to-images";

const DRAWING_REVIEW_PROMPT = `You are a building certification specialist reviewing drawing files submitted by a project team. Assess whether these files are legible and usable for extracting basic building data needed for certification work.

Review the provided files and determine:
1. Are these recognizable as architectural, engineering, or construction drawings?
2. Are they legible — not excessively blurry, not corrupted, not blank?
3. Is at least one floor plan present?

Be lenient. Drawings do not need to be complete or stamped. Only flag genuine problems that would prevent extracting basic building information such as floor area, occupancy, or site data.

Respond with a single JSON object:
{
  "acceptable": boolean,
  "issues": string[]
}

Set "acceptable" to true if the drawings are usable.
Set "acceptable" to false and describe each specific problem in "issues". Write issues for the project team — be specific and actionable (e.g., "No floor plan found — please include architectural floor plan sheets").
Return only the JSON object.`;

export interface DrawingReviewResult {
  acceptable: boolean;
  issues:     string[];
}

export async function reviewDrawings(
  customerId:   string,
  projectId:    string,
  drawingPaths: string[],
): Promise<DrawingReviewResult> {
  if (drawingPaths.length === 0) {
    return { acceptable: true, issues: [] };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client   = new Anthropic({ apiKey, timeout: 180000, maxRetries: 0 });
  const supabase = createServiceClient();

  console.log(`[drawing-review] Reviewing ${drawingPaths.length} drawing file(s)...`);

  const contentBlocks: Anthropic.MessageParam["content"] = [];

  for (const drawingPath of drawingPaths) {
    const { data, error } = await supabase.storage
      .from("customer-uploads")
      .download(drawingPath);

    if (error || !data) {
      console.warn(`  [drawing-review] Failed to download ${drawingPath}: ${error?.message}`);
      continue;
    }

    const buffer   = Buffer.from(await data.arrayBuffer());
    const filename = drawingPath.split("/").pop() ?? "drawing.pdf";
    contentBlocks.push(preparePdfDocument(buffer, filename) as Anthropic.DocumentBlockParam);
    console.log(`  ✓ loaded ${filename}`);
  }

  if (contentBlocks.length === 0) {
    // All downloads failed — fail open so a storage error doesn't block the order
    console.warn(`  [drawing-review] No files loaded — passing review to avoid blocking order`);
    return { acceptable: true, issues: [] };
  }

  contentBlocks.push({
    type: "text",
    text: "Review these drawing files and return the JSON assessment.",
  });

  const response = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 512,
    system:     DRAWING_REVIEW_PROMPT,
    messages:   [{ role: "user", content: contentBlocks }],
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const json   = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const result = JSON.parse(json) as { acceptable: boolean; issues: string[] };
    return {
      acceptable: result.acceptable === true,
      issues:     Array.isArray(result.issues) ? result.issues : [],
    };
  } catch {
    console.warn(`  [drawing-review] Response not valid JSON: ${rawText.slice(0, 200)} — passing review`);
    // Fail open — a review parse error should not block the customer's order
    return { acceptable: true, issues: [] };
  }
}
