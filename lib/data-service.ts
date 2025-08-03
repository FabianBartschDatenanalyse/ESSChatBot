'use server';

import { supabase } from './supabase';

/**
 * Executes a read-only SQL query against the Supabase database.
 * This function is designed to be safe and only allow SELECT statements.
 *
 * @param query The SQL query string to execute.
 * @returns A promise that resolves to an object containing either 'data' or 'error'.
 */
export async function executeQuery(query: string): Promise<{ data?: any[], error?: string }> {
  console.log('[data-service] Executing query:', query);

  if (!supabase) {
    const error = "Supabase client is not initialized. Please check your environment variables.";
    console.error(`[data-service] ${error}`);
    return { error };
  }

  try {
    // Call the Supabase database function `execute_safe_query`.
    const { data: rpcResponse, error: rpcError } = await supabase
      .rpc('execute_safe_query', { query_text: query });

    if (rpcError) {
      console.error('[data-service] Supabase RPC error:', rpcError.message);
      return { error: `Supabase RPC call failed: ${rpcError.message}` };
    }
    
    if (!rpcResponse) {
      const errorMessage = 'Received null or empty response from database function.';
      console.error(`[data-service] ${errorMessage}`);
      return { error: errorMessage };
    }
    
    // The rpcResponse is the direct JSON object from the function: { status: '...', data: [...] or error: '...' }
    console.log('[data-service] Response from database function:', JSON.stringify(rpcResponse, null, 2));
    
    if (rpcResponse.status === 'error') {
      console.error('[data-service] Database function returned error:', rpcResponse.error);
      return { error: rpcResponse.error };
    }

    if (rpcResponse.status === 'success' && rpcResponse.data) {
      if (!Array.isArray(rpcResponse.data)) {
          const unexpectedFormatError = 'Data from database function is not an array.';
          console.error(`[data-service] ${unexpectedFormatError}`, rpcResponse.data);
          return { error: unexpectedFormatError };
      }
      
      console.log(`[data-service] Success. Returning ${rpcResponse.data.length} rows.`);
      return { data: rpcResponse.data };
    }

    // Fallback for unexpected response structures
    const unexpectedFormatError = 'Received an unexpected response format from the database function.';
    console.error(`[data-service] ${unexpectedFormatError}`, rpcResponse);
    return { error: unexpectedFormatError };

  } catch (e: any) {
    console.error('[data-service] Exception during query execution:', e.message);
    return { error: `Query execution failed with exception: ${e.message}` };
  }
}
