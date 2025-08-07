'use server';

import { OpenAIEmbeddings } from '@langchain/openai';
import { supabase } from '@/src/lib/supabase'; // Use the public (anon) client

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: OPENAI_API_KEY,
  model: 'text-embedding-3-small',
});

/**
 * Searches the codebook for the most relevant sections to a given query.
 * @param query The user's question or query.
 * @param matchCount The number of relevant sections to return.
 * @returns A promise that resolves to an array of document sections.
 */
export async function searchCodebook(query: string, matchCount: number): Promise<{ content: string; similarity: number }[]> {
  if (!supabase) {
    console.error('Supabase client not initialized. Cannot perform vector search.');
    return [];
  }
  
  try {
    // 1. Create an embedding for the user's query
    const queryEmbedding = await embeddings.embedQuery(query);

    // 2. Query Supabase for matching documents
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: matchCount,
    });

    if (error) {
      console.error('Error matching documents in Supabase:', error);
      throw new Error(`Failed to perform vector search: ${error.message}`);
    }

    return data || [];
  } catch (e: any) {
    console.error('An exception occurred in searchCodebook:', e);
    // Return empty array on failure to avoid breaking the flow
    return [];
  }
}
