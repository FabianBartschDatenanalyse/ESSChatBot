# Problembeschreibung für den AI-Chatbot

Hallo! Ich habe ein Problem in meiner Next.js-Anwendung, bei dem eine SQL-Abfrage an eine Supabase-Datenbank zwar erfolgreich ausgeführt wird, aber in der Benutzeroberfläche keine Daten angezeigt werden.

**Der Fehler:**
Die Anwendung erhält konsistent eine leere Datenantwort (`"results": [{"columns": [], "rows": []}]`), obwohl die SQL-Abfrage korrekt ist und bei direkter Ausführung in der Supabase-Datenbank Daten zurückgibt. Ein häufiges Problem war die fehlerhafte Maskierung von Anführungszeichen (z.B. `\"ESS1\"` anstatt `"ESS1"`), was zu Syntaxfehlern führte. Obwohl dies behoben zu sein scheint, bleibt das Kernproblem bestehen.

**Die Aufgabe:**
Bitte analysieren Sie die folgenden Code-Dateien, um die Ursache für die fehlende Datenanzeige zu finden und eine Lösung vorzuschlagen.

---

## 1. Supabase-Datenbankfunktion (`execute_safe_query`)

Dies ist der SQL-Code für die Funktion in der Supabase-Datenbank, die die Abfragen sicher ausführt.

```sql
-- Create or replace the function to execute safe, read-only SELECT queries.
CREATE OR REPLACE FUNCTION execute_safe_query(query_text TEXT)
RETURNS JSON -- The function will return a single JSON object.
LANGUAGE plpgsql
AS $$
DECLARE
    -- Variable to hold the JSON result of the query.
    query_result JSON;
    -- Variable to hold the final JSON response, including status.
    response JSON;
BEGIN
    -- Check if the query is a read-only SELECT statement.
    IF lower(query_text) LIKE 'select%' THEN
        -- Execute the query and aggregate the results into a single JSON array.
        EXECUTE format('SELECT json_agg(t) FROM (%s) t', query_text)
        INTO query_result;

        -- Construct a success response object.
        response := json_build_object(
            'status', 'success',
            'data', coalesce(query_result, '[]'::json)
        );
    ELSE
        -- If the query is not a SELECT statement, construct an error response.
        response := json_build_object(
            'status', 'error',
            'error', 'Only SELECT queries are allowed.'
        );
    END IF;

    -- Return the final JSON response.
    RETURN response;
EXCEPTION
    -- Catch any SQL errors during execution.
    WHEN others THEN
        -- Construct a detailed error response.
        response := json_build_object(
            'status', 'error',
            'error', SQLERRM
        );
        -- Return the error response.
        RETURN response;
END;
$$;
```

---

## 2. Hauptassistenten-Flow (`src/ai/flows/main-assistant-flow.ts`)

Dieser Flow orchestriert die Antwort des Assistenten.

```typescript
'use server';
/**
 * @fileOverview The main AI assistant agent.
 *
 * This file defines the primary agent for the application. The agent is responsible for
 * orchestrating responses to user queries. It can decide whether to use tools (like querying
 * the database) or answer from its general knowledge based on the user's question.
 *
 * - mainAssistant - The primary function that powers the AI assistant.
 * - MainAssistantInput - The input type for the mainAssistant function.
 * - MainAssistantOutput - The return type for the mainAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { executeQueryTool } from '../tools/sql-query-tool';

const MainAssistantInputSchema = z.object({
  question: z.string().describe('The user\'s question.'),
  codebook: z.string().describe('The database codebook for context.'),
});
export type MainAssistantInput = z.infer<typeof MainAssistantInputSchema>;

const MainAssistantOutputSchema = z.object({
  answer: z.string().describe('The final answer to be displayed to the user.'),
});
export type MainAssistantOutput = z.infer<typeof MainAssistantOutputSchema>;

export async function mainAssistant(input: MainAssistantInput): Promise<MainAssistantOutput> {
  return mainAssistantFlow(input);
}

const mainAssistantFlow = ai.defineFlow(
  {
    name: 'mainAssistantFlow',
    inputSchema: MainAssistantInputSchema,
    outputSchema: MainAssistantOutputSchema,
  },
  async (input) => {
    
    const initialPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).
Your goal is to answer the user's question as accurately as possible.
You have access to a tool that can query the ESS database directly.

Here is the database codebook to help you understand the available data:
--- CODEBOOK START ---
${input.codebook}
--- CODEBOOK END ---

User's question: "${input.question}"

First, analyze the user's question.
- If the question can be answered by querying the data (e.g., "what is the average...", "show me data for...", "compare countries..."), you MUST use the executeQueryTool.
- If the question is about the codebook itself, the survey's methodology, or a general question, answer it directly without using the tool.

When you receive the result from the 'executeQueryTool', you MUST follow these instructions:
- If the result contains a 'data' array with items, analyze the data and formulate a comprehensive, easy-to-understand answer for the user.
- If the result contains an empty 'data' array, inform the user that the query was successful but returned no data.
- If the result contains an 'error' field, you MUST display the error message to the user.
- In all cases where the tool was used, you MUST also display the exact SQL query that was used to retrieve the data. Enclose the query in a markdown code block.`;

    const llmResponse = await ai.generate({
      model: 'openai/gpt-4o',
      prompt: initialPrompt,
      tools: [executeQueryTool],
    });
    
    const textContent = llmResponse.text;
    
    if (textContent) {
      return { answer: textContent };
    }

    throw new Error("The model did not return a valid response.");
  }
);
```

---

## 3. SQL-Abfragewerkzeug (`src/ai/tools/sql-query-tool.ts`)

Dieses Werkzeug ruft den `suggestSqlQuery`-Flow und den `executeQuery`-Service auf.

```typescript
'use server';

