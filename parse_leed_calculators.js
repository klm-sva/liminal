/**
 * LEED v4.1 Calculator Schema Parser
 * =====================================
 * Run this ONCE after downloading all 10 USGBC calculators from usgbc.org/leed/v41
 * to build a permanent local database of every input field, tab, and column.
 *
 * Usage:
 *   1. Download all 10 calculators from your USGBC account
 *   2. Place them in a folder called "calculators/" next to this script
 *   3. npm install xlsx
 *   4. node parse_leed_calculators.js
 *
 * Output:
 *   leed_v41_calculator_schemas.json — one entry per calculator, all tabs and inputs
 *
 * Re-run only if USGBC releases a new calculator version.
 */

const XLSX  = require('xlsx');
const fs    = require('fs');
const path  = require('path');

// ─── MAP CALCULATOR FILES TO CREDITS ──────────────────────────────────────────
const CALCULATORS = [
  {
    id:      'precert',
    name:    'LEED v4.1 BD+C Precertification Worksheet',
    credits: ['IP Credit 1'],
    file:    'calculators/leed_v41_bdc_precertification_worksheet.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v41-bdc-precertification-worksheet',
  },
  {
    id:      'indoor_water',
    name:    'Indoor Water Use Reduction Calculator',
    credits: ['WE Prereq 2', 'WE Credit 1', 'WE Credit 2'],
    file:    'calculators/leed_v4_indoor_water_use_reduction_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v4-indoor-water-use-reduction-calculator',
  },
  {
    id:      'min_energy',
    name:    'Minimum Energy Performance Calculator (MEPC)',
    credits: ['EA Prereq 2', 'EA Credit 2'],
    file:    'calculators/leed_v41_minimum_energy_performance_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v41-minimum-energy-performance-calculator',
  },
  {
    id:      'bpdo',
    name:    'Building Products (BPDO) Calculator',
    credits: ['MR Credit 2', 'MR Credit 3', 'MR Credit 4'],
    file:    'calculators/leed_v41_building_products_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v41-building-products-calculator',
  },
  {
    id:      'cdwaste',
    name:    'Construction and Demolition Waste Management Calculator',
    credits: ['MR Credit 9'],
    file:    'calculators/leed_v41_construction_demolition_waste_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v41-construction-and-demolition-waste-management-calculator',
  },
  {
    id:      'low_emit',
    name:    'Low-Emitting Materials Calculator',
    credits: ['EQ Credit 2'],
    file:    'calculators/leed_v41_low_emitting_materials_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v41-low-emitting-materials-calculator',
  },
  {
    id:      'daylight',
    name:    'Daylight and Quality Views Calculator',
    credits: ['EQ Credit 6', 'EQ Credit 7', 'EQ Credit 8'],
    file:    'calculators/leed_v41_daylight_and_quality_views_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v41-daylight-and-quality-views-calculator',
  },
  {
    id:      'acoustic',
    name:    'Acoustic Performance Calculator',
    credits: ['EQ Prereq 3', 'EQ Credit 9'],
    file:    'calculators/leed_v41_acoustic_performance_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v41-acoustic-performance-calculator',
  },
  {
    id:      'rainfall',
    name:    'Rainfall Events Calculator',
    credits: ['SS Credit 4'],
    file:    'calculators/leed_v41_rainfall_events_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/leed-v41-rainfall-events-calculator',
  },
  {
    id:      'iaq',
    name:    'Minimum IAQ Performance Calculator',
    credits: ['EQ Prereq 1'],
    file:    'calculators/leed_v41_minimum_iaq_performance_calculator.xlsx',
    url:     'https://www.usgbc.org/resources/minimum-indoor-air-quality-performance-calculator',
  },
];

// ─── CELL CLASSIFICATION ───────────────────────────────────────────────────────

function classifyCell(cell) {
  if (!cell) return 'empty';
  if (cell.f)  return 'formula';
  if (cell.v === null || cell.v === undefined) return 'empty';
  if (typeof cell.v === 'string' && cell.v.trim() === '') return 'empty';
  if (typeof cell.v === 'string') return 'label';
  if (typeof cell.v === 'number') return 'input';
  return 'other';
}

