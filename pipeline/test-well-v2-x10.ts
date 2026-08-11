/**
 * pipeline/test-well-v2-x10.ts
 *
 * Live test: X10 — Pest Management and Pesticide Use
 * Program: WELL v2 (Q2 2025 standard)
 *
 * Customer uploads: none provided — full draft generated from program requirements.
 *
 * Pipeline:
 *   1. Load XLSX feature row + extract requirements PDF
 *   2. Pass 1 — EPA pesticide database lookup + IPM policy draft
 *   3. Pass 2 — Supporting documentation + submission checklist
 *   4. Assemble + validate + write output files
 *
 * Run: npx ts-node pipeline/test-well-v2-x10.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs   from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { injectTableCss, makeEditable }              from "./lib/make-editable";
import { CREDIT_SUBMISSION_PROMPT }                  from "./prompts/credit-submission";
import { validateNoUnnecessaryCustomerRequests }      from "./lib/validate-output";
import { StepLogger }                                from "./lib/pipeline-utils";
import { extractPdfContent }                         from "./lib/pdf-extract";
import { scrubNarration, writeCleanFile }            from "./lib/output-cleaner";

// ─── Env ──────────────────────────────────────────────────────────────────────

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

// ─── Config ───────────────────────────────────────────────────────────────────

const DESKTOP      = "/Users/kelsey/Desktop/program automation ";
const FEATURE_PDF  = path.join(DESKTOP, "well feature files v2/materials/WELL v2 - Optimization X10 Pest Management and Pesticide Use.pdf");
const XLSX_PATH    = path.resolve(__dirname, "reference/well-v2/WELL_v2_Automation_Analysis_v4 copy.xlsx");
const OUTPUT_DIR   = path.resolve(__dirname, "output");
const SLUG         = "well-v2-x10-pest-management";
const EDITABLE_SLUG = "well-v2-x10-pest-management-editable";

const PROJECT_NAME    = "600 West Broadway";
const PROJECT_ADDRESS = "600 W Broadway, San Diego, CA 92101";
const PROJECT_OWNER   = "[Owner to Confirm]";
const PROGRAM_NAME    = "WELL v2 — Materials Concept";
const FEATURE_NAME    = "X10 — Pest Management and Pesticide Use";

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── XLSX helper ──────────────────────────────────────────────────────────────

function extractFeatureRow(): string {
  const wb    = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const hdrs  = (rows[3] as any[]).map((h: any) => String(h ?? "").replace(/\n/g, " ").trim());
  const row   = rows.slice(4).find((r: any[]) => String(r[0] ?? "").trim() === "X10");
  if (!row) throw new Error("X10 row not found in XLSX");
  const lines = [`Feature Automation Analysis — ${row[0]}: ${row[1]}`];
  for (let i = 2; i < hdrs.length; i++) {
    const v = row[i];
    if (v !== undefined && v !== "") lines.push(`  ${hdrs[i]}: ${String(v).replace(/\n/g, " | ").trim()}`);
  }
  return lines.join("\n");
}

// ─── Streaming call helper ────────────────────────────────────────────────────

async function streamCall(
  client:       Anthropic,
  label:        string,
  systemPrompt: string,
  userContent:  Anthropic.ContentBlockParam[],
  usage:        { input: number; output: number },
  maxTokens     = 32000,
): Promise<string> {
  const t0 = Date.now();
  process.stdout.write(`  ${label}: streaming`);
  let text = "", ticks = 0;

  const stream = client.messages.stream({
    model:       "claude-sonnet-4-6",
    max_tokens:  maxTokens,
    temperature: 0,
    system:      systemPrompt,
    messages:    [{ role: "user", content: userContent }],
    tools:       [WEB_SEARCH_TOOL],
  } as any);

  stream.on("text", (chunk: string) => {
    text += chunk;
    if (++ticks % 200 === 0) process.stdout.write(".");
  });

  let final: Awaited<ReturnType<typeof stream.finalMessage>>;
  try {
    final = await stream.finalMessage();
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    if (e.status === 429) {
      console.warn("\n  ⚠ Rate-limited — waiting 60 s...");
      await new Promise((r) => setTimeout(r, 60000));
      final = await stream.finalMessage();
    } else throw err;
  }

  usage.input  += final.usage.input_tokens;
  usage.output += final.usage.output_tokens;
  console.log(`\n  [${((Date.now() - t0) / 1000).toFixed(1)}s  in:${final.usage.input_tokens.toLocaleString()} out:${final.usage.output_tokens.toLocaleString()}]`);
  return text;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const t0     = Date.now();
  const usage  = { input: 0, output: 0 };
  const step   = new StepLogger();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`\nProject: ${PROJECT_NAME}`);
  console.log(`Address: ${PROJECT_ADDRESS}`);
  console.log(`Feature: ${FEATURE_NAME}`);
  console.log(`Uploads: none — full draft generated from program requirements\n`);

  // ─── [1/3] Load source documents ─────────────────────────────────────────────
  const k1 = step.start("[1/3] Loading source files — XLSX + feature requirements PDF");

  const featureRow = extractFeatureRow();
  console.log(`  ✓ Automation analysis row loaded`);

  const featurePdfExtract = await extractPdfContent(
    client, FEATURE_PDF,
    `Extract all requirements, parts, options, thresholds, scoring criteria, and IWBI/GBCI accepted verification methods from this WELL v2 feature PDF. Include every sub-part (Part 1, Option 1, Option 2), all required plan elements (a through e), all pesticide hazard screening criteria, all notification requirements, and the full list of accepted verification document types. Output as structured plain text.`,
  );
  usage.input  += featurePdfExtract.inputTokens;
  usage.output += featurePdfExtract.outputTokens;
  console.log(`  ✓ Feature requirements extracted (${Math.round(featurePdfExtract.text.length / 1024)} KB)`);

  step.complete(k1);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const sharedContext = `FEATURE: ${FEATURE_NAME}
PROGRAM: ${PROGRAM_NAME}
PROJECT NAME: ${PROJECT_NAME}
PROJECT ADDRESS: ${PROJECT_ADDRESS}
PROJECT OWNER: ${PROJECT_OWNER}
SUBMISSION DATE: ${today}

FEATURE REQUIREMENTS (from WELL v2 Feature PDF):
${featurePdfExtract.text}

FEATURE AUTOMATION ANALYSIS:
${featureRow}

CUSTOMER UPLOADS: None provided. Generate a complete draft IPM policy that includes all program requirements. The draft should be fully usable but note where project-specific operational details (e.g. specific pest control provider name, actual pesticide product list, monitoring records) need to be inserted by the project team.`;

  // ─── [2/3] Pass 1 — EPA pesticide lookup + IPM policy draft ──────────────────
  const k2 = step.start("[2/3] Pass 1 — EPA pesticide database + IPM policy draft");

  let pass1Html = await streamCall(
    client,
    "Pass 1 (policy draft + pesticide compliance)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

INSTRUCTIONS:
Generate PART 1 ONLY — the complete IPM policy draft and pesticide compliance documentation for WELL v2 X10 Pest Management and Pesticide Use.

The project team provided no uploads. Generate a complete Option 1 IPM policy draft that fully satisfies all Part 1 requirements (a through e). The policy should be specific enough to be used as-is, with placeholder brackets only where project-operational details cannot be generated (e.g. specific pest control company name, monitoring log dates).

SECTION 1 — COMPLIANCE PATHWAY SELECTION
State that the project is pursuing Option 1: Pest Management Development and Implementation.
Confirm this pathway requires a documented IPM plan meeting all elements a–e of Part 1.

SECTION 2 — PESTICIDE COMPLIANCE VERIFICATION
Use web search to retrieve:
- The EPA's current list of 25(b) minimum risk pesticides (exempt from federal registration)
- At least 5–8 example pesticide active ingredients commonly used in commercial buildings that meet one of the four hazard criteria in Part 1, Section b:
  1. SF Pesticide Hazard Screening Protocol Tier 3 (least hazardous)
  2. SF Reduced Risk Pesticide List
  3. EU Pesticides Database 'low-risk' classification
  4. WHO Class U or unclassified + EU "Approved"
- For each active ingredient found: document name, registry/list source, CAS number if available, and compliance basis
Present as an HTML table with columns: Active Ingredient | CAS No. | Compliant List | Hazard Classification | Approved Use

SECTION 3 — DRAFTED IPM POLICY (Option 1, Part 1, Elements a–e)
Draft a complete, WELL v2 X10-compliant Integrated Pest Management Policy for ${PROJECT_NAME} at ${PROJECT_ADDRESS}.

The policy must address every required element:

a. Plan Elements (all 5 required sub-elements):
   1. Roles and responsibilities — draft a clear org chart section with: Property Manager (program ownership), Facilities Manager (day-to-day implementation), licensed pest control operator (PCO) or in-house staff (application), and tenant/occupant representatives (notification contacts)
   2. Pest management objectives — include: identification protocol, monitoring schedule (minimum quarterly internal + annual professional), KPIs (e.g., zero rodent incidents, <3 ant events per quarter)
   3. Preventive design and operational measures — cover: food waste management, structural sealing (pipe penetrations, door sweeps, weather stripping), landscaping management, refuse container management, and delivery inspection protocol
   4. Pest tolerance thresholds and control strategies — provide a tiered response table: Level 1 (preventive/cultural), Level 2 (mechanical/physical), Level 3 (targeted low-hazard pesticide application); include response time commitments (e.g., 24h for rodents, 48h for insects)
   5. Monitoring records — specify record types: pest sighting log, inspection reports, pesticide application log (product name, EPA reg. number, location, date, applicator), and emergency response log

b. Pesticide restriction — state that only pesticides meeting the hazard criteria above (from Section 2) are permitted for periodic application; cross-reference the compliant active ingredients table

c. Notification provisions — draft the full notification protocol:
   - Paper and digital notification to all occupants describing pesticide use protocol
   - 24-hour advance notice to all occupants + signage posted at application site
   - Signage remains posted until 24 hours after application
   - Required notification content: pesticide name, EPA registration number, treatment location, date of application, applicator name/license number
   - Emergency application protocol (same-day notification with reason for unplanned use)

d. Annual effectiveness evaluation — include: evaluation criteria, who conducts the review, documentation requirements, and how updates are incorporated

e. Recordkeeping and availability — state that all records (plan, implementation logs, SDSs, inspection reports) are maintained on-site and made available to occupants and owners on request; specify retention period (minimum 3 years)

Format the full policy as a professional, ready-to-use HTML document with section headings, numbered sub-sections, and a signature/adoption block at the end.`,
    }],
    usage,
  );
  ({ cleaned: pass1Html } = scrubNarration(pass1Html));
  step.complete(k2);

  // ─── [3/3] Pass 2 — Supporting documentation + submission checklist ────────────
  const k3 = step.start("[3/3] Pass 2 — Supporting documentation + submission checklist");

  let pass2Html = await streamCall(
    client,
    "Pass 2 (supporting docs + checklist)",
    CREDIT_SUBMISSION_PROMPT,
    [{
      type: "text",
      text: `${sharedContext}

PART 1 OUTPUT (IPM policy draft from Pass 1):
${pass1Html.slice(0, 24000)}

INSTRUCTIONS:
Generate PART 2 and PART 3 ONLY. Begin directly with the Part 2 heading.

PART 2 — Supporting Documentation

SECTION A — WELL v2 X10 Compliance Summary
Write a brief narrative (1–2 paragraphs) confirming the compliance pathway (Option 1), summarizing the key elements of the drafted IPM policy, and explaining how the policy satisfies each of Part 1's five required elements (a–e).

SECTION B — Pesticide Notification Template
Draft a ready-to-use pesticide application notification for occupant distribution, including:
- Header: Property name, address, date
- Body: pesticide name (template field), EPA registration number (template field), treatment location (template field), scheduled date/time (template field), applicator name and license number (template field)
- Safety information: re-entry interval, any precautions for sensitive individuals
- Emergency contact information
Format as a professional HTML notice template with clearly marked fill-in fields.

SECTION C — Pesticide Application Log Template
Create a blank pesticide application log table for recordkeeping, with columns:
Date | Location Treated | Pest Target | Product Name | EPA Reg. No. | Active Ingredient | Application Method | Applicator Name | License No. | Pre-Application Notice Sent (Y/N) | Signage Posted (Y/N) | Post-Application Signage Removed Date

SECTION D — Pest Sighting Log Template
Create a blank pest monitoring/sighting log table with columns:
Date | Reported By | Location | Pest Type | Severity (1–3) | Action Taken | Follow-Up Required | Resolved Date

PART 3 — Complete Submission Checklist

Organize into:

GROUP A — PROVIDED BY LIMINAL:
List every generated item (IPM policy draft, pesticide compliance table, notification template, application log template, pest sighting log template, compliance summary narrative).
For each: state the document name, which Part 1 element it satisfies, and the IWBI-accepted verification type it represents.

GROUP B — REQUIRED FROM PROJECT TEAM:
For each item below, state exactly what is needed, which requirement it satisfies, and why it cannot be auto-generated:
- Adoption/signature of IPM policy by property manager or authorized representative
- Name and license number of the designated pest control operator (PCO) or in-house applicator
- Completed pesticide product list identifying all products currently in use and their compliance basis (cross-reference against the provided compliant active ingredients table)
- Initial pest monitoring records (at least one completed inspection report)
- Any existing pest control service contracts or GreenShield/GreenPro/EcoWise/CEPA certification documentation if pursuing Option 2 instead`,
    }],
    usage,
  );
  ({ cleaned: pass2Html } = scrubNarration(pass2Html));
  step.complete(k3);

  // ─── Assemble + validate + write ──────────────────────────────────────────────
  const kOut = step.start("[output] Assembling, validating, and writing output files");

  const combined = `${pass1Html}\n\n${pass2Html}`;
  const { cleaned: scrubbed } = scrubNarration(combined);

  const violations = validateNoUnnecessaryCustomerRequests(scrubbed);
  if (violations.length > 0) console.warn(`  ⚠ ${violations.length} validation flag(s)`);
  else console.log(`  ✓ No violations found`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const withCss      = injectTableCss(scrubbed);
  const standardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${FEATURE_NAME} — ${PROJECT_NAME}</title>
</head>
<body>
${withCss}
</body>
</html>`;
  const editableHtml = makeEditable(standardHtml);

  writeCleanFile(path.join(OUTPUT_DIR, `${SLUG}.html`),          standardHtml, SLUG);
  writeCleanFile(path.join(OUTPUT_DIR, `${EDITABLE_SLUG}.html`), editableHtml, EDITABLE_SLUG);
  console.log(`  ✓ Files written`);

  step.complete(kOut);

  const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
  const totalCost = ((usage.input / 1e6) * 3.00 + (usage.output / 1e6) * 15.00).toFixed(3);

  console.log("\n" + "═".repeat(60));
  console.log(`  Feature:  ${FEATURE_NAME}`);
  console.log(`  Project:  ${PROJECT_NAME}`);
  console.log(`  Elapsed:  ${elapsed}s`);
  console.log(`  Cost:     $${totalCost}`);
  console.log(`  Tokens:   in:${usage.input.toLocaleString()} / out:${usage.output.toLocaleString()}`);
  console.log("─".repeat(60));
  console.log(`  Output: ${OUTPUT_DIR}/`);
  console.log(`    ${SLUG}.html`);
  console.log(`    ${EDITABLE_SLUG}.html`);
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message ?? err);
  process.exit(1);
});
