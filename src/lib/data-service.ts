'use server';

import { supabase } from './supabase';

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    try {
        // We use an RPC call to a Postgres function in Supabase for security.
        // This function should be created in the Supabase SQL editor.
        const { data, error } = await supabase
            .rpc('execute_safe_query', { query_text: query });

        if (error) {
            console.error("Supabase RPC error:", error);
            return { error: `Query execution failed: ${error.message}` };
        }

        if (!data || data.length === 0) {
            return { results: [{ columns: [], rows: [] }] };
        }

        // The data from RPC is an array of JSON objects.
        // We need to determine the columns from the first row.
        const columns = Object.keys(data[0]);
        const formattedResults = {
            columns: columns,
            rows: data,
        };

        return { results: [formattedResults] };

    } catch (e: any) {
        console.error("Supabase execution error:", e);
        return { error: `Query execution failed: ${e.message}` };
    }
}
