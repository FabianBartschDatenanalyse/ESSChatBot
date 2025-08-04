'use server';

import { supabase } from './supabase';

/**
 * Executes a read-only SQL query against the Supabase database
 * using a protected Postgres function `execute_safe_query`.
 * @param query The SQL query string to execute.
 * @returns A promise that resolves to an object containing either `data` or an `error` string.
 */
export async function executeQuery(query: string): Promise<{ data?: any[]; error?: string }> {
  console.log('[data-service] Executing query:', query);

  try {
    const { data: rpcResponse, error: rpcError } = await supabase
      .rpc('execute_safe_query', { query_text: query });

    if (rpcError) {
      console.error('[data-service] Supabase RPC error:', rpcError.message);
      return { error: `Supabase RPC call failed: ${rpcError.message}` };
    }
    
    // In our setup, the response from the RPC function is the result itself.
    const queryResult = rpcResponse;

    if (!queryResult) {
      const errorMessage = 'Received null or empty response from database function.';
      console.error(`[data-service] ${errorMessage}`);
      return { error: errorMessage };
    }
    
    console.log('[data-service] Response from database function:', JSON.stringify(queryResult, null, 2));
    
    if (queryResult.status === 'error') {
      console.error('[data-service] Database function returned error:', queryResult.error);
      return { error: queryResult.error };
    }

    if (queryResult.status === 'success') {
      console.log('[data-service] Success. Returning data.');
      return { data: queryResult.data };
    }

    // This case should ideally not be reached if the DB function is consistent.
    const unexpectedFormatError = 'Received an unexpected response format from the database function.';
    console.error(`[data-service] ${unexpectedFormatError}`, queryResult);
    return { error: unexpectedFormatError };

  } catch (e: any) {
    console.error('[data-service] Exception during query execution:', e.message);
    return { error: `Query execution failed with exception: ${e.message}` };
  }
}
