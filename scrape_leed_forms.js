/**
 * LEED v4.1 Form Schema Scraper
 * ==============================
 * Run this ONCE to build a permanent local database of all LEED v4.1 BD+C
 * form field schemas. Claude Code reads this database at runtime instead of
 * relying on training data.
 *
 * Usage:
 *   npm install playwright
 *   npx playwright install chromium
 *   node scrape_leed_forms.js
 *
 * Output:
 *   leed_v41_form_schemas.json  — one entry per credit, all fields extracted
 *   leed_v41_form_schemas_raw/  — raw JSON response per form (for debugging)
 *
 * Re-run only if USGBC updates their forms. Check usgbc.org/leed/v41 for notices.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── ALL LEED v4.1 BD+C FORM URLs (from analysis spreadsheet column M) ─────────
const FORM_URLS = [
  // INTEGRATIVE PROCESS
  { credit: 'IP Credit 1',     name: 'Integrative Process',                         url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/IP102' },

  // LOCATION & TRANSPORTATION
  { credit: 'LT Credit 1',     name: 'LEED for Neighborhood Development Location',  url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/LT101' },
  { credit: 'LT Credit 2',     name: 'Sensitive Land Protection',                   url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/LT102' },
  { credit: 'LT Credit 3',     name: 'High-Priority Site and Equitable Development',url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/LT103' },
  { credit: 'LT Credit 4',     name: 'Surrounding Density and Diverse Uses',        url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/LT104' },
  { credit: 'LT Credit 5',     name: 'Access to Quality Transit',                   url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/LT107' },
  { credit: 'LT Credit 6',     name: 'Bicycle Facilities',                          url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/LT108' },
  { credit: 'LT Credit 7',     name: 'Reduced Parking Footprint',                   url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V03/LT110' },
  { credit: 'LT Credit 8',     name: 'Electric Vehicles',                           url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/LT111' },

  // SUSTAINABLE SITES
  { credit: 'SS Prereq 1',     name: 'Construction Activity Pollution Prevention',  url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/SS101' },
  { credit: 'SS Credit 1',     name: 'Site Assessment',                             url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/SS104' },
  { credit: 'SS Credit 2',     name: 'Protect or Restore Habitat',                  url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/SS105' },
  { credit: 'SS Credit 3',     name: 'Open Space',                                  url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/SS107' },
  { credit: 'SS Credit 4',     name: 'Rainwater Management',                        url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/SS109' },
  { credit: 'SS Credit 5',     name: 'Heat Island Reduction',                       url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/SS111' },
  { credit: 'SS Credit 6',     name: 'Light Pollution Reduction',                   url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/SS113' },
  { credit: 'SS Credit 8',     name: 'Tenant Design and Construction Guidelines',   url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bCs/V01/SS115' },

  // WATER EFFICIENCY
  { credit: 'WE Prereq 1',     name: 'Outdoor Water Use Reduction',                 url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/WE101' },
  { credit: 'WE Prereq 2',     name: 'Indoor Water Use Reduction',                  url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/WE102' },
  { credit: 'WE Prereq 3',     name: 'Building-Level Water Metering',               url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/WE104' },
  { credit: 'WE Credit 1',     name: 'Outdoor Water Use Reduction (Credit)',        url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/WE101' },
  { credit: 'WE Credit 2',     name: 'Indoor Water Use Reduction (Credit)',         url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/WE102' },
  { credit: 'WE Credit 3',     name: 'Optimize Process Water Use',                  url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/WE110' },
  { credit: 'WE Credit 4',     name: 'Water Metering',                              url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/WE112' },

  // ENERGY & ATMOSPHERE
  { credit: 'EA Prereq 1',     name: 'Fundamental Commissioning and Verification',  url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EA101' },
  { credit: 'EA Prereq 2',     name: 'Minimum Energy Performance',                  url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/EA103' },
  { credit: 'EA Prereq 3',     name: 'Building-Level Energy Metering',              url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/EA106' },
  { credit: 'EA Prereq 4',     name: 'Fundamental Refrigerant Management',          url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EA109' },
  { credit: 'EA Credit 1',     name: 'Enhanced Commissioning',                      url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/EA110' },
  { credit: 'EA Credit 2',     name: 'Optimize Energy Performance',                 url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V06/EA104' },
  { credit: 'EA Credit 3',     name: 'Advanced Energy Metering',                    url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bCs/V01/EA118' },
  { credit: 'EA Credit 4',     name: 'Grid Harmonization',                          url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bCs/V02/EA129' },
  { credit: 'EA Credit 5',     name: 'Renewable Energy',                            url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/EA123' },
  { credit: 'EA Credit 6',     name: 'Enhanced Refrigerant Management',             url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V04/EA127' },

  // MATERIALS & RESOURCES
  { credit: 'MR Prereq 1',     name: 'Storage and Collection of Recyclables',       url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/MR101' },
  { credit: 'MR Credit 1',     name: 'Building Life-Cycle Impact Reduction',        url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V04/MR108' },
  { credit: 'MR Credit 2',     name: 'Environmental Product Declarations',          url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V03/MR112' },
  { credit: 'MR Credit 3',     name: 'Sourcing of Raw Materials',                   url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V03/MR114' },
  { credit: 'MR Credit 4',     name: 'Material Ingredients',                        url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V03/MR115' },
  { credit: 'MR Credit 9',     name: 'Construction and Demolition Waste Mgmt',      url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/MR123' },

  // INDOOR ENVIRONMENTAL QUALITY
  { credit: 'EQ Prereq 1',     name: 'Minimum Indoor Air Quality Performance',      url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V03/EQ101' },
  { credit: 'EQ Prereq 2',     name: 'Environmental Tobacco Smoke Control',         url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EQ106' },
  { credit: 'EQ Credit 1',     name: 'Enhanced Indoor Air Quality Strategies',      url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V03/EQ110' },
  { credit: 'EQ Credit 2',     name: 'Low-Emitting Materials',                      url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EQ112' },
  { credit: 'EQ Credit 3',     name: 'Construction IAQ Management Plan',            url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EQ113' },
  { credit: 'EQ Credit 4',     name: 'Indoor Air Quality Assessment',               url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EQ114' },
  { credit: 'EQ Credit 5',     name: 'Thermal Comfort',                             url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EQ115' },
  { credit: 'EQ Credit 6',     name: 'Interior Lighting',                           url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/EQ117' },
  { credit: 'EQ Credit 7',     name: 'Daylight',                                    url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EQ121' },
  { credit: 'EQ Credit 8',     name: 'Quality Views',                               url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/EQ123' },
  { credit: 'EQ Credit 9',     name: 'Acoustic Performance',                        url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/EQ124' },

  // INNOVATION
  { credit: 'IN Credits 1-5',  name: 'Innovation Credits',                          url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V02/IN101' },
  { credit: 'IN Credit 6',     name: 'LEED Accredited Professional',                url: 'https://leedonline-api.usgbc.org/Credit/sampleForm/v4_1.bNc/V01/IN102' },
];

// ─── FIELD EXTRACTION ──────────────────────────────────────────────────────────

/**
 * Recursively extract all fields from a form schema object.
 * LEED Online forms return nested JSON — this flattens everything into
 * a consistent array of field descriptors.
 */
