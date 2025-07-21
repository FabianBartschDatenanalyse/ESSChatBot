'use server';

import { supabase } from './supabase';

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    console.log(`>>> [data-service] Executing query: ${query}`);
    try {
        // The execute_safe_query function is now expected to return a JSON object 
        // with a 'status' and either 'data' or 'error'.
        const { data, error } = await supabase
            .rpc('execute_safe_query', { query_text: query });

        console.log('>>> [data-service] Raw Supabase response `data`:', JSON.stringify(data, null, 2));
        console.log('>>> [data-service] Raw Supabase response `error`:', JSON.stringify(error, null, 2));

        if (error) {
            console.error("Supabase RPC error:", error);
            // The user-facing error is now inside the returned data object
            return { error: data?.error || `Query execution failed: ${error.message}` };
        }

        // The function returns a single JSON object. We access its `data` property.
        const resultData = data?.data;

        if (!resultData || (Array.isArray(resultData) && resultData.length === 0)) {
            console.log('>>> [data-service] No data rows returned from Supabase.');
            return { results: [{ columns: [], rows: [] }] };
        }
        
        // The data from the RPC is an array of JSON objects.
        // We can determine the columns from the keys of the first row.
        const columns = Object.keys(resultData[0] || {});

        const formattedResults = {
            columns: columns,
            rows: resultData,
        };
        
        console.log('>>> [data-service] Formatted results to be returned:', JSON.stringify(formattedResults, null, 2));

        return { results: [formattedResults] };

    } catch (e: any) {
        console.error("Exception in data-service:", e);
        return { error: `Query execution failed with exception: ${e.message}` };
    }
}
