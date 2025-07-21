'use server';

import { supabase } from './supabase';

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    try {
        const { data: rpcResponseRaw, error: rpcError } = await supabase
            .rpc('execute_safe_query', { query_text: query });

        if (rpcError) {
            return { error: `Supabase RPC call failed: ${rpcError.message}` };
        }
        
        // The RPC call returns an array with a single response object. Extract it.
        const rpcResponse = Array.isArray(rpcResponseRaw) && rpcResponseRaw.length > 0
            ? rpcResponseRaw[0]
            : rpcResponseRaw;

        if (!rpcResponse) {
             return { error: 'Received no or empty response from database function.' };
        }
        
        if (rpcResponse.status === 'error') {
            return { error: rpcResponse.error };
        }

        if (rpcResponse.status === 'success') {
            const resultData = rpcResponse.data;

            if (!resultData || (Array.isArray(resultData) && resultData.length === 0)) {
                return { results: [{ columns: [], rows: [] }] };
            }
            
            const columns = Object.keys(resultData[0] || {});
            const formattedResults = {
                columns: columns,
                rows: resultData,
            };

            return { results: [formattedResults] };
        }

        return { error: 'Received an unexpected response format from the database function.' };

    } catch (e: any) {
        return { error: `Query execution failed with exception: ${e.message}` };
    }
}