function extractFields(obj, parentPath = '') {
  const fields = [];

  if (!obj || typeof obj !== 'object') return fields;

  // If it's an array, process each element
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      fields.push(...extractFields(item, `${parentPath}[${idx}]`));
    });
    return fields;
  }

  // Check if this object looks like a form field
  const isField = obj.fieldId || obj.fieldName || obj.label || obj.name || obj.type;
  if (isField) {
    fields.push({
      path:        parentPath,
      fieldId:     obj.fieldId     || obj.id          || null,
      fieldName:   obj.fieldName   || obj.name        || null,
      label:       obj.label       || obj.displayName || obj.title || null,
      type:        obj.type        || obj.fieldType   || null,
      required:    obj.required    ?? obj.isRequired  ?? null,
      options:     obj.options     || obj.choices     || obj.values || null,
      placeholder: obj.placeholder || obj.hint        || null,
      section:     obj.section     || obj.group       || obj.category || null,
      helpText:    obj.helpText    || obj.description || obj.tooltip  || null,
      validation:  obj.validation  || obj.rules       || null,
    });
  }

  // Recurse into all child properties
  for (const key of Object.keys(obj)) {
    if (['options', 'choices', 'values'].includes(key)) continue; // already captured above
    fields.push(...extractFields(obj[key], parentPath ? `${parentPath}.${key}` : key));
  }

  return fields;
}

/**
 * Deduplicate fields by fieldId, keeping the most complete entry.
 */