/**
 * @fileOverview A Genkit tool for generating and executing SQL queries.
 *
 * This file defines the `executeQueryTool`, which allows an AI agent to
 * query a database. The tool takes a natural language query, converts
 * it to SQL, executes it, and returns the result.
 */

import { ai } from '@/ai/genkit';
import { executeQuery } from '@/lib/data-service';
import { z } from 'zod';
import { suggestSqlQuery, type SuggestSqlQueryOutput } from '../flows/suggest-sql-query';
import { getCodebookAsString } from '@/lib/codebook';

const toolOutputSchema = z.object({
  sqlQuery: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language query as input.',
    inputSchema: z.object({
      nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    }),
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery = '';

    try {
      const codebook = getCodebookAsString();

      // Step 1: Generate SQL
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook,
        });
        sqlQuery = suggestion.sqlQuery;
      } catch (suggestionError: any) {
        const errorMsg = `❌ Failed to generate SQL query. Error: ${suggestionError.message || 'Unknown error'}`;
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg };
      }

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = '❌ AI model returned an empty SQL query.';
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg, sqlQuery };
      }

      // Step 2: Execute SQL
      const result = await executeQuery(sqlQuery);
      
      if (result.error) {
        console.error('[executeQueryTool] Query execution failed:', result.error);
        return { error: `❌ Query execution failed: ${result.error}`, sqlQuery };
      }

      if (result.data) {
         if (result.data.length > 0) {
            return { data: result.data, sqlQuery };
         } else {
            console.warn('[executeQueryTool] SQL executed successfully, but no usable data returned.');
            return { data: [], sqlQuery };
         }
      }
      
      return { error: 'No data or error returned from executeQuery', sqlQuery };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in executeQueryTool: ${e.message || 'Unknown error'}`;
      console.error('[executeQueryTool]', errorMsg);
      return { error: errorMsg, sqlQuery };
    }
  }
);
```

---

## 4. Datenservice (`src/lib/data-service.ts`)

Diese Datei ist für die direkte Kommunikation mit Supabase verantwortlich.

```typescript
'use server';

import { supabase } from './supabase';

export async function executeQuery(query: string): Promise<{ data?: any[], error?: string }> {
  console.log('[data-service] Executing query:', query);

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
    
    // The rpcResponse is the direct JSON object from the function
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
```

---

## 5. SQL-Vorschlags-Flow (`src/ai/flows/suggest-sql-query.ts`)

Dieser Flow generiert die SQL-Abfrage aus der natürlichen Sprache.

```typescript
'use server';

/**
 * @fileOverview An AI agent that suggests SQL queries based on a natural language question.
 *
 * - suggestSqlQuery - A function that suggests SQL queries.
 * - SuggestSqlQueryInput - The input type for the suggestSqlQuery function.
 * - SuggestSqlQueryOutput - The return type for the suggestSqlQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestSqlQueryInputSchema = z.object({
  question: z.string().describe('The natural language question to generate a SQL query for.'),
  codebook: z.string().describe('The database codebook to use to construct the query.'),
});
export type SuggestSqlQueryInput = z.infer<typeof SuggestSqlQueryInputSchema>;

const SuggestSqlQueryOutputSchema = z.object({
  sqlQuery: z.string().describe('The suggested SQL query based on the question.'),
});
export type SuggestSqlQueryOutput = z.infer<typeof SuggestSqlQueryOutputSchema>;

export async function suggestSqlQuery(input: SuggestSqlQueryInput): Promise<SuggestSqlQueryOutput> {
  return suggestSqlQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSqlQueryPrompt',
  input: {schema: SuggestSqlQueryInputSchema},
  output: {schema: SuggestSqlQueryOutputSchema},
  model: 'openai/gpt-4o',
  prompt: `You are an expert SQL query generator. You will be given a natural language question and a database codebook.

  You will generate a SQL query that answers the question using the codebook.
  
  RULES:
  1. The table name is "ESS1" and MUST be enclosed in double quotes.
  2. The generated SQL query MUST NOT end with a semicolon.
  3. When performing mathematical operations (like AVG, SUM, etc.) on a column, you MUST cast it to a numeric type (e.g., CAST(column_name AS NUMERIC)).
  4. Do not put double quotes around column names, only around the table name "ESS1".

  Question: {{{question}}}
  Codebook: {{{codebook}}}

  SQL Query: `,
});


const suggestSqlQueryFlow = ai.defineFlow(
  {
    name: 'suggestSqlQueryFlow',
    inputSchema: SuggestSqlQueryInputSchema,
    outputSchema: SuggestSqlQueryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
```

---

## 6. package.json

```json
{
  "name": "nextn",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack -p 9002",
    "genkit:dev": "genkit start -- tsx src/ai/dev.ts",
    "genkit:watch": "genkit start -- tsx --watch src/ai/dev.ts",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hookform/resolvers": "^4.1.3",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-menubar": "^1.1.6",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@supabase/supabase-js": "^2.45.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "dotenv": "^16.5.0",
    "embla-carousel-react": "^8.6.0",
    "firebase": "^11.9.1",
    "genkit": "^1.14.1",
    "genkitx-openai": "latest",
    "lucide-react": "^0.475.0",
    "next": "15.3.3",
    "papaparse": "^5.4.1",
    "patch-package": "^8.0.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.2",
    "recharts": "^2.15.1",
    "sql.js": "^1.10.3",
    "tailwind-merge": "^3.0.1",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/papaparse": "^5.3.14",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/sql.js": "^1.4.9",
    "genkit-cli": "^1.14.1",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```
