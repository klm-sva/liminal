# Liminal — Project Brief

**Last updated:** 2026-04-22  
**Status:** Active development — pilot phase

---

## What It Is

Liminal is a SaaS platform that automates the creation of certification documentation for green building programs (LEED BD+C v4.1, WELL v2, WELL Health-Safety Rating). Customers purchase per-credit documentation packages; an AI pipeline generates compliance narratives, pre-filled forms, and completed calculators as Word + HTML outputs.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS with custom design tokens |
| Database | Supabase (PostgreSQL with RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage (3 private buckets) |
| File uploads | UploadThing |
| Payments | Stripe (PaymentIntents) |
| Email | Resend |
| Fonts | DM Serif Display (headings) + DM Sans (body) via next/font/google |
| Deployment | (TBD) |

---

## Design System

### Color Tokens

| Tailwind Token | Hex | Usage |
|---|---|---|
| `certify-blue` | `#388fa6` | Primary CTA, links, focus rings |
| `certify-teal` | `#1c5e70` | Dark hover state, accents |
| `certify-navy` | `#12424a` | Hero background, email header, footer |
| `certify-deep` | `#2b4044` | Primary dark text |
| `certify-dark-grey` | `#515062` | Secondary text |
| `certify-cool-grey` | `#797691` | Muted text, placeholders |
| `certify-light` | `#abcde8` | Light blue accents |
| `certify-medium` | `#327cb9` | Medium blue (occasional) |
| `certify-white` | `#e8e5e0` | Off-white — page backgrounds, card borders, input backgrounds |
| `certify-beige` | `#f2e8d1` | Alternate section background (warmer) |
| `certify-sage` | `#a3bfa1` | Success, WELL v2 accent, positive states |
| `certify-sand` | `#edc299` | Warning, WELL HSR accent, pilot notes |

### Program Accent Colors

| Program | Text | Background | Border |
|---|---|---|---|
| LEED BD+C v4.1 | `#388fa6` | `#388fa615` | `#388fa630` |
| WELL v2 | `#a3bfa1` | `#a3bfa115` | `#a3bfa130` |
| WELL Health-Safety | `#edc299` | `#edc29915` | `#edc29930` |

### Order Status Colors

| Status | Label | Color | Background |
|---|---|---|---|
| `pending_upload` | Awaiting Upload | `#edc299` | `#edc29915` |
| `processing` | Processing | `#388fa6` | `#388fa615` |
| `delivered` | Delivered | `#a3bfa1` | `#a3bfa115` |
| `failed` | Failed | `#d97b6c` | `#d97b6c15` |

### Typography

- **Headings:** DM Serif Display — `font-serif` — used for all `<h1>`, `<h2>`, section headings, card titles, logotype
- **Body:** DM Sans — `font-sans` — used for all labels, body text, UI copy
- **CSS variable:** `var(--font-dm-serif)` for inline style overrides

### Spacing & Shape

- **Pill buttons:** `border-radius: 100px`
- **Cards:** `border-radius: 14px` (Tailwind `rounded-2xl`), `border: 1px solid rgba(43,64,68,0.1)`, `background: #faf8f4` or `#ffffff`
- **Card shadow:** `shadow-card` (light drop shadow)
- **Inputs:** `rounded-xl`, `bg-certify-white`, `border border-certify-white`, focus: `border-certify-blue ring-2 ring-certify-blue/15`
- **Section max-width:** `max-w-7xl` (marketing), `max-w-5xl` / `max-w-2xl` (dashboard)

### Hero / Dark Section Gradient

```
linear-gradient(160deg, #112a3f 0%, #12424a 50%, #1c5e70 100%)
```

### Nav / Pilot Banner Gradient

```
linear-gradient(90deg, #1c5e70, #388fa6)
```

---

## Database Schema

Migration file: `supabase/migrations/0002_platform_schema.sql`

### Enums

```sql
program_type:    leed_bdc_v41 | well_v2 | well_hsr
automation_type: full | partial | none
order_status:    pending_upload | processing | delivered | failed
run_status:      pending | processing | completed | failed
```

### Tables

#### `customers`
Linked 1:1 to `auth.users`. Auto-created on signup via trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = auth.users.id |
| `email` | text unique | |
| `name` | text | |
| `organization` | text | |
| `created_at` | timestamptz | |

#### `credits`
Immutable product catalog. Admin-populated only. Never written by customers.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `program` | program_type | |
| `category` | text | e.g. "Location & Transportation" |
| `credit_code` | text | e.g. "LTc5", "A01", "SC1" |
| `credit_name` | text | |
| `points_available` | integer nullable | null for non-point programs |
| `automation_type` | automation_type | full / partial / none |
| `requirements_pdf_path` | text | Path in credit-requirements bucket |
| `has_leed_form` | boolean | LEED only |
| `leed_form_link` | text nullable | URL to LEED Online form page |
| `has_calculator` | boolean | LEED only |
| `calculator_path` | text nullable | Path in credit-requirements bucket |
| `well_verification_row` | integer nullable | 1-based row in verification-requirements.xlsx |
| `prompt_text` | text | Injected verbatim into AI call |
| `required_customer_documents` | text[] | Human-readable list of required uploads |
| `deliverable_description` | text | What customer receives on completion |
| `partial_notes` | text nullable | Explains non-automatable portions |
| `price` | integer | In US cents |
| `is_active` | boolean | |

Constraints: LEED fields null-enforced for non-LEED; WELL row null-enforced for non-WELL; `calculator_path` required when `has_calculator = true`; price > 0.

#### `projects`
A customer's building project — the anchor for all orders.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` | uuid FK → customers | |
| `name` | text | |
| `address` | text nullable | |
| `gross_sqft` | integer nullable | |
| `stories` | integer nullable | |
| `building_type` | text nullable | |
| `occupancy` | text nullable | |
| `description` | text nullable | |
| `programs` | program_type[] | |
| `certification_target` | text nullable | e.g. "Gold" |
| `auto_extracted` | boolean | True if info was extracted from uploaded drawings |
| `flagged_fields` | text[] | Fields that need manual review after auto-extraction |

#### `orders`
One row per (project × credit) purchase. Max 3 AI runs each.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → projects | |
| `customer_id` | uuid FK → customers | |
| `credit_id` | uuid FK → credits | |
| `status` | order_status | Default: pending_upload |
| `runs_used` | integer | Auto-incremented by trigger |
| `runs_remaining` | integer | Auto-decremented by trigger; starts at 3 |
| `payment_id` | text nullable | Stripe PaymentIntent ID |
| `delivered_at` | timestamptz nullable | Set when status → delivered |

Constraints: `runs_used + runs_remaining ≤ 3`; `delivered_at` only set when `status = delivered`.

#### `runs`
One row per AI processing attempt within an order.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid FK → orders | |
| `run_number` | integer | 1–3; unique per order |
| `customer_upload_paths` | text[] | Paths in customer-uploads bucket; deleted after delivery |
| `output_docx_path` | text nullable | Path in order-outputs bucket |
| `output_html_path` | text nullable | Path in order-outputs bucket |
| `output_form_path` | text nullable | LEED form answers (LEED credits only) |
| `output_calculator_path` | text nullable | Completed calculator (LEED credits with calculator) |
| `status` | run_status | |
| `error_message` | text nullable | |
| `completed_at` | timestamptz nullable | |

#### `cleanup_queue`
Auto-populated when an order is delivered. Drained by Edge Function.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid FK → orders | |
| `file_paths` | text[] | Upload paths to delete |
| `queued_at` | timestamptz | |
| `processed` | boolean | |
| `processed_at` | timestamptz nullable | |

### Database Triggers

| Trigger | Event | Action |
|---|---|---|
| `on_auth_user_created` | INSERT on auth.users | Creates customers row |
| `on_run_inserted` | INSERT on runs | Decrements orders.runs_remaining, increments runs_used |
| `on_run_status_updated` | UPDATE status on runs | Advances order to delivered (on completed) or failed (on failed) |
| `on_order_delivered_enqueue_cleanup` | UPDATE status on orders | When → delivered, collects all customer_upload_paths from runs and inserts into cleanup_queue |

### Row Level Security

| Table | Policy |
|---|---|
| customers | Own row only |
| credits | Public read of active credits; service role writes |
| projects | Own projects (by customer_id) |
| orders | Own orders (by customer_id) |
| runs | Read own via order join; service role inserts/updates |
| cleanup_queue | Service role only (no customer policies) |

---

## Storage Buckets

### `credit-requirements` — PRIVATE (service role only)

Stores all AI pipeline source files. Never accessible from the browser.

```
/leed/{category}/{credit_code}/requirements.pdf
/leed/{category}/{credit_code}/calculator.xlsx       (where applicable)
/well-v2/{concept}/{feature_code}/requirements.pdf
/well-hsr/{category}/{feature_code}/requirements.pdf
/well-v2/verification-requirements.xlsx
/well-hsr/verification-requirements.xlsx
```

- Max file size: 100 MB
- Allowed types: PDF, XLSX, XLS

### `customer-uploads` — PRIVATE (customer writes own folder)

Temporary storage for customer-submitted evidence files. Auto-deleted after delivery.

```
/{customer_id}/{order_id}/{filename}
```

- Max file size: 50 MB
- Allowed types: PDF, PNG, JPEG, WEBP, DOCX, DOC, XLSX
- RLS: `(storage.foldername(name))[1] = auth.uid()::text` for insert, select, delete

### `order-outputs` — PRIVATE (customer reads own folder)

Permanent storage for AI-generated deliverables.

```
/{customer_id}/{order_id}/{run_number}/{filename}
```

- Max file size: 100 MB
- Allowed types: DOCX, HTML, PDF, XLSX
- RLS: `(storage.foldername(name))[1] = auth.uid()::text` for select

---

## AI Pipeline

Implementation: `src/lib/pipeline/process-order.ts` → `assemblePipelineContext()`

**Isolation rule (critical):** For each run, only these files are sent to the AI:
1. `credits.requirements_pdf_path` — from credit-requirements bucket
2. `credits.calculator_path` (if `has_calculator = true`) — from credit-requirements bucket
3. WELL verification Excel row (if `well_verification_row` is set) — from credit-requirements bucket
4. `runs.customer_upload_paths` — from customer-uploads bucket

No cross-credit files. No training data. No other context.

**WELL verification:** The full Excel is attached; the prompt specifies the exact 1-based row index.  
**LEED forms:** `credits.leed_form_link` is a URL reference (not a stored file); AI pre-populates form answers in the narrative.

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/orders/[orderId]/run` | POST | Creates a new run (validates ownership + 3-run cap) |
| `/api/admin/cleanup` | POST | Triggers Edge Function to delete customer uploads |
| `/api/webhooks/stripe` | POST | Stripe payment webhook |
| `/api/uploadthing` | POST | UploadThing file upload handler |

**Edge Function:** `supabase/functions/delete-customer-uploads/index.ts`  
Drains cleanup_queue, deletes files from customer-uploads in batches of 10.

---

## 28 Screens

### Route Map

```
(marketing)/
  /                          → Homepage
  /about                     → About / Who we are
  /how-it-works              → How it works
  /pricing                   → Pricing

(auth)/
  /login                     → Login
  /signup                    → Sign up
  /confirm                   → Email confirmation

(dashboard)/
  /dashboard                 → Main dashboard (project list)
  /projects/new              → Create new project
  /projects/[id]             → Project detail + orders list + gap analysis
  /projects/[id]/created     → Post-upload project creation confirmation
  /projects/[id]/edit        → Edit project details
  /projects/[id]/add-service → Browse credits for this project (shop)
  /orders/new/select-project → Order flow: step 1 — select project
  /orders/new/program        → Order flow: step 2 — select program
  /orders/new/credit         → Order flow: step 3 — browse credits
  /orders/new/credit/[id]    → Order flow: step 3b — credit detail
  /orders/new/documents      → Order flow: step 4 — document requirements info
  /orders/new/payment        → Order flow: step 5 — payment
  /orders/[orderId]/upload   → Post-purchase: upload documents
  /orders/[orderId]/processing → Processing status / waiting screen
  /orders/[orderId]/delivery → Delivery: download outputs (email-style layout)
  /orders/gap-analysis       → Gap analysis: purchase flow start
  /orders/gap-analysis/energy → Gap analysis: energy inputs
  /orders/gap-analysis/documents → Gap analysis: document upload
  /orders/gap-analysis/output → Gap analysis: results / report view
  /feedback                  → Pilot feedback form
```

### Screen Descriptions

#### SCREEN 1 — Homepage `/`
Public marketing homepage. Five sections:
- **Pilot banner:** Teal gradient strip — "Pilot program open — introductory pricing in effect"
- **Navbar:** Sticky, warm beige (`#f2e8d1`), gradient logo circle, centered desktop nav links (Who we are / How it works / Pricing), pill CTA "Join the pilot"
- **Hero:** Dark teal gradient, sage eyebrow badge, DM Serif headline, light blue subtext, two pill CTA buttons (primary sage, secondary ghost), 16:9 video placeholder
- **Trust band:** Continues dark gradient, 4 stats with vertical dividers (3 Programs / 200+ Credits / 3 Runs per order / 24hr Turnaround). Numbers in DM Serif sage, labels in light blue
- **How it works:** Warm beige (`#f2e8d1`), 2×2 grid of white cards (Upload drawings → AI extracts data → Order credits → Download outputs)
- **Programs band:** Teal-to-sage gradient, two-column — left: list of supported programs; right: feature highlights
- **Transparency band:** Off-white, 3 cards describing what AI does vs. what human review requires (color-coded badge per type: full/partial/none)

#### SCREEN 2 — About `/about`
Marketing page. Who the team is, why they built Liminal, mission statement.

#### SCREEN 3 — How It Works `/how-it-works`
Marketing page. Detailed walkthrough of the full customer workflow with diagrams.

#### SCREEN 4 — Pricing `/pricing`
Marketing page. Credit pricing table, program tiers, pilot pricing callout.

#### SCREEN 5 — Login `/login`
Auth screen. Email + password form. Link to signup. Supabase auth integration.

#### SCREEN 6 — Sign Up `/signup`
Auth screen. Name, email, password. Organization field optional. On submit: Supabase signup + triggers customer row creation. Sends confirmation email.

#### SCREEN 7 — Email Confirmation `/confirm`
Auth screen. Handles Supabase email confirmation token. Redirects to dashboard on success.

#### SCREEN 8 — Dashboard (empty state) `/dashboard?demo=empty`
First-time user state. Two cards: "Create a project" (blue) and "Buy a service" (sage). Serif heading "No projects yet". Note explaining auto-project creation.

#### SCREEN 9 — Dashboard (with projects) `/dashboard`
Main authenticated hub. Dark teal header with 4 metric chips (Projects / Services Ordered / Delivered / In Progress). Project cards in responsive grid — each card has: color-coded top accent bar, project name + address, program chips, target level, progress bar (complete/total), recent order status pills. "New Project" and "New Order" header buttons. Add-project dashed card at end of grid.

#### SCREEN 10 — New Project `/projects/new`
Two-mode form with toggle: "Upload drawings" (drag-and-drop PDF/DWG/DXF, AI extracts data) or "Enter manually" (name, address, sqft, stories, building type, occupancy). Below: certification programs multi-select (LEED BD+C v4.1, WELL v2, WELL Health-Safety). Conditional target level dropdown when single program selected. Submit: "Upload & Extract Data" or "Create Project".

#### SCREEN 11 — Project Created (post-upload) `/projects/[id]/created`
Confirmation screen after drawing upload and AI extraction. Shows what was extracted, flags fields that need review, prompts user to check project details. CTA to edit project or proceed to add services.

#### SCREEN 12 — Project Detail `/projects/[id]`
Per-project hub. Header: project name, address, 4 metrics (Services Ordered / Delivered / In Progress / Sq Ft), Edit + Add Service buttons. Program chips + target level. Gap analysis card (dark teal gradient, if purchased) showing overall score, LEED category bar chart, recommended credits, download + order buttons. Services table with credit code, name, program chip, date, status badge, runs remaining, and View/Upload action link.

#### SCREEN 13 — Edit Project `/projects/[id]/edit`
Form pre-filled with project data. Auto-extracted notice if applicable. Fields with "flagged" badge + warning note for fields that couldn't be extracted. Fields: name, address, sqft, stories, building type, occupancy, description. Save / Cancel buttons.

#### SCREEN 14 — Add Service (Credit Shop) `/projects/[id]/add-service`
Browse available credits for a project. Filtered by the project's programs. Credit cards showing credit code, name, category, automation type badge, price, deliverable description. "Order" CTA per card.

#### SCREEN 15 — Order Flow: Select Project `/orders/new/select-project`
Step 1 of 5. If the customer has existing projects, shows project cards to select from. Option to create a new project. Used when buying a service before having a project.

#### SCREEN 16 — Order Flow: Select Program `/orders/new/program`
Step 2 of 5. Choose which certification program to order documentation for. Cards for LEED BD+C v4.1, WELL v2, WELL Health-Safety with description and price indication.

#### SCREEN 17 — Order Flow: Browse Credits `/orders/new/credit`
Step 3 of 5. Credit catalog filtered by selected program. Searchable. Cards show credit code, category, automation type, deliverable summary, price. Click through to credit detail.

#### SCREEN 18 — Order Flow: Credit Detail `/orders/new/credit/[id]`
Step 3b. Full credit page: credit code + name, points (if LEED), automation type badge with explanation, deliverable description, required documents checklist, partial notes if applicable, LEED form / calculator flags, price. "Order this credit" CTA.

#### SCREEN 19 — Order Flow: Document Requirements `/orders/new/documents`
Step 4 of 5. Pre-payment information screen showing exactly which documents the customer will need to upload for this credit, so they can gather them before paying.

#### SCREEN 20 — Order Flow: Payment `/orders/new/payment`
Step 5 of 5. Order summary card (credit name, code, category, price, "3 AI runs included"). Pilot pricing note. Card details form (name on card, card number with lock icon, expiry, CVC). Pay button with lock icon and price. Stripe security note.

#### SCREEN 21 — Upload Documents `/orders/[orderId]/upload`
Post-purchase. Step 2 of 4 (Pay → Upload → Processing → Delivery). Drag-and-drop upload zone (PDF, DOCX, XLSX, JPG, PNG). Uploaded files list with remove button. Required documents checklist (from credit.required_customer_documents) with checkmarks filling as files are added. Submit button: "Submit N files for processing".

#### SCREEN 22 — Processing `/orders/[orderId]/processing`
Step 3 of 4. Animated processing indicator. Shows what the AI is doing. Estimated time. Email notification promise. Option to navigate away.

#### SCREEN 23 — Delivery `/orders/[orderId]/delivery`
Step 4 of 4. Email-style layout inside a card frame (dark navy email header, white body). "Email preview — this is what we sent to your inbox" pill badge. Download rows for each output file: narrative DOCX, HTML preview, calculator XLSX (if applicable), LEED form answers (if applicable). Runs remaining indicator (3 dots). Data deletion confirmation message. "Back to dashboard" CTA. "Share feedback" link.

#### SCREEN 24 — Gap Analysis: Start `/orders/gap-analysis`
Purchase page for the Credit Gap Analysis add-on. Explains what it does (analyzes the project against the full credit catalog, identifies opportunities, generates prioritized credit list). $299 price. "Purchase gap analysis" CTA.

#### SCREEN 25 — Gap Analysis: Energy Inputs `/orders/gap-analysis/energy`
Collects energy-related data for the gap analysis (building EUI, energy model outputs, utility data). Step in the gap analysis flow.

#### SCREEN 26 — Gap Analysis: Document Upload `/orders/gap-analysis/documents`
Upload screen for gap analysis source documents (project drawings, specs, existing certifications).

#### SCREEN 27 — Gap Analysis: Output `/orders/gap-analysis/output`
Gap analysis results view. Overall score vs. target score. Per-category breakdown bars. Recommended credits list with rationale. Download full report button. Order recommended credits CTAs.

#### SCREEN 28 — Pilot Feedback `/feedback`
Simple feedback form for pilot users. Textarea for open feedback, optional rating. Submitted to internal tracking.

---

## What Has Been Built

### Infrastructure (complete)
- [x] Next.js 15.5 project scaffold with App Router, TypeScript, Tailwind CSS
- [x] Supabase client + server utilities (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`)
- [x] Stripe, Resend, UploadThing utility modules
- [x] Full database schema (`0002_platform_schema.sql`) with all tables, enums, triggers, RLS, indexes
- [x] Storage bucket definitions and RLS policies (all 3 buckets)
- [x] AI pipeline skeleton (`src/lib/pipeline/process-order.ts`)
- [x] API routes: `/api/orders/[orderId]/run`, `/api/admin/cleanup`, `/api/webhooks/stripe`, `/api/uploadthing`
- [x] Edge Function: `supabase/functions/delete-customer-uploads/index.ts`
- [x] Mock data (`src/lib/mock-data.ts`) — projects, credits, orders, gap analysis, status configs
- [x] Shared UI components: `DashboardHeader`, `OrderStatusBadge`, `ProgramChip`, `StepProgress`, `Button`

### Marketing Site (complete)
- [x] **Screen 1** — Homepage: all 5 sections (Hero, Trust Band, How It Works, Programs Band, Transparency Band)
- [x] **Navbar** — sticky, pilot banner, mobile hamburger menu, pill CTA
- [x] **Footer** — used by about and how-it-works pages
- [ ] **Screen 2** — About page (stub exists, not designed)
- [ ] **Screen 3** — How It Works page (stub exists, not designed)
- [ ] **Screen 4** — Pricing page (not built)

### Auth Screens (stubs only)
- [ ] **Screen 5** — Login (stub exists, not styled to spec)
- [ ] **Screen 6** — Signup (stub exists, not styled to spec)
- [ ] **Screen 7** — Email confirmation (stub exists)

### Dashboard (built with mock data)
- [x] **Screen 8** — Dashboard empty state
- [x] **Screen 9** — Dashboard with projects (project cards, metrics, header)
- [x] **Screen 10** — New Project (upload + manual modes, program selection, target level)
- [ ] **Screen 11** — Project Created / post-upload confirmation (route exists, design TBD)
- [x] **Screen 12** — Project Detail (gap analysis card, services table, all states)
- [x] **Screen 13** — Edit Project (all fields, flagged field indicators, auto-extracted notice)
- [ ] **Screen 14** — Add Service / credit shop per project (route exists, design TBD)

### Order Flow (built with mock data)
- [ ] **Screen 15** — Select Project (stub exists)
- [ ] **Screen 16** — Select Program (stub exists)
- [ ] **Screen 17** — Browse Credits (stub exists)
- [x] **Screen 18** — Credit Detail (full detail page with automation type, deliverables, documents)
- [ ] **Screen 19** — Document Requirements info screen (stub exists)
- [x] **Screen 20** — Payment (order summary, pilot pricing note, card form, Stripe note)
- [x] **Screen 21** — Upload Documents (drag-and-drop, file list, checklist, submit)
- [ ] **Screen 22** — Processing (stub exists, minimal)
- [x] **Screen 23** — Delivery (email-style layout, download rows, runs remaining, data deletion note)

### Gap Analysis (stubs only)
- [ ] **Screen 24** — Gap Analysis purchase page (stub exists)
- [ ] **Screen 25** — Gap Analysis energy inputs (stub exists)
- [ ] **Screen 26** — Gap Analysis document upload (stub exists)
- [ ] **Screen 27** — Gap Analysis output (stub exists)

### Other
- [ ] **Screen 28** — Pilot Feedback form (stub exists)

---

## What Still Needs to Be Built

### High priority (core user flow)
1. **Auth screens** (Screens 5–7) — Login, Signup, Confirm — styled to design spec, wired to Supabase Auth
2. **Order flow steps 1–3** (Screens 15–17) — Select Project, Select Program, Browse Credits
3. **Document requirements screen** (Screen 19) — pre-payment document checklist
4. **Add Service / credit shop** (Screen 14) — per-project credit catalog
5. **Processing screen** (Screen 22) — animated status, polling, email notification copy

### Medium priority
6. **Project Created confirmation** (Screen 11) — post-upload extraction result + review prompt
7. **Gap Analysis screens** (Screens 24–27) — full purchase + input + output flow
8. **About page** (Screen 2) — designed to spec
9. **How It Works page** (Screen 3) — designed to spec
10. **Pricing page** (Screen 4) — credit pricing table

### Lower priority
11. **Pilot Feedback form** (Screen 28)
12. **Real Supabase wiring** — replace all mock data with live DB queries
13. **Real Stripe integration** — wire payment form to actual PaymentIntent
14. **Real UploadThing integration** — wire upload screens to actual bucket storage
15. **Real AI pipeline** — implement `assemblePipelineContext()` with live Anthropic API calls
16. **Email delivery** — wire Resend for order confirmation and delivery notification
17. **Admin tooling** — credit catalog management, cleanup queue monitoring
