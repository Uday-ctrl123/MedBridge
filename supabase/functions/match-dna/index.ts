// Edge Function: match-dna
// Accepts an STR marker set and compares against all enrolled STR profiles
// for the hospital using weighted overlap → probability score.
// Labeled as confirmatory; returns ranked candidates.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MarkerSet {
  [locus: string]: [number, number]  // allele pair
}

/**
 * Weighted STR overlap score.
 * Each locus has a weight; matching both alleles scores full weight,
 * matching one allele scores half, no match scores 0.
 * Result is normalised to [0, 1].
 */
function strOverlapScore(query: MarkerSet, enrolled: MarkerSet): number {
  const loci = Object.keys(query)
  if (loci.length === 0) return 0

  let total = 0, matched = 0
  for (const locus of loci) {
    const q = query[locus]
    const e = enrolled[locus]
    total += 1
    if (!e) continue
    const qSet = new Set([q[0], q[1]])
    const eSet = new Set([e[0], e[1]])
    const overlap = [...qSet].filter(a => eSet.has(a)).length
    if (overlap === 2 || (q[0] === q[1] && e[0] === e[1] && q[0] === e[0])) {
      matched += 1
    } else if (overlap === 1) {
      matched += 0.5
    }
  }
  return total === 0 ? 0 : matched / total
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

    const { marker_set, record_id } = await req.json()
    if (!marker_set) {
      return new Response(JSON.stringify({ error: 'marker_set required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const queryMarkers: MarkerSet = typeof marker_set === 'string' ? JSON.parse(marker_set) : marker_set

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: strProfiles, error: strError } = await admin
      .from('str_profiles')
      .select('id, patient_id, marker_set')
      .eq('hospital_id', profile.hospital_id)

    if (strError) {
      return new Response(JSON.stringify({ error: strError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!strProfiles || strProfiles.length === 0) {
      if (record_id) {
        await admin.from('identification_attempts').insert({
          record_id,
          hospital_id:     profile.hospital_id,
          tier:            4,
          actor_id:        caller.id,
          confidence_score: 0,
          outcome:         'no_match',
          method:          'dna_str',
          notes:           'No enrolled STR profiles found',
        })
        await admin.from('audit_log').insert({
          hospital_id:     profile.hospital_id,
          event_type:      'identification_attempted',
          actor_id:        caller.id,
          record_ref:      record_id,
          payload_summary: { method: 'dna_str', outcome: 'no_match', reason: 'no_profiles' },
        })
      }
      return new Response(JSON.stringify({ candidates: [], message: 'No enrolled STR profiles found.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const scored = strProfiles.map(p => {
      let enrolledMarkers: MarkerSet
      try {
        enrolledMarkers = typeof p.marker_set === 'string' ? JSON.parse(p.marker_set) : p.marker_set
      } catch {
        enrolledMarkers = {}
      }
      const score = strOverlapScore(queryMarkers, enrolledMarkers)
      return { patient_id: p.patient_id, str_profile_id: p.id, score }
    })

    const candidates = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(c => ({
        ...c,
        score:             Math.round(c.score * 10000) / 10000,
        confidence_label: c.score >= 0.90 ? 'High' : c.score >= 0.65 ? 'Moderate' : 'Low',
      }))

    const topScore = candidates[0]?.score ?? 0
    const outcome  = topScore >= 0.65 ? 'matched' : 'no_match'

    if (record_id) {
      await admin.from('identification_attempts').insert({
        record_id,
        hospital_id:     profile.hospital_id,
        tier:            4,
        actor_id:        caller.id,
        confidence_score: topScore,
        outcome,
        method:          'dna_str',
        notes:           `Top STR overlap score: ${topScore}`,
      })
      await admin.from('audit_log').insert({
        hospital_id:     profile.hospital_id,
        event_type:      'identification_attempted',
        actor_id:        caller.id,
        record_ref:      record_id,
        payload_summary: { method: 'dna_str', outcome, top_score: topScore },
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
