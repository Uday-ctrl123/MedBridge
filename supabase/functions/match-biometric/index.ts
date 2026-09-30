// Edge Function: match-biometric
// Accepts a feature vector and modality, compares against all enrolled
// biometric templates for the hospital, returns ranked candidates.
// Matching is simulated: cosine similarity on the numeric vectors.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Cosine similarity between two numeric arrays */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

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
    const encKey      = Deno.env.get('BIOMETRIC_ENCRYPTION_KEY') ?? 'medbridge-dev-key'

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

    const { feature_vector, modality, record_id } = await req.json()
    if (!feature_vector || !modality) {
      return new Response(JSON.stringify({ error: 'feature_vector and modality required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const queryVector: number[] = Array.isArray(feature_vector) ? feature_vector : JSON.parse(feature_vector)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Fetch all templates for this hospital + modality
    const { data: templates, error: tplError } = await admin
      .from('biometric_templates')
      .select('id, patient_id, feature_vector')
      .eq('hospital_id', profile.hospital_id)
      .eq('modality', modality)

    if (tplError) {
      return new Response(JSON.stringify({ error: tplError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!templates || templates.length === 0) {
      // Log attempt
      if (record_id) {
        await admin.from('identification_attempts').insert({
          record_id,
          hospital_id:     profile.hospital_id,
          tier:            0,
          actor_id:        caller.id,
          confidence_score: 0,
          outcome:         'no_match',
          method:          modality,
          notes:           'No enrolled templates found',
        })
        await admin.from('audit_log').insert({
          hospital_id:     profile.hospital_id,
          event_type:      'identification_attempted',
          actor_id:        caller.id,
          record_ref:      record_id,
          payload_summary: { method: modality, outcome: 'no_match', reason: 'no_templates' },
        })
      }
      return new Response(JSON.stringify({ candidates: [], message: 'No enrolled templates found for this modality.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Score each template
    const scored = templates.map((tpl) => {
      let enrolledVector: number[]
      try {
        const raw = tpl.feature_vector
        // In a real deployment these are pgcrypto-encrypted; here we store JSON directly
        enrolledVector = Array.isArray(raw) ? raw : JSON.parse(raw)
      } catch {
        enrolledVector = []
      }
      const score = cosineSimilarity(queryVector, enrolledVector)
      return { patient_id: tpl.patient_id, template_id: tpl.id, score }
    })

    // Sort by score descending, return top 5
    const candidates = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(c => ({
        ...c,
        score: Math.round(c.score * 10000) / 10000,
        confidence_label: c.score >= 0.90 ? 'High' : c.score >= 0.70 ? 'Moderate' : 'Low',
      }))

    const topScore = candidates[0]?.score ?? 0
    const outcome  = topScore >= 0.70 ? 'matched' : 'no_match'

    // Log attempt
    if (record_id) {
      await admin.from('identification_attempts').insert({
        record_id,
        hospital_id:     profile.hospital_id,
        tier:            0,
        actor_id:        caller.id,
        confidence_score: topScore,
        outcome,
        method:          modality,
        notes:           `Top candidate score: ${topScore}`,
      })
      await admin.from('audit_log').insert({
        hospital_id:     profile.hospital_id,
        event_type:      'identification_attempted',
        actor_id:        caller.id,
        record_ref:      record_id,
        payload_summary: { method: modality, outcome, top_score: topScore },
      })
    }

    return new Response(JSON.stringify({ candidates }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
