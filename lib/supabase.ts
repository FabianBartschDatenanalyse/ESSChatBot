// This file creates a Supabase client with the public ANNON_KEY.
// This client is safe to be used on the client-side (in browsers).
// It can only perform actions allowed by your Row Level Security (RLS) policies.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // In a real app, you might want to handle this more gracefully than throwing an error.
  // For this project, we'll throw to ensure environment variables are set up correctly.
  console.error("Supabase URL or Anon Key is missing. Please check your .env file.");
  // We don't throw an error here to allow the app to build, but functionality will be broken.
}

// We check if the keys are placeholders before creating the client.
const isConfigured = supabaseUrl && supabaseUrl !== 'your-supabase-url' && supabaseAnonKey && supabaseAnonKey !== 'your-supabase-anon-key';

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
