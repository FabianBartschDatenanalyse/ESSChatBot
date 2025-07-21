// This file creates a Supabase client with the SERVICE_ROLE key.
// This client has elevated privileges and should ONLY be used on the server-side
// for operations that require it, like performing embeddings or bypassing RLS.
// DO NOT expose this client or the service key to the browser.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Key must be provided in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    }
})
