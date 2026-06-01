/**
 * HTML output utilities.
 *
 * injectTableCss — injects the Liminal design system stylesheet into every output.
 * makeEditable   — converts a standard output HTML file to a browser-editable
 *                  version with an instruction banner and print button.
 *
 * Both functions are safe to call on partial HTML fragments — they fall back
 * gracefully when <head> or <body> tags are absent.
 */

// ─── Liminal document stylesheet (injected into every output) ─────────────────
// This is the canonical design system. Claude uses the class names defined here;
// the pipeline guarantees the CSS is always present regardless of what Claude outputs.

const LIMINAL_CSS = `
  /* Base */
  body { font-family: Arial, Helvetica, sans-serif; color: #515062; background: #ffffff; margin: 0 20%; padding: 40px 0; box-sizing: border-box; font-size: 13px; }
  a { color: #327cb9; }
  h2 { color: #327cb9; font-size: 15px; margin: 20px 0 6px 0; }
  h3 { color: #515062; font-size: 13px; margin: 14px 0 4px 0; font-weight: bold; }
  h4 { color: #515062; font-size: 0.97em; margin: 14px 0 4px 0; }

  /* Page header */
  .page-header { background: #327cb9; color: #ffffff; padding: 22px 32px 16px 32px; }
  .page-header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: bold; color: #ffffff; }
  .page-header .sub { font-size: 13px; opacity: 0.88; }

  /* Section structure */
  .section-header { background: #327cb9; color: #ffffff; font-weight: bold; font-size: 13px; padding: 8px 14px; margin: 22px 0 0 0; border-radius: 3px 3px 0 0; }
  .section-subheader { background: #abcde8; color: #327cb9; font-weight: bold; font-size: 12px; padding: 6px 14px; margin: 14px 0 0 0; border-radius: 3px 3px 0 0; border: 1px solid #cccccc; border-bottom: none; }
  .section-body { border: 1px solid #cccccc; border-top: none; padding: 16px 18px; background: #ffffff; }
  .section-wrap { padding: 0 24px 18px 24px; }
  .meta-bar { background: #abcde8; padding: 10px 24px; font-size: 0.92em; display: flex; flex-wrap: wrap; gap: 24px; }
  .meta-bar span { font-weight: bold; color: #327cb9; }
  .form-id-bar { background: #abcde8; padding: 8px 18px; font-weight: bold; font-size: 13px; color: #327cb9; border-bottom: 2px solid #327cb9; }
  .divider { border: none; border-top: 1px solid #cccccc; margin: 18px 0; }

  /* Form fields */
  .field-row { display: flex; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
  .field-label { font-weight: bold; color: #327cb9; min-width: 220px; font-size: 12px; }
  .field-id { display: none; }
  .field-value { color: #515062; flex: 1; }
  .field-value.filled { background: #e8f0f7; border-left: 3px solid #327cb9; padding: 5px 10px; border-radius: 0 3px 3px 0; }
  .field-value.upload { background: #fff3cd; border-left: 3px solid #ffc107; padding: 5px 10px; border-radius: 0 3px 3px 0; color: #856404; }
  .owner-field { background: #fff3cd; border: 1px dashed #ffc107; border-radius: 3px; padding: 4px 10px; color: #856404; font-style: italic; display: inline-block; margin: 2px 0; }
  .radio-selected { display: inline-block; background: #327cb9; color: #fff; border-radius: 50%; width: 14px; height: 14px; text-align: center; line-height: 14px; font-size: 10px; margin-right: 6px; }
  .radio-unselected { display: inline-block; border: 2px solid #aaa; border-radius: 50%; width: 12px; height: 12px; margin-right: 6px; vertical-align: middle; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0; table-layout: fixed; word-wrap: break-word; }
  thead tr th { background: #327cb9; color: #ffffff; font-weight: bold; padding: 8px; text-align: left; border: 1px solid #cccccc; }
  tbody tr:nth-child(odd) { background: #ffffff; }
  tbody tr:nth-child(even) { background: #e8f0f7; }
  tbody tr td { padding: 7px 8px; border: 1px solid #cccccc; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; max-width: 0; }
  th { word-wrap: break-word; overflow-wrap: break-word; }
  @media print { table { page-break-inside: avoid; } }

  /* Calculation boxes */
  .calc-box { background: #f4f8fc; border: 1px solid #327cb9; border-radius: 4px; padding: 14px 18px; margin: 10px 0; font-family: monospace; font-size: 12px; color: #515062; }
  .calc-box .step { margin-bottom: 6px; }

  /* Compliance results */
  .result-pass { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .result-fail { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .result-warn { background: #fff3cd; color: #856404; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 14px; font-weight: bold; display: inline-block; margin: 6px 0; }
  .pass { color: #155724; font-weight: bold; }
  .fail { color: #721c24; font-weight: bold; }
  .point-box { background: #327cb9; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 16px; font-weight: bold; margin: 10px 0; }
  .point-box-pending { background: #856404; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 16px; font-weight: bold; margin: 10px 0; }
  .score-box { background: #327cb9; color: #fff; border-radius: 6px; padding: 14px 22px; display: inline-block; font-size: 1.1em; font-weight: bold; margin: 10px 0; }
  .compliance-threshold-box { background: #f4f8fc; border: 2px solid #327cb9; border-radius: 6px; padding: 16px 20px; margin: 14px 0; }
  .compliance-threshold-box .threshold-label { font-weight: bold; color: #327cb9; font-size: 13px; }
  .compliance-threshold-box .threshold-value { font-size: 22px; font-weight: bold; color: #515062; }
  .compliance-threshold-box .threshold-limit { font-size: 13px; color: #515062; }

  /* Notes and callouts */
  .note { background: #abcde8; border-left: 4px solid #327cb9; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }
  .info-box { background: #e8f0f7; border-left: 4px solid #327cb9; padding: 10px 16px; margin: 10px 0 16px 0; font-size: 0.93em; }
  .warn-note { background: #fff3cd; border-left: 4px solid #ffc107; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }
  .warn-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px 16px; margin: 10px 0 16px 0; font-size: 0.93em; }
  .alert-note { background: #f8d7da; border-left: 4px solid #dc3545; padding: 8px 12px; margin: 8px 0; font-size: 12px; border-radius: 0 3px 3px 0; }

  /* Submission checklist badges */
  .badge-provided { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .badge-required { background: #fff3cd; color: #856404; border: 1px solid #ffc107; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .badge-incomplete { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: bold; display: inline-block; }
  .checklist-item { border: 1px solid #cccccc; border-radius: 4px; padding: 12px 16px; margin-bottom: 10px; }
  .checklist-item h4 { margin: 0 0 4px 0; font-size: 13px; color: #327cb9; }
  .checklist-item p { margin: 3px 0; font-size: 12px; }
  .checklist-item .item-title { font-weight: bold; font-size: 0.97em; color: #327cb9; }
  .checklist-item .item-detail { font-size: 0.91em; margin-top: 4px; color: #515062; }
  ul.checklist-list { list-style: none; padding: 0; margin: 0; }
  ul.checklist-list li { padding: 4px 0; border-bottom: 1px solid #e8f0f7; font-size: 12px; }
  ul.checklist-list li:last-child { border-bottom: none; }

  /* Layout helpers */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .plan-section { border: 1px solid #cccccc; border-radius: 4px; padding: 14px 18px; margin: 12px 0; }
  .plan-section h4 { color: #327cb9; margin: 0 0 8px 0; font-size: 13px; border-bottom: 1px solid #abcde8; padding-bottom: 4px; }
  .signature-block { border: 1px solid #cccccc; border-radius: 4px; padding: 14px 18px; margin: 12px 0; background: #f9f9f9; }
  .sig-line { border-bottom: 1px solid #515062; min-width: 250px; display: inline-block; margin: 0 10px; height: 20px; }
  .processing-summary { background: #f4f8fc; border: 2px solid #327cb9; border-radius: 6px; padding: 18px 22px; margin: 24px 0; }
  .processing-summary h3 { color: #327cb9; margin: 0 0 10px 0; font-size: 14px; }
  .source-note { font-size: 10px; color: #888; font-style: italic; }
  .map-placeholder { background: #e8f0f7; border: 2px dashed #327cb9; border-radius: 6px; padding: 28px; text-align: center; color: #327cb9; font-size: 1em; margin: 14px 0; }`;

