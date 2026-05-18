/**
 * pipeline/lib/validate-output.ts
 *
 * Pre-delivery validation: blocks any output that asks the customer to provide
 * data that the pipeline already retrieves automatically.
 *
 * DESIGN PHILOSOPHY:
 * LEED and WELL documentation legitimately uses words like "provide", "submit",
 * "upload", and "schedule" in many non-request contexts (section titles, data
 * source citations, service level descriptions, etc.). Overly broad patterns
 * produce false positives that destroy otherwise correct output.
 *
 * This validator uses only UNAMBIGUOUS patterns — constructs that cannot
 * plausibly mean anything other than asking the customer/owner to supply data
 * that the pipeline can retrieve automatically:
 *
 *   1. [OWNER/CUSTOMER TO CONFIRM: ...specific auto-retrievable data...]
 *   2. [INSERT TRANSIT DATA] style unfilled placeholders
 *   3. Named-subject imperative: "project team must provide trip counts from [agency]"
 *   4. Very specific full-phrase patterns: "provide trip counts...sourced from...timetables"
 *
 * NOT flagged (all legitimate in LEED documentation):
 *   - "Data Source: IndyGo GTFS Feed"
 *   - "Section 9 — Transit Schedule Documentation table" (TOC entry)
 *   - "Routes 17 and 39 each independently provide 59 directional trips" (service level)
 *   - "Site Plan Upload field" (form field label)
 *   - "[OWNER TO CONFIRM: Is transit service temporarily rerouted?]" (owner decision)
 */

export interface ValidationViolation {
  description: string;
  context: string;
}

const BLOCKING_PATTERNS: Array<{ pattern: RegExp; description: string }> = [

  // ── 1. Unfilled auto-retrievable placeholders ────────────────────────────
  // [INSERT TRANSIT DATA], [INSERT TRIP COUNT], [INSERT GTFS DATA], etc.
  {
    pattern: /\[INSERT\s+[^\]]{0,80}(?:TRANSIT\s+(?:SCHEDULE|DATA|TIMETABLE)|TRIP\s+COUNT|GTFS|WALKING\s+DISTANCE\s+(?:MEASUREMENT|DATA)|CENSUS\s+DATA|UTILITY\s+RATE|AERIAL\s+(?:MAP|IMAGE)|WEATHER\s+DATA)[^\]]{0,30}\]/i,
    description: "Unfilled placeholder for auto-retrievable data",
  },

  // ── 2. [OWNER/CUSTOMER TO CONFIRM] on auto-retrievable data ─────────────
  // Only flags when the content is unambiguously auto-retrievable.
  // EXCLUDED: "transit agency" (appears in "transit agency committed to restoring service")
  // EXCLUDED: "service rerouted", "service disruption" (owner decision, not auto-retrievable)
  // EXCLUDED: "site plan", "pedestrian routes", "drawing set" (legitimate customer uploads)
  {
    pattern: /\[(?:CUSTOMER|TEAM|OWNER)\s+TO\s+(?:PROVIDE|CONFIRM)[^\]]{0,120}(?:transit\s+(?:schedule|timetable)|bus\s+(?:schedule|route\s+schedule)|trip\s+counts?|directional\s+(?:trip|count)|one-direction\s+(?:trip|count)|gtfs|census\s+data|utility\s+rates?|aerial\s+(?:map|photo)|weather\s+data|walking\s+distance\s+(?:measurement|data))/i,
    description: "[OWNER/CUSTOMER TO CONFIRM] used on auto-retrievable item",
  },

  // ── 3. Named-subject instruction to customer ─────────────────────────────
  // "customer must provide trip counts" / "project team should collect GTFS data"
  // Requires named subject + modal verb, so it cannot match descriptive text.
  {
    pattern: /(?:customer|owner|project\s+team|applicant|you)\s+(?:should|must|will\s+need\s+to|needs?\s+to|is\s+required\s+to|are\s+required\s+to)\s+(?:provide|submit|obtain|collect|gather|supply)\s+[^.]{0,120}(?:trip\s+counts?|transit\s+(?:schedule|timetable)|directional\s+(?:trip|count)|gtfs|census\s+data|utility\s+rates?)/i,
    description: "Customer instructed by name to obtain auto-retrievable data",
  },

  // ── 4. Full-phrase: provide trip counts from agency timetables ────────────
  // "provide one-direction trip counts for Routes X, sourced from IndyGo timetables"
  // Very specific — the complete phrase that Claude uses when asking for GTFS data.
  {
    pattern: /(?:provide|obtain|collect)\s+[^.]{0,80}trip\s+counts?\s+[^.]{0,80}(?:sourced?\s+from|from\s+the)\s+[^.]{0,80}(?:timetable|published\s+schedule)/i,
    description: "Customer asked to source trip counts from transit agency timetables",
  },

];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ").replace(/&#\d+;/gi, " ").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ").trim();
}

