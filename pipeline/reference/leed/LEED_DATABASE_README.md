# LEED v4.1 Form & Calculator Database
## Architecture Guide for Claude Code

---

## The Problem This Solves

Claude Code cannot fetch LEED Online form URLs directly (`leedonline-api.usgbc.org`).
If Claude Code reads those URLs and gets nothing, it falls back to training data —
which may include LEED v4, v3, or other versions. This produces inaccurate field
mappings that will cause GBCI review failures.

**This database is the fix.** It is scraped once from the live public forms and
calculator files, stored permanently here, and Claude Code reads it at runtime.
No training data. No guessing. No version ambiguity.

---

## Files in This System

```
leed_v41_form_schemas.json          ← PRIMARY: all form fields per credit (from live scrape)
leed_v41_calculator_schemas.json    ← PRIMARY: all calculator inputs per tab (from Excel parse)
leed_v41_form_schemas_summary.json  ← QA: scrape results per form
leed_v41_calculator_schemas_summary.json ← QA: parse results per calculator
leed_v41_form_schemas_raw/          ← DEBUG: raw JSON response per form
LEED_v41_BDC_Automation_Analysis_v*.xlsx ← ROUTING: which form/calc per credit + H/I/J/K
```

---

## How Claude Code Uses This System

### Step 1 — Load the databases at session start
```javascript
const formSchemas = JSON.parse(fs.readFileSync('leed_v41_form_schemas.json'));
const calcSchemas = JSON.parse(fs.readFileSync('leed_v41_calculator_schemas.json'));
```

### Step 2 — Read the analysis spreadsheet for routing
The spreadsheet tells Claude Code:
- **Column H**: What the project team must provide (upload to Claude Code)
- **Column I**: What Claude Code retrieves automatically from public sources
- **Column J**: What Claude Code produces as output
- **Column K**: What GBCI receives and reviews
- **Column M**: Which form schema to look up in `leed_v41_form_schemas.json`
- **Column N**: Which calculator schema to look up in `leed_v41_calculator_schemas.json`

### Step 3 — Look up the form schema by credit
```javascript
const credit = 'WE Prereq 2';
const formSchema = formSchemas.credits[credit];
const fields = formSchema.fields.all;
// fields contains every field ID, label, type, required status, options
```

### Step 4 — Look up the calculator schema by credit
```javascript
const calcSchema = calcSchemas.calculators['indoor_water']; // id from calculator schemas
const teamInputs = calcSchema.teamMustProvide;   // fields team provides
const autoInputs = calcSchema.claudeAutoRetrieves; // fields Claude retrieves
```

### Step 5 — Collect data and fill form fields
Claude Code collects data per column H (team) and column I (auto-retrieve),
then maps it to the exact field IDs from the form schema.

---

## Maintenance (Human Step Only)

**When to re-run `scrape_leed_forms.js`:**
- USGBC announces a form version update on usgbc.org/leed/v41
- A credit form returns unexpected fields or missing fields during a project
- USGBC releases a new addendum to LEED v4.1

**When to re-run `parse_leed_calculators.js`:**
- USGBC releases an updated calculator Excel file
- A calculator tab or column structure changes

**How often does this happen?**
USGBC updates LEED v4.1 forms 1-2 times per year at most.
The calculators are updated even less frequently.
Monitor: https://www.usgbc.org/leed/v41

---

## Setup Instructions (One Time Only)

### Forms database:
```bash
npm install playwright
npx playwright install chromium
node scrape_leed_forms.js
```

### Calculator database:
```bash
# 1. Download all 10 calculators from usgbc.org/leed/v41 into a folder called calculators/
# 2. Then run:
npm install xlsx
node parse_leed_calculators.js
```

---

## QA and Transparency

After each project run, Claude Code should log:
- Which form fields were filled from the database vs. flagged as missing
- Which calculator inputs came from team uploads vs. auto-retrieved
- Any fields in the live form that don't match the database (triggers re-scrape)

This gives you a full audit trail for QA.

---

## What Claude Code Must NEVER Do

- Read a LEED Online form URL and assume it received valid data if the response is empty or 403
- Fall back to training data for form field names or calculator inputs
- Use field names from LEED v4 forms for LEED v4.1 submissions
- Skip the database lookup and hardcode field mappings

---

## Source URLs for Reference

| Calculator | URL |
|---|---|
| Precertification Worksheet | https://www.usgbc.org/resources/leed-v41-bdc-precertification-worksheet |
| Indoor Water Use Reduction | https://www.usgbc.org/resources/leed-v4-indoor-water-use-reduction-calculator |
| Minimum Energy Performance | https://www.usgbc.org/resources/leed-v41-minimum-energy-performance-calculator |
| Building Products (BPDO) | https://www.usgbc.org/resources/leed-v41-building-products-calculator |
| C&D Waste Management | https://www.usgbc.org/resources/leed-v41-construction-and-demolition-waste-management-calculator |
| Low-Emitting Materials | https://www.usgbc.org/resources/leed-v41-low-emitting-materials-calculator |
| Daylight & Quality Views | https://www.usgbc.org/resources/leed-v41-daylight-and-quality-views-calculator |
| Acoustic Performance | https://www.usgbc.org/resources/leed-v41-acoustic-performance-calculator |
| Rainfall Events | https://www.usgbc.org/resources/leed-v41-rainfall-events-calculator |
| Minimum IAQ Performance | https://www.usgbc.org/resources/minimum-indoor-air-quality-performance-calculator |
