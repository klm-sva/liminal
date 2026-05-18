/**
 * HTML output utilities.
 *
 * injectTableCss — adds responsive table CSS to any HTML file.
 * makeEditable   — converts a standard output HTML file to a browser-editable
 *                  version with an instruction banner and print button.
 *
 * Both functions are safe to call on partial HTML fragments — they fall back
 * gracefully when <head> or <body> tags are absent.
 */

// ─── Table CSS (injected into every output — standard and editable) ───────────

const TABLE_CSS = `
table {
  max-width: 100%;
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  word-wrap: break-word;
}
td, th {
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 0;
}
@media print {
  table {
    max-width: 100%;
    page-break-inside: avoid;
  }
  td, th {
    word-wrap: break-word;
  }
}`;

export function injectTableCss(html: string): string {
  const tag = `<style id="liminal-table-css">${TABLE_CSS}\n</style>`;
  // Inject table CSS into <head>
  let result = html;
  const headIdx = result.indexOf("</head>");
  if (headIdx !== -1) {
    result = result.slice(0, headIdx) + tag + "\n" + result.slice(headIdx);
  } else {
    result = tag + "\n" + result;
  }
  // Apply side margins to <body>
  result = result.replace(/<body([^>]*)>/i, (_match, attrs: string = "") => {
    if (attrs.toLowerCase().includes("margin")) return _match;
    return `<body${attrs} style="margin: 0 20%; padding: 40px 0; box-sizing: border-box;">`;
  });
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
