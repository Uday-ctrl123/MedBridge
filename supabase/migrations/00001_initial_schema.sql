-- ============================================================
-- MedBridge — Initial Schema Migration
-- Run this in the Supabase SQL editor in order.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. HOSPITALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hospitals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  address        TEXT,
  city           TEXT,
  contact_email  TEXT NOT NULL UNIQUE,
  contact_person TEXT,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. PROFILES  (links auth.users → role + hospital)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'hospital_user')),
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  full_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. PATIENTS  (enrolled / known patients)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id       UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  date_of_birth     DATE,
  contact           TEXT,
  enrollment_status TEXT NOT NULL DEFAULT 'none' CHECK (enrollment_status IN ('enrolled', 'pending', 'none')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. TEMPORARY RECORDS  (unidentified admissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.temporary_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn                     TEXT NOT NULL UNIQUE,
  hospital_id             UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  placeholder_name        TEXT NOT NULL DEFAULT 'Unidentified',
  approx_age              INT,
  approx_sex              TEXT,
  distinguishing_features TEXT,
  current_tier            INT NOT NULL DEFAULT 0 CHECK (current_tier BETWEEN 0 AND 5),
  status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'merged')),
  admission_time          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate MRN: MB-YYYYMMDD-XXXXXX
CREATE OR REPLACE FUNCTION generate_mrn() RETURNS TEXT AS $$
DECLARE
  v_mrn TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_mrn := 'MB-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.temporary_records WHERE mrn = v_mrn) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_mrn;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_mrn() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mrn IS NULL OR NEW.mrn = '' THEN
    NEW.mrn := generate_mrn();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_mrn
  BEFORE INSERT ON public.temporary_records
  FOR EACH ROW EXECUTE FUNCTION set_mrn();

-- updated_at triggers
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_hospitals
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_patients
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_temp_records
  BEFORE UPDATE ON public.temporary_records
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- 5. BIOMETRIC TEMPLATES  (encrypted feature vectors)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.biometric_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id    UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  modality       TEXT NOT NULL CHECK (modality IN ('face', 'fingerprint', 'iris')),
  feature_vector TEXT NOT NULL,  -- pgp_sym_encrypt(vector_json, key)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. STR PROFILES  (encrypted marker sets)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.str_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  marker_set  TEXT NOT NULL,  -- pgp_sym_encrypt(markers_json, key)
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. CLINICAL NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   UUID NOT NULL,   -- points to temporary_records.id OR patients.id
  record_type TEXT NOT NULL CHECK (record_type IN ('temporary', 'verified')),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  note_type   TEXT NOT NULL CHECK (note_type IN ('vitals', 'injuries', 'treatment', 'general')),
  content     TEXT NOT NULL,
  author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- clinical_notes is insert-only; no update/delete policies granted

-- ============================================================
-- 8. IDENTIFICATION ATTEMPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.identification_attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id        UUID NOT NULL REFERENCES public.temporary_records(id) ON DELETE CASCADE,
  hospital_id      UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  tier             INT NOT NULL CHECK (tier BETWEEN 0 AND 5),
  actor_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  input_ref        TEXT,
  confidence_score NUMERIC(5,4),
  outcome          TEXT NOT NULL CHECK (outcome IN ('matched', 'no_match', 'pending', 'failed')),
  method           TEXT NOT NULL,
  notes            TEXT,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- identification_attempts is insert-only

-- ============================================================
-- 9. MERGE EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.merge_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  temp_record_id      UUID NOT NULL REFERENCES public.temporary_records(id) ON DELETE CASCADE,
  verified_patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id         UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  resolving_tier      INT NOT NULL CHECK (resolving_tier BETWEEN 0 AND 5),
  approved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confidence_score    NUMERIC(5,4) NOT NULL,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- merge_events is insert-only

-- ============================================================
-- 10. AUDIT LOG  (append-only, platform-wide)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id     UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  record_ref      TEXT,
  payload_summary JSONB,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- audit_log is insert-only for everyone; no update/delete policies

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id          ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hospital_id      ON public.profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_id      ON public.patients(hospital_id);
CREATE INDEX IF NOT EXISTS idx_temp_records_hospital     ON public.temporary_records(hospital_id);
CREATE INDEX IF NOT EXISTS idx_temp_records_status       ON public.temporary_records(status);
CREATE INDEX IF NOT EXISTS idx_biometric_patient         ON public.biometric_templates(patient_id);
CREATE INDEX IF NOT EXISTS idx_biometric_hospital        ON public.biometric_templates(hospital_id);
CREATE INDEX IF NOT EXISTS idx_str_patient               ON public.str_profiles(patient_id);
CREATE INDEX IF NOT EXISTS idx_str_hospital              ON public.str_profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_clinical_record           ON public.clinical_notes(record_id);
CREATE INDEX IF NOT EXISTS idx_clinical_hospital         ON public.clinical_notes(hospital_id);
CREATE INDEX IF NOT EXISTS idx_id_attempts_record        ON public.identification_attempts(record_id);
CREATE INDEX IF NOT EXISTS idx_id_attempts_hospital      ON public.identification_attempts(hospital_id);
CREATE INDEX IF NOT EXISTS idx_merge_temp                ON public.merge_events(temp_record_id);
CREATE INDEX IF NOT EXISTS idx_merge_hospital            ON public.merge_events(hospital_id);
CREATE INDEX IF NOT EXISTS idx_audit_hospital            ON public.audit_log(hospital_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type         ON public.audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp          ON public.audit_log(timestamp DESC);
