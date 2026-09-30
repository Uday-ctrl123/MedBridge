// Edge Function: merge-record
// Merges a temporary record into a verified patient record.
// - If score >= HIGH_CONFIDENCE_THRESHOLD: auto-merge
// - Otherwise: requires reviewer_id to be provided
// - Carries all clinical notes forward
// - Marks the temporary record as 'merged'
// - Writes a merge_event and audit_log entry

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HIGH_CONFIDENCE_THRESHOLD = 0.90

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: profile } = await callerClient
      .from('profiles').select('role, hospital_id').eq('user_id', caller.id).single()
    if (!profile || profile.role !== 'hospital_user') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      temp_record_id,
      verified_patient_id,
      confidence_score,
      resolving_tier,
      reviewer_id,
      method,
    } = await req.json()

    if (!temp_record_id || !verified_patient_id || confidence_score === undefined || resolving_tier === undefined) {
      return new Response(JSON.stringify({ error: 'temp_record_id, verified_patient_id, confidence_score, resolving_tier required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Enforce reviewer requirement for below-threshold merges
    if (confidence_score < HIGH_CONFIDENCE_THRESHOLD && !reviewer_id) {
      return new Response(JSON.stringify({
        error: 'Confidence score below threshold. A reviewer_id must approve this merge.',
        requires_review: true,
        threshold: HIGH_CONFIDENCE_THRESHOLD,
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Verify temp record belongs to this hospital and is open
    const { data: tempRecord, error: trError } = await admin
      .from('temporary_records')
      .select('*')
      .eq('id', temp_record_id)
      .eq('hospital_id', profile.hospital_id)
      .eq('status', 'open')
      .single()

    if (trError || !tempRecord) {
      return new Response(JSON.stringify({ error: 'Temporary record not found or already merged' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Verify patient belongs to this hospital
    const { data: patient, error: patError } = await admin
      .from('patients')
      .select('id')
      .eq('id', verified_patient_id)
      .eq('hospital_id', profile.hospital_id)
      .single()

    if (patError || !patient) {
      return new Response(JSON.stringify({ error: 'Verified patient not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Re-parent all clinical notes from temp record → verified patient
    const { error: noteError } = await admin
      .from('clinical_notes')
      .update({ record_id: verified_patient_id, record_type: 'verified' })
      .eq('record_id', temp_record_id)
      .eq('record_type', 'temporary')

    if (noteError) {
      return new Response(JSON.stringify({ error: `Note migration failed: ${noteError.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Mark temp record as merged
    await admin
      .from('temporary_records')
      .update({ status: 'merged' })
      .eq('id', temp_record_id)

    // 5. Write merge event
    const { data: mergeEvent } = await admin
      .from('merge_events')
      .insert({
        temp_record_id,
        verified_patient_id,
        hospital_id:     profile.hospital_id,
        resolving_tier,
        approved_by:     reviewer_id ?? caller.id,
        confidence_score,
      })
      .select()
      .single()

    // 6. Audit log
    await admin.from('audit_log').insert({
      hospital_id:     profile.hospital_id,
      event_type:      'record_merged',
      actor_id:        caller.id,
      record_ref:      temp_record_id,
      payload_summary: {
        temp_record_id,
        verified_patient_id,
        confidence_score,
        resolving_tier,
        method: method ?? 'unknown',
        auto_merged: confidence_score >= HIGH_CONFIDENCE_THRESHOLD,
        reviewer_id: reviewer_id ?? null,
      },
    })

    return new Response(JSON.stringify({ success: true, merge_event: mergeEvent }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