export function validateNoUnnecessaryCustomerRequests(html: string): ValidationViolation[] {
  const text       = stripHtml(html);
  const violations: ValidationViolation[] = [];
  const seen       = new Set<string>();

  for (const { pattern, description } of BLOCKING_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start   = Math.max(0, match.index - 80);
      const end     = Math.min(text.length, match.index + match[0].length + 80);
      const context = `…${text.slice(start, end).trim()}…`;
      const key     = description + "|" + match[0].slice(0, 50).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        violations.push({ description, context });
      }
      if (regex.lastIndex <= match.index) regex.lastIndex = match.index + 1;
    }
  }

  return violations;
}

// ─── Column 4 output completeness check ──────────────────────────────────────
// Verifies that every item listed in Column 4 of the automation analysis is
// represented in the stitched HTML. Uses keyword matching: extracts significant
// words from each output description and requires ≥60% to appear in the
// stripped document text. Below that threshold the output is flagged as missing.

const OUTPUT_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "are", "has",
  "have", "its", "not", "but", "all", "each", "any", "per", "via",
  "tab", "html", "file", "list", "full", "leed", "well",
]);

function outputKeywords(item: string): string[] {
  return item
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !OUTPUT_STOP_WORDS.has(w));
}

export function validateAllOutputsProduced(
  html:    string,
  outputs: string[],
): ValidationViolation[] {
  const text       = stripHtml(html).toLowerCase();
  const violations: ValidationViolation[] = [];

  for (const item of outputs) {
    const keywords = outputKeywords(item);
    if (keywords.length === 0) continue;

    const matched    = keywords.filter((kw) => text.includes(kw));
    const matchRatio = matched.length / keywords.length;

    if (matchRatio < 0.6) {
      violations.push({
        description: `Column 4 output missing from document: "${item}"`,
        context:     `Keywords checked: [${keywords.join(", ")}] — ${matched.length}/${keywords.length} matched`,
      });
    }
  }

  return violations;
}

// ─── Process narration stripping ─────────────────────────────────────────────
// Removes paragraph-level process narration from Claude-generated HTML fragments.
// The system prompt prohibits narration, but this enforces it programmatically
// so it can never appear in any delivered output regardless of model behavior.

