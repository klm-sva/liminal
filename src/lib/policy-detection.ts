/**
 * src/lib/policy-detection.ts
 *
 * Shared, dependency-free policy-requirement detection — used by both the
 * server-side policy generator (pipeline/lib/policy-generator.ts) and the
 * order upload UI (_upload-client.tsx) so the two never drift out of sync.
 * No Node-only imports: safe to import from a client component.
 */

export const POLICY_PATTERNS: RegExp[] = [
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

export function isPolicyRequirement(text: string): boolean {
  return POLICY_PATTERNS.some((p) => p.test(text));
}