export function injectTableCss(html: string): string {
  const tag = `<style id="liminal-css">${LIMINAL_CSS}\n</style>`;
  let result = html;

  if (result.indexOf("</head>") !== -1) {
    // Full document already present — inject into <head>
    result = result.slice(0, result.indexOf("</head>")) + tag + "\n" + result.slice(result.indexOf("</head>"));
    result = result.replace(/<body([^>]*)>/i, (_match, attrs: string = "") => {
      if (attrs.toLowerCase().includes("margin")) return _match;
      return `<body${attrs} style="margin: 0 20%; padding: 40px 0; box-sizing: border-box;">`;
    });
  } else {
    // Claude output is body-content only — wrap in a full document shell
    result = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${tag}
</head>
<body style="margin: 0 20%; padding: 40px 0; box-sizing: border-box;">
${result}
</body>
</html>`;
  }

  return result;
}

// ─── Editable banner HTML ─────────────────────────────────────────────────────

const BANNER_HTML = `
<div class="liminal-edit-banner" style="background:#abcde8;color:#2b4044;padding:12px 16px;font-size:13px;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:9999;box-shadow:0 2px 4px rgba(0,0,0,0.12);">
  <span style="flex:1;">This document is editable. Click any text to edit it directly. When finished, use <strong>File &rarr; Print &rarr; Save as PDF</strong> in your browser to save your edited version. Your edits are saved on your computer only &mdash; nothing is sent to the server.</span>
  <button onclick="window.print()" style="background:#327cb9;color:white;border:none;padding:8px 16px;border-radius:4px;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit;font-weight:600;">Print to PDF</button>
</div>
<style>
  @media print {
    .liminal-edit-banner { display: none !important; }
  }
  [contenteditable="true"]:focus {
    outline: 2px solid #327cb9;
    outline-offset: 1px;
    border-radius: 2px;
    background: #f0f6fc;
  }
  [contenteditable="true"] {
    cursor: text;
    min-height: 1em;
  }
</style>`;

// ─── Tags that get contenteditable="true" ─────────────────────────────────────

const EDITABLE_TAG_RE = /^(p|td|th|h[1-6]|li)$/i;

function addContentEditable(html: string): string {
  // Match any opening tag for editable elements.
  // Replaces <tag ...> with <tag ... contenteditable="true"> if not already present.
  return html.replace(/<(p|td|th|h[1-6]|li)(\s[^>]*)?>/gi, (match, tag: string, attrs: string = "") => {
    if (attrs.toLowerCase().includes("contenteditable")) return match;
    return `<${tag}${attrs} contenteditable="true">`;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function makeEditable(html: string): string {
  // 1. Inject table CSS
  let result = injectTableCss(html);

  // 2. Add editable-element styles + banner after <body> tag
  result = result.replace(/<body([^>]*)>/i, (match) => match + "\n" + BANNER_HTML);

  // 3. Add contenteditable to block text elements
  result = addContentEditable(result);

  return result;
}