const NARRATION_PARAGRAPH_PATTERNS: RegExp[] = [
  // First-person — reviewing, analyzing, searching
  /^I\s+(have\s+(reviewed|analyzed|gathered|retrieved|searched|checked|found|organized|compiled|completed|now|all)|will\s+(now|begin|provide|generate|compile|produce|present)|am\s+(now|going|about)|'ve\s+(reviewed|analyzed|organized|gathered|compiled|searched|retrieved|found|now)|'ll\s+(now|begin|organize|structure|present|provide|generate|compile|produce))/i,
  // "Now I have..." / "Now let me..."
  /^Now\s+(I\s+(have|can|will)|let\s+me|we\s+have)/i,
  // "Let me..."
  /^Let\s+me\s+(now\s+|begin\s+|organize\s+|present\s+|provide\s+|generate\s+|compile\s+|produce\s+|search\s+|retrieve\s+)/i,
  // "As requested"
  /^As\s+requested[,.]/i,
  // "Here is/are the..."
  /^Here\s+(is|are)\s+(the\s+)?(supporting|required|complete|full|following|compiled|organized|my)/i,
  // "Below is/are the..."
  /^Below\s+(is|are)\s+(the\s+)?(supporting|required|complete|organized|full|following|compiled)/i,
  // "The following sections/documents/content..."
  /^The\s+following\s+(sections?|documents?|content|information|analysis|output|report|data)\s+(contain|present|provide|outline|include|is|are|has|have)/i,
  // "Based on the..."
  /^Based\s+on\s+(the\s+)?(attached|provided|automation|credit|requirements?|civil|drawing|extract|information|data|above|my\s+(review|analysis|search))/i,
  // "After reviewing/analyzing/searching..."
  /^After\s+(reviewing|analyzing|searching|examining|processing|reading)/i,
  // "In this response/section/document/output..."
  /^In\s+this\s+(response|section|output|document|report|analysis)[,\s]/i,
  // "Per your instructions/request..."
  /^Per\s+your\s+(instructions?|request)[,.]/i,
  // "I'll now..." / "I'll organize..."
  /^I'll\s+(now\s+|organize\s+|structure\s+|present\s+|provide\s+|generate\s+|compile\s+|produce\s+)/i,
  // "Using the..." (when narrating tool use)
  /^Using\s+(web\s+search|the\s+(civil|drawing|extract|data|information|pdf|credit|provided))/i,
  // "I have all the information needed..."
  /^I\s+have\s+(all\s+the\s+(information|data)\s+needed|now\s+compiled|now\s+gathered|now\s+retrieved|gathered\s+all)/i,
  // "This document/report/section presents/contains/provides..."
  /^This\s+(document|report|section|output|response|analysis)\s+(presents|contains|provides|includes|outlines|covers)/i,
];

function isNarrationText(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return NARRATION_PARAGRAPH_PATTERNS.some((p) => p.test(t));
}

export function stripProcessNarration(html: string): string {
  // Strip markdown code fences wrapping HTML — Claude sometimes wraps output in ```html ... ```
  // The fence and everything outside it (raw narration) is discarded; the HTML inside is kept.
  let result = html.replace(/```(?:html|HTML)?\s*\n?([\s\S]*?)\n?```/g, (_m: string, inner: string) => inner.trim());

  // Strip raw text lines outside HTML elements that are narration.
  // Splits on newline, removes lines that are pure narration sentences.
  result = result.replace(/(?:^|(?<=>))([^<]+)(?=<|$)/gm, (_m: string, rawText: string) => {
    const lines = rawText.split(/\n/);
    const clean = lines.map((line: string) => {
      const sentences = line.split(/(?<=[.!?])\s+/);
      return sentences.filter((s: string) => !isNarrationText(s.trim())).join(" ");
    }).join("\n");
    return clean;
  });

  // Strip <p> elements whose text is pure narration
  result = result.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
    return isNarrationText(text) ? "" : match;
  });

  // Strip <div> blocks that are purely narration (no nested tags)
  result = result.replace(/<div([^>]*)>([^<]{10,600})<\/div>/gi, (match, attrs, inner) => {
    return isNarrationText(inner.trim()) ? "" : match;
  });

  // Strip raw text narration at the very start of the body (before any tag)
  // This catches cases where Claude outputs narration before the first HTML element
  result = result.replace(/^([\s\S]*?)(<(?:!DOCTYPE|html|head|body|h[1-6]|div|section|p|table|ul|ol)[^>]*>)/i, (_match: string, before: string, firstTag: string) => {
    const lines = before.split(/\n/);
    const clean = lines.filter((line: string) => !isNarrationText(line.trim())).join("\n");
    return clean + firstTag;
  });

  // Strip raw text narration immediately after <body> or after the opening wrapper
  result = result.replace(/(<body[^>]*>)([\s\S]*?)(<(?:h[1-6]|div|section|p|table)[^>]*>)/i, (_match: string, bodyTag: string, between: string, nextTag: string) => {
    const lines = between.split(/\n/);
    const clean = lines.filter((line: string) => !isNarrationText(line.trim())).join("\n");
    return bodyTag + clean + nextTag;
  });

  // Strip narration sentences embedded inline within text nodes.
  // Targets sentence-boundary narration that survives element-level stripping.
  // Operates on text between tags — splits on sentence boundaries, removes narration sentences.
  result = result.replace(/>([^<]{10,2000})</g, (_match: string, textNode: string) => {
    // Split on sentence boundaries (. ! ?) followed by whitespace or end
    const sentences = textNode.split(/(?<=[.!?])\s+/);
    const clean = sentences.filter((s: string) => !isNarrationText(s.trim())).join(" ");
    // Only substitute if something was actually removed (avoid no-op replacements)
    return clean !== textNode ? `>${clean}<` : _match;
  });

  // Collapse multiple blank lines
  return result.replace(/(\n\s*){3,}/g, "\n\n");
}

