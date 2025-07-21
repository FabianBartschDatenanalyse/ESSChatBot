'use server';

import { supabase } from './supabase';

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    console.log(`>>> [data-service] Executing query: ${query}`);
    try {
        // We use an RPC call to a Postgres function in Supabase for security.
        // This function should be created in the Supabase SQL editor.
        const { data, error } = await supabase
            .rpc('execute_safe_query', { query_text: query });

        console.log('>>> [data-service] Raw Supabase response `data`:', JSON.stringify(data, null, 2));
        console.log('>>> [data-service] Raw Supabase response `error`:', JSON.stringify(error, null, 2));

        if (error) {
            console.error("Supabase RPC error:", error);
            return { error: `Query execution failed: ${error.message}` };
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
            console.log('>>> [data-service] No data rows returned from Supabase.');
            return { results: [{ columns: [], rows: [] }] };
        }
        
        // The data from RPC is an array of JSON objects.
        // Let's determine the columns from the first row.
        const columns = Object.keys(data[0] || {});
        const formattedResults = {
            columns: columns,
            rows: data,
        };
        
        console.log('>>> [data-service] Formatted results to be returned:', JSON.stringify(formattedResults, null, 2));
        return { results: [formattedResults] };

    } catch (e: any) {
        console.error("Exception in data-service:", e);
        return { error: `Query execution failed with exception: ${e.message}` };
    }
}
