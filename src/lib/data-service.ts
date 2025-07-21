'use server';

import { supabase } from './supabase';

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
  console.log('[data-service] Executing query:', query);

  try {
    // The RPC call returns a wrapper object with a 'data' property containing the actual function response.
    const { data: rpcFunctionResponse, error: rpcError } = await supabase
      .rpc('execute_safe_query', { query_text: query });

    if (rpcError) {
      console.error('[data-service] Supabase RPC error:', rpcError.message);
      return { error: `Supabase RPC call failed: ${rpcError.message}` };
    }

    // The function itself returns a JSON object like { status: '...', data: [...] }
    const queryResult = rpcFunctionResponse;
    console.log('[data-service] Response from database function:', JSON.stringify(queryResult, null, 2));

    if (!queryResult) {
      const errorMessage = 'Received null or empty response from database function.';
      console.error(`[data-service] ${errorMessage}`);
      return { error: errorMessage };
    }
    
    if (queryResult.status === 'error') {
      console.error('[data-service] Database function returned error:', queryResult.error);
      return { error: queryResult.error };
    }

    if (queryResult.status === 'success') {
      const data = queryResult.data;
      console.log('[data-service] Success. Extracted data:', JSON.stringify(data, null, 2));
      
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.log('[data-service] Query successful, but no rows returned.');
        // Return a structure that the DataTable component can handle
        return { results: [{ columns: [], rows: [] }] };
      }

      // Format for DataTable: an array containing one result object
      const columns = Object.keys(data[0] || {});
      const formattedResult = {
        columns: columns,
        rows: data,
      };

      return { results: [formattedResult] };
    }

    const unexpectedFormatError = 'Received an unexpected response format from the database function.';
    console.error(`[data-service] ${unexpectedFormatError}`, queryResult);
    return { error: unexpectedFormatError };

  } catch (e: any) {
    console.error('[data-service] Exception during query execution:', e.message);
    return { error: `Query execution failed with exception: ${e.message}` };
  }
}
