# Deployment Guide — Railway via GitHub

## Overview

Stack: Next.js 15 → Railway (Node.js) + Supabase (Postgres + Storage) + Stripe + Resend + UploadThing + Anthropic

---

## Step 1 — Push to GitHub

Run these commands from the project root:

```bash
# Initialize git (if not already done)
git init

# Stage everything except secrets (.gitignore already excludes .env*.local)
git add .
git commit -m "Initial commit — production-ready build"

# Create a new repo on GitHub (requires GitHub CLI — install at cli.github.com)
gh repo create liminalsva --private --source=. --push

# If you prefer the GitHub web UI instead:
# 1. Go to github.com → New repository → name it "liminalsva" → Private → Create
# 2. Then run:
git remote add origin https://github.com/YOUR_USERNAME/liminalsva.git
git branch -M main
git push -u origin main
```

> **Important**: Confirm `.env.local` is NOT committed:
> `git status` should not show `.env.local` in the output.

---

## Step 2 — Configure Supabase Production Database

Apply all migrations in order against your **production** Supabase project.
Run each file in the Supabase SQL Editor (dashboard.supabase.com → SQL Editor):

| Order | File | What it does |
|-------|------|-------------|
| 1 | `supabase/migrations/0001_initial.sql` | Base schema (auth, profiles, orgs, projects) |
| 2 | `supabase/migrations/0002_platform_schema.sql` | Orders, customers, runs — **replaces v1** |
| 3 | `supabase/migrations/0003_pipeline_schema.sql` | Pipeline runs, audit_log, RLS policies |
| 4 | `supabase/migrations/0004_occupant_fields.sql` | Adds occupancy fields to projects |
| 5 | `supabase/migrations/0005_reference_bucket.sql` | Creates `platform-reference` storage bucket |
| 6 | `supabase/migrations/0006_specs_extracted.sql` | Adds specs extraction tracking |
| 7 | `supabase/migrations/0007_doc_profiles_extracted.sql` | Adds document profile tracking |

> **Note**: Migration 0002 tears down the v1 schema before rebuilding. Run them strictly in order.
> The `customer-uploads` and `order-outputs` buckets are created in migration 0003.

---

## Step 3 — Upload Reference Files to Supabase Storage

After migrations run and the `platform-reference` bucket exists:

```bash
# Set production credentials temporarily in your shell
export NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# Run the upload script
npx ts-node --project tsconfig.json scripts/upload-reference-files.ts
```

This uploads LEED/WELL reference PDFs, calculators, and JSON files from
`pipeline/reference/` into the `platform-reference` bucket. The pipeline
reads these at runtime to produce credit documentation.

---

## Step 4 — Deploy on Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your `liminalsva` repository
3. Railway will auto-detect Next.js and set the build command to `npm run build`
4. Set the **start command**: `npm start`
5. Set **Health Check Path**: `/api/health`

### Add Environment Variables

In Railway → Project → **Variables**, add every variable from `.env.production.example`.
Below is the priority order — get these right before the first deploy:

**Required for app to start:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` ← set to your Railway domain first, update if you add a custom domain

**Required for auth (magic links):**
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

**Required for payments:**
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` ← register the webhook endpoint first (Step 5)
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_PROFESSIONAL_MONTHLY`

**Required for pipeline (AI processing):**
- `ANTHROPIC_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `WEBHOOK_SECRET`
- `CLEANUP_SECRET`

**Required for file uploads:**
- `UPLOADTHING_SECRET`
- `UPLOADTHING_APP_ID`

---

## Step 5 — Register the Stripe Webhook

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. Endpoint URL: `https://your-railway-domain.up.railway.app/api/webhooks/stripe`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Signing secret** → paste into Railway as `STRIPE_WEBHOOK_SECRET`

---

## Step 6 — Configure Supabase Auth Redirect URLs

In Supabase → Authentication → URL Configuration:
- **Site URL**: `https://your-railway-domain.up.railway.app`
- **Redirect URLs** (add both):
  - `https://your-railway-domain.up.railway.app/auth/confirm`
  - `https://your-railway-domain.up.railway.app/**`

---

## Step 7 — Configure UploadThing

In [uploadthing.com](https://uploadthing.com) → your app → Settings:
- Add your Railway domain to the **allowed origins** list

---

## Step 8 — Verify Deployment

After deploy completes:

```bash
# Health check — should return {"status":"ok","timestamp":"..."}
curl https://your-railway-domain.up.railway.app/api/health

# Check Railway build logs for any startup errors
# Railway Dashboard → Deployments → latest → View Logs
```

---

## Checklist — Manual Steps in Order

- [ ] **1.** Run `git init && git add . && git commit -m "Initial commit"` locally
- [ ] **2.** Create private GitHub repo and push: `git push -u origin main`
- [ ] **3.** Run migrations 0001–0007 in Supabase SQL Editor (in order)
- [ ] **4.** Run `scripts/upload-reference-files.ts` to populate `platform-reference` bucket
- [ ] **5.** Create Railway project → connect GitHub repo → set start command and health check path
- [ ] **6.** Add all env vars to Railway Variables (use `.env.production.example` as the checklist)
- [ ] **7.** Register Stripe webhook endpoint → copy signing secret → add to Railway as `STRIPE_WEBHOOK_SECRET`
- [ ] **8.** Update Supabase Auth redirect URLs to your Railway domain
- [ ] **9.** Add Railway domain to UploadThing allowed origins
- [ ] **10.** Hit `/api/health` to confirm deployment is live
- [ ] **11.** Test magic-link login end-to-end
- [ ] **12.** Place a test order using Stripe test card `4242 4242 4242 4242` — confirm webhook fires

---

## Notes

- `pipeline/` scripts (test-*.ts, process-order.ts) run on the Railway server at request time via the API routes. They require `node_modules` to be present — Railway installs dependencies before each deploy.
- The Supabase Edge Function `delete-customer-uploads` should be deployed separately via the Supabase CLI if scheduled cleanup is needed: `supabase functions deploy delete-customer-uploads`
- `NEXT_PUBLIC_APP_URL` must match your actual domain — it's used in magic-link email redirects and UploadThing webhook callbacks.
