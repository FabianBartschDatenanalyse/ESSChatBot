'use server';

import { supabase } from './supabase';

/**
 * Executes a read-only SQL query against the Supabase database.
 * This function is designed to be safe and only allow SELECT statements.
 *
 * @param query The SQL query string to execute.
 * @returns A promise that resolves to an object containing either 'data' or 'error'.
 *          - 'data' is an array of objects, where each object represents a row.
 *          - 'error' is a string message if the query fails.
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
    
    // Handle cases where the RPC call succeeds but returns no data.
    if (!rpcResponse) {
      const errorMessage = 'Received null or empty response from the database function.';
      console.error(`[data-service] ${errorMessage}`);
      return { error: errorMessage };
    }
    
    // The rpcResponse is the direct JSON object from the function: { status: '...', data: [...] }
    const queryResult = rpcResponse;
    console.log('[data-service] Response from database function:', JSON.stringify(queryResult, null, 2));
    
    if (queryResult.status === 'error') {
      console.error('[data-service] Database function returned error:', queryResult.error);
      return { error: queryResult.error };
    }

    if (queryResult.status === 'success' && queryResult.data) {
      // The data is already in the correct format: array of objects
      if (!Array.isArray(queryResult.data)) {
          const unexpectedFormatError = 'Data from database function is not an array.';
          console.error(`[data-service] ${unexpectedFormatError}`, queryResult.data);
          return { error: unexpectedFormatError };
      }
      
      console.log(`[data-service] Success. Returning ${queryResult.data.length} formatted rows.`);
      return { data: queryResult.data };
    }

    const unexpectedFormatError = 'Received an unexpected response format from the database function.';
    console.error(`[data-service] ${unexpectedFormatError}`, queryResult);
    return { error: unexpectedFormatError };

  } catch (e: any) {
    console.error('[data-service] Exception during query execution:', e.message);
    return { error: `Query execution failed with exception: ${e.message}` };
  }
}
