
// To run this script, use the command: `npx tsx scripts/embed-codebook.ts`
// Make sure you have your .env file set up with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and OPENAI_API_KEY

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { v4 as uuidv4 } from 'uuid';

config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables in .env file');
}

if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable in .env file');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: OPENAI_API_KEY,
  model: 'text-embedding-3-small',
});

async function main() {
  console.log('Starting codebook embedding process...');

  try {
    // 1. Load the codebook content
    console.log('Loading codebook from codebook-import.txt...');
    const content = await fs.readFile('codebook-import.txt', 'utf-8');
    if (!content) {
        throw new Error('codebook-import.txt is empty or could not be read.');
    }
    console.log(`Loaded ${content.length} characters.`);

    // 2. Split the text into chunks
    console.log('Splitting text into chunks...');
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 100,
    });
    const chunks = await splitter.createDocuments([content]);
    console.log(`Created ${chunks.length} document chunks.`);

    // 3. Clear existing documents in the table
    console.log('Clearing existing documents from the "documents" table...');
    const { error: deleteError } = await supabase.from('documents').delete().neq('id', uuidv4()); // Trick to delete all rows
    if (deleteError) {
        console.error('Error deleting existing documents:', deleteError);
        // We can continue even if this fails, might just result in duplicates
    } else {
        console.log('Successfully cleared existing documents.');
    }

    // 4. Create embeddings and store in Supabase
    console.log('Generating embeddings and uploading to Supabase...');
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embeddingVector = await embeddings.embedQuery(chunk.pageContent);

        const { error } = await supabase.from('documents').insert({
            id: uuidv4(),
            content: chunk.pageContent,
            metadata: chunk.metadata,
            embedding: embeddingVector,
        });

        if (error) {
            console.error(`Error inserting chunk ${i + 1}/${chunks.length}:`, error);
        } else {
            console.log(`Successfully embedded and stored chunk ${i + 1}/${chunks.length}.`);
        }
    }

    console.log('\n✅ Codebook embedding process completed successfully!');
    console.log('You can now use the vector search in your application.');

  } catch (error) {
    console.error('\n❌ An error occurred during the embedding process:');
    console.error(error);
  }
}

main();
