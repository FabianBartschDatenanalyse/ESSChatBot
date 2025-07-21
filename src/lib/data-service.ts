'use server';

import { supabase } from './supabase-service-role'; // Use the service role client for direct queries

export async function executeQuery(query: string): Promise<{ data?: any[], error?: string }> {
  console.log('[data-service] Executing query:', query);
  
  if (!supabase) {
    const error = "Supabase client is not initialized. Please check your environment variables."
    console.error(`[data-service] ${error}`);
    return { error };
  }

  try {
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
    
    // The rpcResponse is the direct JSON object from the function: { status: '...', data: [...] }
    const queryResult = rpcResponse;
    console.log('[data-service] Response from database function:', JSON.stringify(queryResult, null, 2));
    
    if (queryResult.status === 'error') {
      console.error('[data-service] Database function returned error:', queryResult.error);
      return { error: queryResult.error };
    }

    if (queryResult.status === 'success') {
      console.log('[data-service] Success. Returning data.');
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
