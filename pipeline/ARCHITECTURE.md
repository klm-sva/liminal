# Liminal Pipeline Architecture

## Universal Credit Pipeline Pattern

Every credit entry point MUST follow this exact pattern. No exceptions.

```
[1] Load + extract        — XLSX row, geocode, PDF pre-extraction (Sonnet, cached)
[2] Pass 1a               — Claude + web search → structured JSON only. No HTML.
[3] Map generation        — Google Maps Static API → base64 PNG (if credit requires map)
[4] Pass 1b (TEMPLATE)    — JavaScript renders JSON → full form HTML. ZERO AI TOKENS.
[5] Pass 2                — Claude receives compact JSON summary → supporting docs + checklist
[6] Assemble + validate   — stripProcessNarration, validateNoUnnecessaryCustomerRequests
[7] Write output          — standard HTML + editable HTML
```

## Why this pattern is mandatory

**Pass 1b must be a template render, never a Claude call.**

LEED Online forms are fixed by USGBC. Every project submitting a given credit fills out
the same fields. Only the data changes. Asking Claude to write the HTML form costs
$1–3 per run in tokens. A JavaScript template renders it in milliseconds for free.
This saving applies to every customer, every run, permanently.

**Pass 2 must receive compact JSON, never Pass 1b HTML.**

Sending the full Pass 1b HTML to Pass 2 inflates input tokens by 50–100K per run.
Pass 2 only needs the data — not the rendered form. Always pass the compact JSON
object from Pass 1a (not the rendered HTML) as Pass 2's data context.

## File structure for each credit

```
pipeline/
  test-lt-[credit-name].ts          — entry point, follows 7-step pattern above
  lib/
    lt-[credit-name]-template.ts    — Pass 1b template render function
```

## Pass 1a JSON contract

Pass 1a must return a typed JSON object that:
- Contains every field the template needs to render the complete form
- Contains every field Pass 2 needs to write supporting documentation
- Never contains rendered HTML — structured data only

The JSON interface must be defined and exported from the template file so the
entry point and template share the same type.

## Pass 2 data block

Pass 2 receives:
1. The compact Pass 1a JSON (not the rendered HTML)
2. The credit requirements PDF extract
3. The credit row from the automation analysis XLSX
4. Project data (address, program, credit name)

Pass 2 generates:
- Part 2: Supporting Project Documentation (Section A — retrieved data, Section B — generated outputs)
- Part 3: Complete Submission Checklist (Group A — provided by Liminal, Group B — required from project team)

## Template render function signature

Every template file exports a render function with this signature:

```typescript
export function render[CreditCode]Form(data: [CreditCode]FormData, mapHtml: string): string
```

Where `mapHtml` is either a base64 PNG `<img>` tag (real map) or the fallback note.
The function returns a complete HTML document string.

## Cost targets per credit

| Step              | Target tokens  | Notes                              |
|-------------------|----------------|------------------------------------|
| PDF extraction    | ~15K in/5K out | Sonnet, cached after first run     |
| Pass 1a           | ~250K in/8K out| Web search + JSON return           |
| Pass 1b           | 0              | Template render — zero AI tokens   |
| Map generation    | 0              | Google Maps API — zero AI tokens   |
| Pass 2            | ~30K in/20K out| Compact JSON context               |

Total target: ~$0.50–1.00 per credit run.

## Checklist for new credit entry points

Before committing a new credit test runner, verify:
- [ ] Pass 1a returns structured JSON (not HTML)
- [ ] Pass 1b is a template render function (zero AI tokens)
- [ ] Pass 2 receives compact JSON (not Pass 1b HTML)
- [ ] `stripProcessNarration` applied to full assembled document
- [ ] `validateNoUnnecessaryCustomerRequests` called on assembled document
- [ ] Both standard and editable HTML files written
- [ ] GBCI verification spec hardcoded in runner (until v8 XLSX uploaded)
