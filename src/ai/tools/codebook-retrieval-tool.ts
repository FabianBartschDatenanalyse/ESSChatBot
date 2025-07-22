'use server';

/**
 * @fileOverview A Genkit tool for retrieving information from the codebook vector store.
 *
 * This file defines the `codebookRetrievalTool`, which allows an AI agent to
 * search the codebook for context relevant to a user's query.
 */

import { ai } from '@/ai/genkit';
import { searchCodebook } from '@/lib/vector-search';
import { z } from 'zod';

export const codebookRetrievalTool = ai.defineTool(
  {
    name: 'codebookRetrievalTool',
    description: 'Use this tool to retrieve information and context from the ESS codebook. Provide a query to search for relevant variables, descriptions, and values.',
    inputSchema: z.object({
      query: z.string().describe('A search query to find relevant information in the codebook (e.g., "trust in police", "political interest").'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    try {
      // We retrieve a decent number of results to give the LLM enough context.
      const searchResults = await searchCodebook(input.query, 5);

      if (!searchResults || searchResults.length === 0) {
        return 'No relevant information found in the codebook for that query.';
      }

      // Serialize the results into a string for the LLM to process.
      const serializedResults = searchResults
        .map(
          (doc) => `---
Content: ${doc.content}
(Similarity: ${doc.similarity.toFixed(2)})
---`
        )
        .join('\n\n');
      
      return serializedResults;

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in codebookRetrievalTool: ${e.message || 'Unknown error'}`;
      console.error('[codebookRetrievalTool]', errorMsg);
      // Return a descriptive error message to the LLM
      return errorMsg;
    }
  }
);