function categorizeField(label) {
  const lower = label.toLowerCase();
  if (lower.includes('name') || lower.includes('address') || lower.includes('project') ||
      lower.includes('owner') || lower.includes('architect') || lower.includes('engineer'))
    return 'project_info';
  if (lower.includes('area') || lower.includes('sf') || lower.includes('square feet') ||
      lower.includes('floor') || lower.includes('count') || lower.includes('number of'))
    return 'building_data';
  if (lower.includes('flow') || lower.includes('flush') || lower.includes('gpm') ||
      lower.includes('gpf') || lower.includes('fixture') || lower.includes('faucet'))
    return 'fixture_data';
  if (lower.includes('energy') || lower.includes('kbtu') || lower.includes('kwh') ||
      lower.includes('eui') || lower.includes('mmbtu') || lower.includes('therms'))
    return 'energy_data';
  if (lower.includes('material') || lower.includes('product') || lower.includes('manufacturer') ||
      lower.includes('cost') || lower.includes('epd') || lower.includes('lca'))
    return 'material_data';
  if (lower.includes('zone') || lower.includes('space') || lower.includes('room') ||
      lower.includes('occupan') || lower.includes('cfm') || lower.includes('ventil'))
    return 'space_data';
  if (lower.includes('climate') || lower.includes('weather') || lower.includes('precipitation') ||
      lower.includes('rainfall') || lower.includes('station') || lower.includes('location'))
    return 'location_data';
  if (lower.includes('reflectance') || lower.includes('sri') || lower.includes('vlt') ||
      lower.includes('glazing') || lower.includes('light') || lower.includes('illumin'))
    return 'optical_data';
  if (lower.includes('stc') || lower.includes('nc rating') || lower.includes('acoustic') ||
      lower.includes('noise') || lower.includes('reverberat') || lower.includes('db'))
    return 'acoustic_data';
  if (lower.includes('refrigerant') || lower.includes('gwp') || lower.includes('odp') ||
      lower.includes('charge') || lower.includes('hvac') || lower.includes('chiller'))
    return 'mechanical_data';
  return 'other';
}

function parseSheet(sheet, sheetName) {
  const ref = sheet['!ref'];
  if (!ref) return { inputs: [], outputs: [] };

  const range  = XLSX.utils.decode_range(ref);
  const inputs  = [];
  const outputs = [];

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const labelAddr = XLSX.utils.encode_cell({ r: R, c: C });
      const valueAddr = XLSX.utils.encode_cell({ r: R, c: C + 1 });
      const labelCell = sheet[labelAddr];
      const valueCell = sheet[valueAddr];

      if (!labelCell) continue;
      const labelType = classifyCell(labelCell);
      if (labelType !== 'label') continue;

      const fieldLabel = String(labelCell.v).trim();
      if (fieldLabel.length < 3 || fieldLabel.length > 200) continue;

      const valueType = classifyCell(valueCell);
      if (valueType === 'empty' || valueType === 'label') continue;

      const descriptor = {
        label:        fieldLabel,
        labelAddress: labelAddr,
        valueAddress: valueAddr,
        currentValue: valueCell?.v ?? null,
        isFormula:    valueType === 'formula',
        formula:      valueCell?.f ?? null,
        category:     categorizeField(fieldLabel),
        sheet:        sheetName,
        excelRow:     R + 1,
      };

      if (valueType === 'formula') {
        outputs.push(descriptor);
      } else {
        inputs.push(descriptor);
      }
    }
  }

  return { inputs, outputs };
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