function deduplicateFields(fields) {
  const seen = new Map();
  for (const field of fields) {
    const key = field.fieldId || field.fieldName || field.label || field.path;
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, field);
    } else {
      // Keep the entry with more populated properties
      const existing = seen.get(key);
      const existingScore = Object.values(existing).filter(v => v !== null).length;
      const newScore      = Object.values(field).filter(v => v !== null).length;
      if (newScore > existingScore) seen.set(key, field);
    }
  }
  return Array.from(seen.values());
}

// ─── MAIN SCRAPER ──────────────────────────────────────────────────────────────

async function scrapeAllForms() {
  const RAW_DIR = path.join(__dirname, 'leed_v41_form_schemas_raw');
  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept':          'application/json, text/html, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const database = {
    metadata: {
      generated:    new Date().toISOString(),
      source:       'LEED Online API — leedonline-api.usgbc.org',
      ratingSystem: 'LEED v4.1 BD+C',
      note:         'Re-run scrape_leed_forms.js only if USGBC updates their forms. Monitor usgbc.org/leed/v41 for notices.',
      totalForms:   FORM_URLS.length,
    },
    credits: {},
  };

  console.log(`\nScraping ${FORM_URLS.length} LEED v4.1 forms...\n`);

  for (const entry of FORM_URLS) {
    console.log(`  → ${entry.credit}: ${entry.name}`);
    console.log(`    URL: ${entry.url}`);

    try {
      const page = await context.newPage();

      await page.goto(entry.url, { waitUntil: 'networkidle', timeout: 30000 });

      // Give Vue time to render the form components
      await page.waitForTimeout(3000);

      // Extract form.data and form.credit from the embedded script
      const embeddedData = await page.evaluate(() => {
        try { return { data: window.form?.data, credit: window.form?.credit, project: window.form?.project }; }
        catch { return null; }
      });

      // Extract rendered form field labels + inputs from the DOM
      const domFields = await page.evaluate(() => {
        const results = [];
        // Grab all label elements and their associated inputs
        document.querySelectorAll('label').forEach(label => {
          const text = label.innerText.trim();
          if (!text || text.length > 200) return;
          const forAttr = label.getAttribute('for');
          const input = forAttr
            ? document.getElementById(forAttr)
            : label.querySelector('input, select, textarea') ||
              label.closest('.field')?.querySelector('input, select, textarea');
          results.push({
            label:    text,
            type:     input?.type || input?.tagName?.toLowerCase() || null,
            name:     input?.name || input?.id || forAttr || null,
            required: label.closest('.required.field') !== null || input?.required || false,
            options:  input?.tagName === 'SELECT'
              ? Array.from(input.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value)
              : null,
          });
        });
        // Also capture standalone inputs/selects without labels
        document.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
          const name = el.name || el.id;
          if (!name || results.some(r => r.name === name)) return;
          results.push({
            label:    el.placeholder || el.getAttribute('aria-label') || name,
            type:     el.type || el.tagName.toLowerCase(),
            name,
            required: el.required || el.closest('.required.field') !== null,
            options:  el.tagName === 'SELECT'
              ? Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value)
              : null,
          });
        });
        return results;
      });

      const rawJson = { embeddedData, domFields };

      await page.close();

      // Save raw response for debugging
      const rawFile = path.join(RAW_DIR, `${entry.credit.replace(/\s+/g, '_')}_raw.json`);
      fs.writeFileSync(rawFile, JSON.stringify(rawJson, null, 2));

      // Extract fields: prefer DOM-scraped fields, supplement with form.data keys
      let fields = [];

      // 1. DOM fields (have labels and types)
      if (rawJson.domFields?.length) {
        fields = rawJson.domFields.map(f => ({
          path:        f.name || f.label,
          fieldId:     f.name || null,
          fieldName:   f.name || null,
          label:       f.label || null,
          type:        f.type || null,
          required:    f.required ?? null,
          options:     f.options || null,
          placeholder: null,
          section:     null,
          helpText:    null,
          validation:  null,
        }));
        fields = deduplicateFields(fields);
      }

      // 2. Supplement with form.data keys (field names not visible in DOM yet)
      if (rawJson.embeddedData?.data && typeof rawJson.embeddedData.data === 'object') {
        function flattenDataKeys(obj, prefix = '') {
          const keys = [];
          for (const [k, v] of Object.entries(obj)) {
            if (k === 'csrf_token') continue;
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
              keys.push(...flattenDataKeys(v, fullKey));
            } else {
              keys.push(fullKey);
            }
          }
          return keys;
        }
        const dataKeys = flattenDataKeys(rawJson.embeddedData.data);
        for (const key of dataKeys) {
          const shortKey = key.split('.').pop();
          if (!fields.some(f => f.fieldName === shortKey || f.fieldName === key)) {
            fields.push({
              path: key, fieldId: key, fieldName: shortKey, label: shortKey,
              type: 'unknown', required: null, options: null,
              placeholder: null, section: null, helpText: null, validation: null,
            });
          }
        }
      }

      fields = deduplicateFields(fields);

      // Categorize fields
      const teamProvides  = []; // Fields requiring project-specific input (H)
      const claudeRetrieves = []; // Fields that reference public data (I)
      const calculations  = []; // Fields that are computed/calculated (J)
      const otherFields   = [];

      for (const field of fields) {
        const label = (field.label || field.fieldName || '').toLowerCase();
        const type  = (field.type || '').toLowerCase();

        if (type === 'calculated' || type === 'formula' || label.includes('total') || label.includes('percent') || label.includes('ratio')) {
          calculations.push(field);
        } else if (label.includes('address') || label.includes('zip') || label.includes('climate zone') ||
                   label.includes('ecoregion') || label.includes('census') || label.includes('flood zone') ||
                   label.includes('transit') || label.includes('walk score') || label.includes('utility') ||
                   label.includes('emission factor') || label.includes('egrid')) {
          claudeRetrieves.push(field);
        } else if (field.required || type === 'text' || type === 'textarea' || type === 'number' ||
                   type === 'file' || type === 'upload') {
          teamProvides.push(field);
        } else {
          otherFields.push(field);
        }
      }

      database.credits[entry.credit] = {
        credit:      entry.credit,
        name:        entry.name,
        formUrl:     entry.url,
        scrapedAt:   new Date().toISOString(),
        status:      'success',
        totalFields: fields.length,
        fields: {
          all:            fields,
          teamProvides:   teamProvides,
          claudeRetrieves: claudeRetrieves,
          calculations:   calculations,
          other:          otherFields,
        },
        rawResponseKeys: rawJson ? Object.keys(rawJson) : [],
      };

      console.log(`    ✓ Extracted ${fields.length} fields (${teamProvides.length} team, ${claudeRetrieves.length} auto-retrieve, ${calculations.length} calculated)`);

    } catch (err) {
      console.log(`    ✗ ERROR: ${err.message}`);
      database.credits[entry.credit] = {
        credit:    entry.credit,
        name:      entry.name,
        formUrl:   entry.url,
        scrapedAt: new Date().toISOString(),
        status:    'error',
        error:     err.message,
        fields:    { all: [], teamProvides: [], claudeRetrieves: [], calculations: [], other: [] },
      };
    }
  }

  await browser.close();

  // Write the final database
  const OUTPUT_FILE = path.join(__dirname, 'leed_v41_form_schemas.json');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(database, null, 2));

  // Write a summary report
  const summary = {
    generated: database.metadata.generated,
    totalForms: FORM_URLS.length,
    successful: Object.values(database.credits).filter(c => c.status === 'success').length,
    failed:     Object.values(database.credits).filter(c => c.status === 'error').length,
    perCredit:  Object.fromEntries(
      Object.entries(database.credits).map(([credit, data]) => [
        credit,
        {
          status:      data.status,
          totalFields: data.totalFields || 0,
          teamFields:  data.fields?.teamProvides?.length || 0,
          autoFields:  data.fields?.claudeRetrieves?.length || 0,
          calcFields:  data.fields?.calculations?.length || 0,
          error:       data.error || null,
        }
      ])
    ),
  };

  fs.writeFileSync(
    path.join(__dirname, 'leed_v41_form_schemas_summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total forms:  ${summary.totalForms}`);
  console.log(`Successful:   ${summary.successful}`);
  console.log(`Failed:       ${summary.failed}`);
  console.log(`\nOutput files:`);
  console.log(`  leed_v41_form_schemas.json         — main database (Claude Code reads this)`);
  console.log(`  leed_v41_form_schemas_summary.json — summary report`);
  console.log(`  leed_v41_form_schemas_raw/         — raw response per form (for debugging)`);
  console.log('\nNext steps:');
  console.log('  1. Review leed_v41_form_schemas_summary.json for any failed forms');
  console.log('  2. Upload the 10 USGBC calculator Excel files to build leed_v41_calculator_schemas.json');
  console.log('  3. Point Claude Code to leed_v41_form_schemas.json instead of training data');
  console.log('='.repeat(60) + '\n');
}

// ─── RUN ───────────────────────────────────────────────────────────────────────
scrapeAllForms().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
