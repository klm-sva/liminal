/**
 * pipeline/lib/output-cleaner.ts
 *
 * scrubNarration() — strips all process narration from generated output.
 *
 * Mandatory: must be called on every generated string before it is written
 * to any output file. writeCleanFile() enforces this as a last-resort safety
 * net and logs a warning if narration reaches the write gate uncleaned.
 *
 * Call points (every one required):
 *   - After Pass 1 HTML is received from Claude
 *   - After Pass 2 HTML is received from Claude
 *   - After any correction pass response
 *   - After stitching Part 1 + Part 2 into fullHtml
 *   - After calculator content is generated
 *   - After policy draft text is generated
 *   - After map caption text is generated
 *   - Before validateAllDeliverables() runs
 *   - Before any file is written to disk or uploaded to storage (via writeCleanFile)
 */

import * as fs from "fs";

export interface ScrubResult {
  cleaned: string;
  counts:  Record<string, number>;
  total:   number;
}

// ─── Sentence-level patterns ──────────────────────────────────────────────────
// A sentence CONTAINING any of these is removed in its entirety.

const SENTENCE_PATTERNS: Array<{ id: string; re: RegExp }> = [

  // Pattern 1 — Search / action announcements (what Claude is about to do)
  { id: "P1-ill-search",      re: /\bI'?(?:ll| will)\s+search\b/i },
  { id: "P1-let-me-search",   re: /\bLet\s+me\s+search\b/i },
  { id: "P1-searching-for",   re: /\bSearching\s+for\b/i },
  { id: "P1-ill-look-up",     re: /\bI'?(?:ll| will)\s+look\s+up\b/i },
  { id: "P1-let-look-up",     re: /\bLet\s+me\s+look\s+up\b/i },
  { id: "P1-ill-retrieve",    re: /\bI'?(?:ll| will)\s+retrieve\b/i },
  { id: "P1-ill-find",        re: /\bI'?(?:ll| will)\s+find\b/i },
  { id: "P1-now-ill",         re: /\bNow\s+I'?ll\b/i },
  { id: "P1-im-going-to",     re: /\bI'?m\s+going\s+to\b/i },
  { id: "P1-i-will-now",      re: /\bI\s+will\s+now\b/i },
  { id: "P1-first-ill",       re: /\bFirst\s+I'?ll\b/i },
  { id: "P1-next-ill",        re: /\bNext\s+I'?ll\b/i },
  // "Let me compile / generate / produce / write / create / present / provide / organize / begin"
  { id: "P1-let-me-action",   re: /\bLet\s+me\s+(?:now\s+)?(?:compile|generate|produce|write|create|present|provide|organize|structure|format|begin|complete|fill|populate|build|construct|draft)\b/i },
  // "I'll now compile / generate / produce / write / fill / complete / populate"
  { id: "P1-ill-now-action",  re: /\bI'?(?:ll| will)\s+now\s+(?:compile|generate|produce|write|create|present|provide|organize|complete|fill|populate|build|construct|draft)\b/i },

  // Pattern 3 — Process narration (completion / state announcements)
  { id: "P3-now-i-have-all",    re: /\bNow\s+I\s+have\s+(?:all\s+(?:the\s+)?(?:data|information)|everything)\b/i },
  { id: "P3-now-i-have-evth",   re: /\bNow\s+I\s+have\s+everything\b/i },
  // "I now have [comprehensive / complete / detailed / sufficient / enough / all / the data]"
  { id: "P3-i-now-have",        re: /\bI\s+now\s+have\s+(?:comprehensive|complete|detailed|sufficient|enough|all|the\s+(?:data|information|context|details|results|findings|information\s+needed|data\s+needed))\b/i },
  { id: "P3-i-have-gathered",   re: /\bI\s+have\s+(?:now\s+)?gathered\b/i },
  { id: "P3-i-have-collected",  re: /\bI\s+have\s+(?:now\s+)?collected\b/i },
  { id: "P3-i-have-retrieved",  re: /\bI\s+have\s+(?:now\s+)?retrieved\b/i },
  { id: "P3-i-have-found-all",  re: /\bI\s+have\s+found\s+all\b/i },
  { id: "P3-i-have-compiled",   re: /\bI\s+have\s+(?:now\s+)?compiled\b/i },
  { id: "P3-i-have-completed",  re: /\bI\s+have\s+(?:now\s+)?completed\b/i },
  { id: "P3-with-info-now",     re: /\bWith\s+this\s+(?:data|information|context)\s+I\s+(?:can\s+now|will\s+now|'ll\s+now)\b/i },
  { id: "P3-i-now-have-need",   re: /\bI\s+now\s+have\s+what\s+I\s+need\b/i },
  { id: "P3-i-have-what-need",  re: /\bI\s+have\s+(?:all\s+)?(?:the\s+)?(?:data|information|context|details)\s+(?:I\s+need|needed)\b/i },

  // Pattern 5 — Data retrieval currency notes inline
  { id: "P5-current-as-of",     re: /\b(?:data|information|rates?|values?|results?)\s+(?:is|are)\s+current\s+as\s+of\b/i },

  // Pattern 6 — Internal reasoning / process description
  { id: "P6-i-determined",      re: /\bI\s+determined\s+that\b/i },
  { id: "P6-i-calculated",      re: /\bI\s+calculated\b/i },
  { id: "P6-i-assessed",        re: /\bI\s+assessed\b/i },
  { id: "P6-i-evaluated",       re: /\bI\s+evaluated\b/i },
  { id: "P6-based-my-analysis", re: /\bBased\s+on\s+my\s+(?:analysis|review|search|findings|research)\b/i },
  { id: "P6-after-reviewing",   re: /\bAfter\s+(?:reviewing|analyzing|searching|examining|researching)\b/i },
  { id: "P6-i-can-now",         re: /\bI\s+can\s+now\s+(?:compile|generate|produce|write|create|complete|fill|provide|present)\b/i },
];

// ─── Block-level patterns ─────────────────────────────────────────────────────
// If a paragraph or sentence STARTS WITH this, the entire block is removed.
// Also applied per-sentence inside scrubSentencesInBlock.

const BLOCK_PATTERNS: Array<{ id: string; re: RegExp }> = [
  // Pattern 2 — Findings summaries / preambles
  { id: "P2-key-findings",      re: /^Key\s+findings?:/i },
  { id: "P2-heres-what",        re: /^Here'?s\s+what\s+I\s+found:/i },
  { id: "P2-here-are-results",  re: /^Here\s+are\s+the\s+results?:/i },
  { id: "P2-i-found-that",      re: /^I\s+found\s+that\b/i },
  { id: "P2-my-search",         re: /^My\s+search\s+returned\b/i },
  { id: "P2-search-shows",      re: /^The\s+search\s+shows?\b/i },
  { id: "P2-search-results",    re: /^Search\s+results?:/i },
  { id: "P2-based-my-search",   re: /^Based\s+on\s+my\s+search\b/i },
  // "Based on the search results / the data / this information / these findings"
  { id: "P2-based-on-the",      re: /^Based\s+on\s+(?:the\s+|these\s+|this\s+|those\s+)?(?:search\s+results?|data|information|findings?|analysis|results?|above)\b/i },
  { id: "P2-i-was-able",        re: /^I\s+was\s+able\s+to\s+find\b/i },
  { id: "P2-i-retrieved-fol",   re: /^I\s+retrieved\s+the\s+following\b/i },
  { id: "P2-with-that",         re: /^With\s+(?:that|this|these|those)\s+(?:data|information|findings?|results?|context),?\s+I\b/i },
];

// ─── Separator pattern ────────────────────────────────────────────────────────
// Lines consisting entirely of ---, ***, or === are narration dividers.
const SEPARATOR_LINE_RE = /^[ \t]*(?:-{3,}|\*{3,}|={3,})[ \t]*$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inc(counts: Record<string, number>, id: string, n = 1): void {
  counts[id] = (counts[id] ?? 0) + n;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Sentence-level scrubbing ─────────────────────────────────────────────────
// Splits a text block into sentences and removes narration sentences.
// Also applies block patterns so triggers like "Key findings:" at sentence
// start are caught even when not at paragraph start.

function scrubSentencesInBlock(block: string, counts: Record<string, number>): string {
  // Split on sentence boundaries (period, bang, or question mark followed by whitespace)
  const parts = block.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];

  for (const sentence of parts) {
    const s = sentence.trim();
    if (!s) { kept.push(sentence); continue; }

    // Block patterns applied at sentence level (sentence starts with trigger)
    const blockHit = BLOCK_PATTERNS.find(({ re }) => re.test(s));
    if (blockHit) { inc(counts, blockHit.id); continue; }

    // Sentence patterns applied to full sentence content
    const sentenceHit = SENTENCE_PATTERNS.find(({ re }) => re.test(s));
    if (sentenceHit) { inc(counts, sentenceHit.id); continue; }

    kept.push(sentence);
  }

  return kept.join(" ");
}

// ─── Plain-text processing ────────────────────────────────────────────────────

function scrubPlainText(text: string, counts: Record<string, number>): string {
  const paragraphs = text.split(/\n{2,}/);
  const cleaned: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Remove separator lines (Pattern 4)
    if (SEPARATOR_LINE_RE.test(trimmed)) {
      inc(counts, "P4-separator");
      continue;
    }

    // Block patterns — entire paragraph starts with a trigger
    const blockHit = BLOCK_PATTERNS.find(({ re }) => re.test(trimmed));
    if (blockHit) {
      inc(counts, blockHit.id);
      continue;
    }

    // Sentence-level scrubbing within paragraph
    const scrubbed = scrubSentencesInBlock(trimmed, counts);
    if (scrubbed.trim()) {
      cleaned.push(scrubbed);
    }
  }

  return cleaned.join("\n\n");
}

// ─── HTML processing ──────────────────────────────────────────────────────────

function scrubHtml(html: string, counts: Record<string, number>): string {
  let result = html;

  // 1. Strip ALL text before the first HTML tag — unconditionally.
  //    Claude frequently outputs a summary or notes before starting the HTML.
  //    None of that text belongs in the customer document regardless of content.
  const firstTagIdx = result.search(/<(?:!DOCTYPE|html|head|body|h[1-6]|div|section|p|table|style|article|ul|ol|figure)\b/i);
  if (firstTagIdx > 0) {
    const stripped = result.slice(0, firstTagIdx);
    if (stripped.trim()) {
      inc(counts, "pre-html-text-stripped");
      console.log(`  [scrub-narration] Stripped ${stripped.trim().length} chars of pre-HTML text`);
    }
    result = result.slice(firstTagIdx);
  }

  // 1b. Strip ALL text after the last HTML closing tag — unconditionally.
  const lastTagEnd = result.lastIndexOf(">");
  if (lastTagEnd !== -1 && lastTagEnd < result.length - 1) {
    const trailing = result.slice(lastTagEnd + 1);
    if (trailing.trim()) {
      inc(counts, "post-html-text-stripped");
    }
    result = result.slice(0, lastTagEnd + 1);
  }

  // 2. Remove <p> elements whose text content is entirely (or >50%) narration.
  result = result.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    const text = stripTags(inner);
    if (!text) return match;

    const sentences = text.split(/(?<=[.!?])\s+/);
    const narrationCount = sentences.filter((s) => {
      const t = s.trim();
      return (
        BLOCK_PATTERNS.some(({ re }) => re.test(t)) ||
        SENTENCE_PATTERNS.some(({ re }) => re.test(t))
      );
    }).length;

    if (narrationCount === sentences.length) {
      // Entirely narration — drop element
      inc(counts, "HTML-p-narration", narrationCount);
      return "";
    }
    if (sentences.length > 1 && narrationCount / sentences.length > 0.5) {
      // Majority narration — drop element
      inc(counts, "HTML-p-narration-partial", narrationCount);
      return "";
    }
    return match;
  });

  // 3. Remove separator lines (Pattern 4) — bare ---, ***, === on their own line
  result = result.replace(/^[ \t]*(?:-{3,}|\*{3,}|={3,})[ \t]*$/gm, () => {
    inc(counts, "P4-separator");
    return "";
  });

  // 4. Scrub narration sentences embedded in text nodes between HTML tags.
  //    This catches partial narration that survived the element-level check.
  result = result.replace(/>([^<]{5,})</g, (_m, textNode) => {
    const scrubbed = scrubSentencesInBlock(textNode, counts);
    return `>${scrubbed}<`;
  });

  // 5. Wrap bare camelCase field IDs in <span class="field-id"> so CSS hides them.
  //    Claude outputs form schema field IDs as plain text (e.g. tranServHv1yrShelter,
  //    mapPath2Docs) instead of wrapping them. This step catches any that slipped through.
  //    Pattern: lowercase-start token with 2+ uppercase-led segments and 10+ total chars.
  //    Applied only to text nodes (between tags), never inside script/style blocks.
  const FIELD_ID_RE = /\b([a-z][a-z0-9]*(?:[A-Z][a-zA-Z0-9]*){2,})\b/g;
  let inScriptOrStyle = false;
  result = result.replace(/(<(?:script|style)[^>]*>)|(<\/(?:script|style)>)|(>([^<]{3,})<)/gi,
    (match, openScriptStyle, closeScriptStyle, textNodeFull, textContent) => {
      if (openScriptStyle)  { inScriptOrStyle = true;  return match; }
      if (closeScriptStyle) { inScriptOrStyle = false; return match; }
      if (inScriptOrStyle || !textContent) return match;

      const cleaned = textContent.replace(FIELD_ID_RE, (token: string) => {
        // Only wrap tokens 10+ chars with at least 2 uppercase transitions
        if (token.length < 10) return token;
        inc(counts, "field-id-wrapped");
        return `<span class="field-id">${token}</span>`;
      });
      return `>${cleaned}<`;
    },
  );

  return result;
}

// ─── Narration detector (for validateAllDeliverables) ─────────────────────────
// Returns true if the content contains any known narration pattern.
// Used to decide whether a re-scrub and flag is needed.

export function containsNarration(content: string): boolean {
  const text = content.includes("<") ? stripTags(content) : content;
  // Check block patterns at paragraph starts
  for (const para of text.split(/\n{2,}/)) {
    const t = para.trim();
    if (BLOCK_PATTERNS.some(({ re }) => re.test(t))) return true;
    for (const s of t.split(/(?<=[.!?])\s+/)) {
      const st = s.trim();
      if (SENTENCE_PATTERNS.some(({ re }) => re.test(st))) return true;
      if (BLOCK_PATTERNS.some(({ re }) => re.test(st))) return true;
    }
  }
  return false;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function scrubNarration(input: string): ScrubResult {
  const counts: Record<string, number> = {};
  let text = input;

  // Strip markdown code fences — Claude sometimes wraps HTML in ```html...```
  let fenceCount = 0;
  text = text.replace(/^```(?:html|HTML)?\s*\n?([\s\S]*?)\n?```\s*$/gm, (_m, inner) => {
    fenceCount++;
    return inner.trim();
  });
  if (fenceCount) inc(counts, "code-fence", fenceCount);

  // Detect HTML vs plain text
  const isHtml = /<!DOCTYPE|<html\b|<body\b|<div\b|<section\b|<p\b|<table\b|<h[1-6]\b/i.test(text);

  if (isHtml) {
    text = scrubHtml(text, counts);
  } else {
    text = scrubPlainText(text, counts);
  }

  // Cleanup: collapse triple+ blank lines, trim trailing whitespace per line
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]+$/gm, "");

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total > 0) {
    console.log(`  [scrub-narration] Removed ${total} narration instance(s):`);
    for (const [id, n] of Object.entries(counts).sort()) {
      console.log(`    ${id}: ${n}`);
    }
  }

  return { cleaned: text, counts, total };
}

// ─── Assertion-enforced write helper ─────────────────────────────────────────
// Use this in place of fs.writeFileSync for all generated output files.
// Runs scrubNarration() as a safety net — logs a warning if narration reaches
// this point uncleaned (meaning it wasn't scrubbed earlier in the pipeline).

export function writeCleanFile(
  filePath: string,
  content:  string,
  label?:   string,
): ScrubResult {
  const result = scrubNarration(content);
  if (result.total > 0) {
    const tag = label ? ` [${label}]` : "";
    console.warn(
      `  ⚠ [NARRATION GATE]${tag} ${result.total} narration instance(s) reached the write gate — ` +
      `scrubNarration() must be called earlier in the pipeline`,
    );
  }
  fs.writeFileSync(filePath, result.cleaned);
  return result;
}