function parseAllCalculators() {
  const database = {
    metadata: {
      generated:        new Date().toISOString(),
      source:           'USGBC LEED v4.1 Calculator Excel files — usgbc.org/leed/v41',
      ratingSystem:     'LEED v4.1 BD+C',
      note:             'Re-run only when USGBC releases updated calculator files.',
      totalCalculators: CALCULATORS.length,
    },
    calculators: {},
  };

  console.log(`\nParsing ${CALCULATORS.length} LEED v4.1 calculators...\n`);
  let successful = 0;
  let failed     = 0;

  for (const calc of CALCULATORS) {
    console.log(`  → ${calc.name}`);

    if (!fs.existsSync(calc.file)) {
      console.log(`    ✗ FILE NOT FOUND — download from: ${calc.url}`);
      database.calculators[calc.id] = {
        ...calc, status: 'file_not_found',
        error: `File not found. Download from: ${calc.url}`,
        tabs: {}, allInputs: [], teamMustProvide: [], claudeAutoRetrieves: [],
      };
      failed++;
      continue;
    }

    try {
      const workbook = XLSX.readFile(calc.file, { cellFormula: true, cellNF: true });
      const tabs     = {};
      let totalInputs  = 0;
      let totalOutputs = 0;

      for (const sheetName of workbook.SheetNames) {
        const parsed = parseSheet(workbook.Sheets[sheetName], sheetName);
        totalInputs  += parsed.inputs.length;
        totalOutputs += parsed.outputs.length;
        tabs[sheetName] = {
          sheetName,
          inputCount:  parsed.inputs.length,
          outputCount: parsed.outputs.length,
          inputs:      parsed.inputs,
          outputs:     parsed.outputs,
          inputsByCategory: parsed.inputs.reduce((acc, f) => {
            if (!acc[f.category]) acc[f.category] = [];
            acc[f.category].push(f);
            return acc;
          }, {}),
        };
        console.log(`    ✓ "${sheetName}": ${parsed.inputs.length} inputs, ${parsed.outputs.length} outputs`);
      }

      const allInputs = Object.values(tabs).flatMap(t => t.inputs);

      database.calculators[calc.id] = {
        id:          calc.id,
        name:        calc.name,
        credits:     calc.credits,
        sourceUrl:   calc.url,
        parsedAt:    new Date().toISOString(),
        status:      'success',
        totalTabs:   workbook.SheetNames.length,
        tabNames:    workbook.SheetNames,
        totalInputs,
        totalOutputs,
        tabs,
        allInputs,
        teamMustProvide: allInputs.filter(f =>
          ['building_data','fixture_data','material_data','mechanical_data',
           'space_data','acoustic_data','optical_data'].includes(f.category)
        ),
        claudeAutoRetrieves: allInputs.filter(f =>
          ['location_data','energy_data','project_info'].includes(f.category)
        ),
      };

      successful++;

    } catch (err) {
      console.log(`    ✗ ERROR: ${err.message}`);
      database.calculators[calc.id] = {
        id: calc.id, name: calc.name, credits: calc.credits,
        status: 'error', error: err.message, tabs: {},
        allInputs: [], teamMustProvide: [], claudeAutoRetrieves: [],
      };
      failed++;
    }
  }

  fs.writeFileSync('leed_v41_calculator_schemas.json', JSON.stringify(database, null, 2));

  const summary = {
    generated: database.metadata.generated,
    totalCalcs: CALCULATORS.length,
    successful,
    failed,
    perCalculator: Object.fromEntries(
      Object.entries(database.calculators).map(([id, d]) => [id, {
        name:        d.name,
        credits:     d.credits,
        status:      d.status,
        tabs:        d.tabNames || [],
        totalInputs: d.totalInputs  || 0,
        teamInputs:  d.teamMustProvide?.length   || 0,
        autoInputs:  d.claudeAutoRetrieves?.length || 0,
        error:       d.error || null,
      }])
    ),
  };

  fs.writeFileSync('leed_v41_calculator_schemas_summary.json', JSON.stringify(summary, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`DONE — ${successful} parsed, ${failed} failed`);
  console.log('Output: leed_v41_calculator_schemas.json');
  if (failed > 0) {
    console.log('\nMissing files — download and place in calculators/ folder:');
    Object.values(database.calculators)
      .filter(c => c.status !== 'success')
      .forEach(c => console.log(`  • ${c.name}\n    ${c.sourceUrl || c.error}`));
  }
  console.log('='.repeat(60) + '\n');
}

parseAllCalculators();
