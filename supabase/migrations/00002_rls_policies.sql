-- ============================================================
-- MedBridge — Row Level Security Policies
-- Run after 00001_initial_schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.hospitals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.str_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merge_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: get the current user's role
-- ============================================================
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- Helper function: get the current user's hospital_id
-- ============================================================
CREATE OR REPLACE FUNCTION auth_hospital_id() RETURNS UUID AS $$
  SELECT hospital_id FROM public.profiles WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- HOSPITALS
-- ============================================================
-- Admins see all; hospital users see only their own hospital
CREATE POLICY "hospitals_select_admin"
  ON public.hospitals FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "hospitals_select_hospital_user"
  ON public.hospitals FOR SELECT
  USING (auth_role() = 'hospital_user' AND id = auth_hospital_id());

-- Only admins can insert/update hospitals (via Edge Function with service role key)
-- No direct insert/update from hospital users

-- ============================================================
-- PROFILES
-- ============================================================
-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (auth_role() = 'admin');

-- Profiles are inserted by Edge Function (service role), not directly
-- Users can update their own profile name
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE POLICY "patients_select_hospital"
  ON public.patients FOR SELECT
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

CREATE POLICY "patients_insert_hospital"
  ON public.patients FOR INSERT
  WITH CHECK (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

CREATE POLICY "patients_update_hospital"
  ON public.patients FOR UPDATE
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user')
  WITH CHECK (hospital_id = auth_hospital_id());

-- ============================================================
-- TEMPORARY RECORDS
-- ============================================================
CREATE POLICY "temp_records_select_hospital"
  ON public.temporary_records FOR SELECT
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

CREATE POLICY "temp_records_insert_hospital"
  ON public.temporary_records FOR INSERT
  WITH CHECK (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

CREATE POLICY "temp_records_update_hospital"
  ON public.temporary_records FOR UPDATE
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user')
  WITH CHECK (hospital_id = auth_hospital_id());

-- ============================================================
-- BIOMETRIC TEMPLATES
-- ============================================================
-- Hospital users can insert templates for their own hospital
CREATE POLICY "biometric_insert_hospital"
  ON public.biometric_templates FOR INSERT
  WITH CHECK (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

-- Hospital users can read their own hospital's templates (needed for matching UI)
-- Actual decryption / matching happens in Edge Functions; client only sees metadata
CREATE POLICY "biometric_select_hospital"
  ON public.biometric_templates FOR SELECT
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

-- No update or delete policies — templates are immutable from the client

-- ============================================================
-- STR PROFILES
-- ============================================================
CREATE POLICY "str_insert_hospital"
  ON public.str_profiles FOR INSERT
  WITH CHECK (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

CREATE POLICY "str_select_hospital"
  ON public.str_profiles FOR SELECT
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

-- ============================================================
-- CLINICAL NOTES
-- ============================================================
CREATE POLICY "clinical_notes_select_hospital"
  ON public.clinical_notes FOR SELECT
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

CREATE POLICY "clinical_notes_insert_hospital"
  ON public.clinical_notes FOR INSERT
  WITH CHECK (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

-- No update/delete policies at all

-- ============================================================
-- IDENTIFICATION ATTEMPTS
-- ============================================================
CREATE POLICY "id_attempts_select_hospital"
  ON public.identification_attempts FOR SELECT
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

CREATE POLICY "id_attempts_insert_hospital"
  ON public.identification_attempts FOR INSERT
  WITH CHECK (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

-- ============================================================
-- MERGE EVENTS
-- ============================================================
CREATE POLICY "merge_events_select_hospital"
  ON public.merge_events FOR SELECT
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

-- Merge is written by Edge Function (service role), but allow hospital insert for low-confidence reviewer path
CREATE POLICY "merge_events_insert_hospital"
  ON public.merge_events FOR INSERT
  WITH CHECK (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

-- ============================================================
-- AUDIT LOG
-- ============================================================
-- Hospital users see their own hospital's entries
CREATE POLICY "audit_log_select_hospital"
  ON public.audit_log FOR SELECT
  USING (hospital_id = auth_hospital_id() AND auth_role() = 'hospital_user');

-- Admins see all entries
CREATE POLICY "audit_log_select_admin"
  ON public.audit_log FOR SELECT
  USING (auth_role() = 'admin');

-- Anyone authenticated can insert (append-only)
CREATE POLICY "audit_log_insert_any"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- No update/delete policies for audit_log — ever