// ─── Calculator Input Guide presence check ────────────────────────────────────
// Blocks delivery when the automation analysis requires a calculator but
// the assembled HTML has no "Calculator Input Guide" heading.

export function validateCalculatorGuidePresent(html: string, creditRow: string): ValidationViolation[] {
  if (!creditRow.toLowerCase().includes("calculator")) return [];
  const text = stripHtml(html).toLowerCase();
  if (text.includes("calculator input guide")) return [];
  return [{
    description: "Calculator Input Guide missing from output",
    context:     "Automation analysis requires a calculator but the output HTML contains no 'Calculator Input Guide' heading. generateCalculatorGuide() may have been skipped or thrown.",
  }];
}

// ─── Targeted correction — no Claude call, no document rewrite ────────────────
// Surgical string replacement for known violation types.
// Preserves the full HTML document including embedded maps and tables.

export function applyTargetedCorrections(html: string, violations: ValidationViolation[]): string {
  let result = html;

  // Apply all corrections unconditionally — each regex is safe (no match = no change).
  // Previously gated on v.description content which was always a generic string.

  // Replace any [OWNER/CUSTOMER/TEAM TO CONFIRM/PROVIDE: ...] that references
  // transit schedules, trip counts, or GTFS — these are always auto-retrievable.
  result = result.replace(
    /\[(?:OWNER|CUSTOMER|TEAM)\s+TO\s+(?:CONFIRM|PROVIDE):[^\]]*(?:trip\s+counts?|directional\s+(?:trip|count)|one-direction\s+(?:trip|count)|transit\s+(?:schedule|timetable)|gtfs|weekend\s+trips?)[^\]]*\]/gi,
    "[NOTE: Trip counts retrieved from GTFS schedule data — see stop data table above]"
  );

  // Replace free-text full-phrase requests for trip counts from timetables
  result = result.replace(
    /(?:provide|obtain|collect)\s+[^.]{0,80}trip\s+counts?\s+[^.]{0,80}(?:sourced?\s+from|from\s+the)\s+[^.]{0,80}(?:timetable|published\s+schedule)[^.]*/gi,
    "See retrieved GTFS data — directional trips = weekdayDirectionalTrips per stop"
  );

  // Replace named-subject instructions asking customer to supply trip counts
  result = result.replace(
    /(?:customer|owner|project\s+team|applicant|you)\s+(?:should|must|will\s+need\s+to|needs?\s+to|is\s+required\s+to|are\s+required\s+to)\s+(?:provide|submit|obtain|collect|gather|supply)\s+[^.]*trip\s+counts?[^.]*/gi,
    "Directional trip counts calculated from retrieved GTFS data — see stop data table above."
  );

  return result;
}
