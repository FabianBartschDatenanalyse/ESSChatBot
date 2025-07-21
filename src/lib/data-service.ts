'use server';

import { supabase } from './supabase';

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    console.log(`>>> [data-service] Executing query: ${query}`);
    try {
        // The execute_safe_query function returns a single JSON object with a status and either data or error.
        const { data: rpcResponse, error: rpcError } = await supabase
            .rpc('execute_safe_query', { query_text: query });

        console.log('>>> [data-service] Raw Supabase RPC response object:', JSON.stringify(rpcResponse, null, 2));
        console.log('>>> [data-service] Raw Supabase RPC error object:', JSON.stringify(rpcError, null, 2));

        if (rpcError) {
            console.error("Supabase RPC error:", rpcError);
            // This error is for the RPC call itself, not the SQL execution
            return { error: `Supabase RPC call failed: ${rpcError.message}` };
        }

        if (!rpcResponse) {
             return { error: 'Received no response from database function.' };
        }
        
        // Handle errors reported by the SQL function inside the JSON response
        if (rpcResponse.status === 'error') {
            console.error(`SQL execution error from function: ${rpcResponse.error}`);
            return { error: rpcResponse.error };
        }

        // Handle successful execution
        if (rpcResponse.status === 'success') {
            const resultData = rpcResponse.data;

            if (!resultData || (Array.isArray(resultData) && resultData.length === 0)) {
                console.log('>>> [data-service] Query successful, no data rows returned.');
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
        }

        // Fallback for unexpected response structure
        return { error: 'Received an unexpected response format from the database function.' };

    } catch (e: any) {
        console.error("Exception in data-service:", e);
        return { error: `Query execution failed with exception: ${e.message}` };
    }
}
