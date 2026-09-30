// Edge Function: create-hospital
// Creates a hospital record + a Supabase Auth user for it,
// linked via the profiles table. Must be called by an admin.
// Uses the SERVICE ROLE key (set in Supabase Function env vars).

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
    // Verify the caller is an admin via their JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey      = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller with their own token
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check admin role
    const { data: profile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('user_id', caller.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse body
    const { name, address, city, contact_email, contact_person, password } = await req.json()
    if (!name || !contact_email || !password) {
      return new Response(JSON.stringify({ error: 'name, contact_email and password are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Service-role client for all privileged writes
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Create hospital record
    const { data: hospital, error: hospError } = await admin
      .from('hospitals')
      .insert({ name, address, city, contact_email, contact_person, status: 'active' })
      .select()
      .single()

    if (hospError) {
      return new Response(JSON.stringify({ error: hospError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Create Auth user for the hospital
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: contact_email,
      password,
      email_confirm: true,
    })

    if (authError) {
      // Rollback hospital record
      await admin.from('hospitals').delete().eq('id', hospital.id)
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Create profile linking auth user → hospital
    const { error: profileError } = await admin
      .from('profiles')
      .insert({
        user_id:     authData.user.id,
        role:        'hospital_user',
        hospital_id: hospital.id,
        full_name:   contact_person ?? name,
      })

    if (profileError) {
      // Rollback both
      await admin.auth.admin.deleteUser(authData.user.id)
      await admin.from('hospitals').delete().eq('id', hospital.id)
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Write audit log
    await admin.from('audit_log').insert({
      event_type:      'hospital_created',
      actor_id:        caller.id,
      record_ref:      hospital.id,
      payload_summary: { name, contact_email },
    })

    return new Response(
      JSON.stringify({ success: true, hospital }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
