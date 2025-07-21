'use server';

import { supabase } from './supabase';

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
  console.log('[data-service] Executing query:', query);

  try {
    const { data: rpcResponseRaw, error: rpcError } = await supabase
      .rpc('execute_safe_query', { query_text: query });

    if (rpcError) {
      console.error('[data-service] Supabase RPC error:', rpcError.message);
      return { error: `Supabase RPC call failed: ${rpcError.message}` };
    }

    console.log('[data-service] Raw response from Supabase RPC:', JSON.stringify(rpcResponseRaw, null, 2));

    // Die RPC-Funktion gibt ein Array mit einem Objekt zurück, das wir extrahieren müssen
    const rpcResponse = Array.isArray(rpcResponseRaw) && rpcResponseRaw.length > 0
      ? rpcResponseRaw[0]
      : rpcResponseRaw;

    console.log('[data-service] Processed RPC response object:', JSON.stringify(rpcResponse, null, 2));

    if (!rpcResponse) {
      console.error('[data-service] Error: Received no or empty response from database function.');
      return { error: 'Received no or empty response from database function.' };
    }

    if (rpcResponse.status === 'error') {
      console.error('[data-service] Database function returned error:', rpcResponse.error);
      return { error: rpcResponse.error };
    }

    if (rpcResponse.status === 'success') {
      const resultData = rpcResponse.data;
      console.log('[data-service] Extracted data on success:', JSON.stringify(resultData, null, 2));

      if (!resultData || (Array.isArray(resultData) && resultData.length === 0)) {
        console.log('[data-service] Success, but no rows returned.');
        return { results: [{ columns: [], rows: [] }] };
      }

      const columns = Object.keys(resultData[0] || {});
      const formattedResults = {
        columns: columns,
        rows: resultData,
      };

      console.log('[data-service] Formatted results:', JSON.stringify(formattedResults, null, 2));
      return { results: [formattedResults] };
    }

    console.error('[data-service] Unexpected response format.');
    return { error: 'Received an unexpected response format from the database function.' };

  } catch (e: any) {
    console.error('[data-service] Exception during query execution:', e.message);
    return { error: `Query execution failed with exception: ${e.message}` };
  }
}
