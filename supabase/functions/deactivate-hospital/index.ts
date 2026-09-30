// Edge Function: deactivate-hospital
// Sets a hospital's status to 'inactive' and disables the Auth user.
// Preserves all data for audit purposes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify admin
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
      .from('profiles').select('role').eq('user_id', caller.id).single()
    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { hospital_id } = await req.json()
    if (!hospital_id) {
      return new Response(JSON.stringify({ error: 'hospital_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Mark hospital inactive
    const { error: hospError } = await admin
      .from('hospitals')
      .update({ status: 'inactive' })
      .eq('id', hospital_id)

    if (hospError) {
      return new Response(JSON.stringify({ error: hospError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Find and ban the hospital's Auth user
    const { data: hosp_profile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('hospital_id', hospital_id)
      .eq('role', 'hospital_user')
      .single()

    if (hosp_profile) {
      await admin.auth.admin.updateUserById(hosp_profile.user_id, { ban_duration: 'none' })
      // Supabase uses ban_duration: 'none' to unban, '876600h' to ban indefinitely
      await admin.auth.admin.updateUserById(hosp_profile.user_id, { ban_duration: '876600h' })
    }

    // 3. Audit log
    await admin.from('audit_log').insert({
      event_type:      'hospital_deactivated',
      actor_id:        caller.id,
      record_ref:      hospital_id,
      payload_summary: { deactivated_by: caller.id },
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
