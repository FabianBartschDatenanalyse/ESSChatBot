'use server';

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openAIApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseAnonKey || !openAIApiKey) {
  throw new Error('Missing Supabase or OpenAI environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const embeddings = new OpenAIEmbeddings({ openAIApiKey, model: 'text-embedding-3-small' });

/**
 * Searches the codebook for relevant context based on a user's query.
 * @param query The user's natural language question.
 * @param count The number of matching documents to return.
 * @returns A promise that resolves to an array of document contents.
 */
export async function searchCodebook(query: string, count: number): Promise<any[]> {
  try {
    const embedding = await embeddings.embedQuery(query);

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.7, // Adjust this threshold as needed
      match_count: count,
    });

    if (error) {
      console.error('Error matching documents:', error);
      return [];
    }

    return data;
  } catch (e: any) {
    console.error('Exception during vector search:', e.message);
    return [];
  }
}
