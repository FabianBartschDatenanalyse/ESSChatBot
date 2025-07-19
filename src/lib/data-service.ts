'use server';

import { supabase, executeQuery as executeSupabaseQuery } from './supabase';

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    return executeSupabaseQuery(query);
}
