# MedBridge — Emergency Identity Resolution & Health Record System

A production-quality web application that creates temporary patient records in under 2 seconds, then resolves identity through a six-tier graduated fallback ladder: biometrics → physical evidence → network lookup → human recognition → DNA/STR → manual review.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Local setup](#3-local-setup)
4. [Supabase project configuration](#4-supabase-project-configuration)
5. [Run the SQL migrations](#5-run-the-sql-migrations)
6. [Bootstrap the first admin account](#6-bootstrap-the-first-admin-account)
7. [Deploy Edge Functions](#7-deploy-edge-functions)
8. [Running the app locally](#8-running-the-app-locally)
9. [Deploying to Vercel or Netlify](#9-deploying-to-vercel-or-netlify)
10. [Environment variables reference](#10-environment-variables-reference)
11. [Data model summary](#11-data-model-summary)
12. [Identification ladder & confidence thresholds](#13-identification-ladder--confidence-thresholds)
13. [Security & compliance notes](#14-security--compliance-notes)

---

## 1. Architecture overview

```
Browser (React + Vite + Tailwind)
        │
        │  Supabase client SDK (RLS-protected reads/writes)
        │  supabase.functions.invoke(...)  ←→  Edge Functions (Deno)
        ▼
  Supabase Cloud
  ├── Postgres (all tables, RLS, pgcrypto)
  ├── Auth (email + password, 4 custom roles via profiles table)
  ├── Storage (transient image bucket — deleted after vectorisation)
  ├── Edge Functions
  │     ├── create-hospital      — creates hospital record + Auth user
  │     ├── deactivate-hospital  — bans Auth user, marks hospital inactive
  │     ├── match-biometric      — cosine similarity over enrolled vectors
  │     ├── match-dna            — STR weighted-overlap scoring
  │     └── merge-record         — carries clinical notes, writes merge event
  └── Realtime (temporary_records, audit_log, identification_attempts, merge_events)
```

Two separate portals share one Supabase project but are isolated by Row Level Security:

| Portal | Route prefix | Allowed role |
|--------|-------------|--------------|
| Platform admin | `/admin/*` | `admin` |
| Hospital staff | `/hospital/*` | `hospital_user` |

RLS helper functions (`auth_role()`, `auth_hospital_id()`) are evaluated inside Postgres on every query, so client-side route guards are a UX convenience only — the database enforces access.

---

## 2. Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18 LTS |
| npm | 9 |
| Supabase CLI | 1.168 (`npm i -g supabase`) |
| A Supabase project | Free tier is sufficient |

---

## 3. Local setup

```bash
# Clone / open the project
cd medbridge

# Install dependencies
npm install

# Copy the environment template
cp .env.example .env
```

Edit `.env` and fill in your Supabase project credentials (see §4).

---

## 4. Supabase project configuration

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Note your **Project URL** and **anon key** (Settings → API).
3. Note your **service role key** — you will need it for Edge Function env vars (keep it secret; never commit it).
4. In **Authentication → Settings**:
   - Disable "Confirm email" if you want instant logins during development (re-enable for production).
   - Set Site URL to `http://localhost:5173` for local dev, or your deployed URL.
5. In **Storage**, create a **private bucket** named `enrollment-images`.  
   (The app uploads a face image momentarily, extracts the vector, then deletes the file — this bucket is just a transient buffer.)

---

## 5. Run the SQL migrations

Open the Supabase **SQL editor** and run the three migration files **in order**:

### Migration 1 — Schema

Copy and run the entire contents of:
```
supabase/migrations/00001_initial_schema.sql
```

This creates all tables, the MRN auto-generation trigger, `updated_at` triggers, and indexes.

### Migration 2 — RLS policies

Copy and run:
```
supabase/migrations/00002_rls_policies.sql
```

This enables Row Level Security on every table and creates the `auth_role()` and `auth_hospital_id()` helper functions used by all policies.

### Migration 3 — Realtime

Copy and run:
```
supabase/migrations/00003_realtime.sql
```

This adds `temporary_records`, `audit_log`, `identification_attempts`, and `merge_events` to the `supabase_realtime` publication so the dashboard and audit ledger update live.

---

## 6. Bootstrap the first admin account

The admin portal has no self-registration. Create the first platform admin directly in the Supabase dashboard:

**Step 1 — Create the Auth user**

Go to **Authentication → Users → Add user**:
- Email: `admin@yourplatform.com`
- Password: choose a strong password
- "Auto Confirm User": ✓

Note the `user_id` (UUID) shown after creation.

**Step 2 — Insert the profile row**

In the SQL editor, replacing `<USER_ID>` with the UUID from step 1:

```sql
INSERT INTO public.profiles (user_id, role, full_name)
VALUES ('<USER_ID>', 'admin', 'Platform Admin');
```

That's it. You can now sign in at `/admin/login`.

> **Adding more admins:** Repeat the same two steps. Hospital accounts should be created through the Admin → Hospitals → Add Hospital form (which calls the `create-hospital` Edge Function and handles everything atomically).

---

## 7. Deploy Edge Functions

### Prerequisites

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Log in
supabase login

# Link to your project (get project ref from Settings → General)
supabase link --project-ref <your-project-ref>
```

### Set Edge Function secrets

These secrets are available inside all functions as `Deno.env.get(...)`:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
supabase secrets set BIOMETRIC_ENCRYPTION_KEY=<a-random-32-char-string>
```

> `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by the Supabase runtime — you do not need to set them.

### Deploy all functions

```bash
supabase functions deploy create-hospital
supabase functions deploy deactivate-hospital
supabase functions deploy match-biometric
supabase functions deploy match-dna
supabase functions deploy merge-record
```

Or deploy all at once:

```bash
for fn in create-hospital deactivate-hospital match-biometric match-dna merge-record; do
  supabase functions deploy $fn
done
```

### Verify

In the Supabase dashboard → **Edge Functions** you should see all five functions with a green "Active" status.

---

## 8. Running the app locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

- **`/`** — Landing page with two entry links
- **`/admin/login`** — Platform admin sign-in
- **`/hospital/login`** — Hospital staff sign-in

---

## 9. Deploying to Vercel or Netlify

Both platforms work out of the box since this is a pure static SPA.

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```
Set the environment variables in the Vercel project settings (same as `.env`).

**Netlify:**
```bash
npm run build
# Drag the dist/ folder to Netlify drop, or use netlify CLI
```
Add a `netlify.toml` for SPA routing:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Netlify environment variables panel.

---

## 10. Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✓ | Your Supabase project URL, e.g. `https://abc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✓ | Public anon key from Settings → API |

Edge Function secrets (set via `supabase secrets set`, never in `.env`):

| Secret | Required | Description |
|--------|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Service role key — grants admin DB access inside functions |
| `BIOMETRIC_ENCRYPTION_KEY` | ✓ | Symmetric key used to encrypt feature vectors at rest |

---

## 11. Data model summary

| Table | Purpose | Append-only |
|-------|---------|-------------|
| `hospitals` | Client hospital records | No (status can be updated) |
| `profiles` | Auth user → role + hospital_id | No (name updatable) |
| `patients` | Enrolled / known patients | No |
| `temporary_records` | Unidentified admissions with auto-MRN | Status update only |
| `biometric_templates` | Encrypted face/fingerprint/iris vectors | ✓ |
| `str_profiles` | Encrypted STR marker sets | ✓ |
| `clinical_notes` | Vitals, injuries, treatment, general | ✓ |
| `identification_attempts` | Every tier attempt with score + outcome | ✓ |
| `merge_events` | Record merge decisions | ✓ |
| `audit_log` | Platform-wide immutable event log | ✓ |

RLS ensures hospital users only ever see rows where `hospital_id = auth_hospital_id()`. The admin role sees `hospitals` and `audit_log` but never patient, biometric, or clinical data.

---

## 12. Identification ladder & confidence thresholds

| Tier | Method | Auto-merge threshold |
|------|--------|---------------------|
| 0 | Biometric (face / fingerprint / iris) | ≥ 0.90 |
| 1 | Physical evidence | Logged manually |
| 2 | Network / database lookup | Logged manually |
| 3 | Human recognition | Logged manually |
| 4 | DNA / STR (confirmatory) | ≥ 0.90 |
| 5 | Manual forensic review | Logged manually |

Scores below **0.90** require a reviewer to approve the merge. The reviewer's `user_id` is recorded in `merge_events.approved_by` and the audit log. This logic lives in the `merge-record` Edge Function — it cannot be bypassed from the client.

---

## 13. Security & compliance notes

- **No raw biometric images are persisted.** Any uploaded image is deleted from Storage immediately after the feature vector is extracted client-side.
- **No full genomic sequences are stored.** Only STR marker sets (typically 9–20 loci) are enrolled.
- **Biometric vectors and STR marker sets are stored in separate tables** from clinical notes, with distinct RLS policies.
- **The audit log has no UPDATE or DELETE policies** — not even for admins. It is append-only at the Postgres policy layer.
- **Treatment proceeds under implied-consent doctrine** consistent with HIPAA/GDPR/DPDP emergency exceptions. This is a design justification to cite in a thesis defence, not a compliance claim for production deployment.
- **Production deployment** would require an institutional ethics/legal review of the enrollment consent process, validated biometric hardware, and a HIPAA Business Associate Agreement with your infrastructure provider.

---

*MedBridge is derived from the MedBridge research paper (biometric-first, DNA-confirmed fallback framework for unidentified patients). Biometric and DNA matching in this prototype is simulated.*
