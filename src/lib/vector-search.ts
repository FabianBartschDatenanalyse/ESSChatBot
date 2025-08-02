
'use server';

import { supabase } from './supabase';
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
});

// This is the function name we created in the Supabase SQL editor
const MATCH_FUNCTION = 'match_documents';
const MATCH_COUNT = 10;
const MATCH_THRESHOLD = 0.5;

export async function searchCodebook(query: string, count: number = MATCH_COUNT, threshold: number = MATCH_THRESHOLD) {
  const embedding = await embeddings.embedQuery(query);

  const { data, error } = await supabase.rpc(MATCH_FUNCTION, {
    query_embedding: embedding,
    match_count: count,
    match_threshold: threshold,
  });

  if (error) {
    console.error('[vector-search] Error matching documents:', error);
    throw new Error(`Failed to match documents: ${error.message}`);
  }
  
  return data || [];
}
