'use server';

/**
 * @fileOverview A Genkit tool for generating and executing SQL queries.
 *
 * This file defines the `executeQueryTool`, which allows an AI agent to
 * query a database. The tool takes a natural language query, converts
 * it to SQL, executes it, and returns the result.
 */

import { ai } from '@/src/ai/genkit';
import { executeQuery } from '@/src/lib/data-service';
import { z, Message } from 'genkit';
import { suggestSqlQuery, type SuggestSqlQueryOutput } from '@/src/ai/flows/suggest-sql-query';
import { searchCodebook } from '@/src/lib/vector-search';

/* ----------------------- Helpers: Plain JSON Sanitizing ----------------------- */

function toPlain(value: any): any {
  if (value == null) return value;
  const t = typeof value;

  if (t === 'bigint') return value.toString();               // BigInt → string
  if (t === 'number' || t === 'string' || t === 'boolean') return value;

  if (value instanceof Date) return value.toISOString();     // Date → ISO
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(value)) {
    return value.toString('base64');                         // Buffer → base64
  }
  if (value instanceof Set) return Array.from(value, (v) => toPlain(v)); // Set → Array
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries(), ([k, v]) => [String(k), toPlain(v)]));
  }
  if (Array.isArray(value)) return value.map((v) => toPlain(v));

  // Plain object?
  if (t === 'object') {
    const ctor = value.constructor;
    if (!ctor || ctor === Object) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
    }
    // Fallback for class instances: best-effort plainification
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }

  return value;
}

/** Final safety net to ensure the object is JSON-serializable. */
function safeReturn<T>(obj: T): T {
  // throws if non-serializable (e.g., circular refs); keeps us honest during dev
  try { structuredClone(obj); } catch {}
  return JSON.parse(JSON.stringify(obj)) as T;
}

/* ----------------------------- Zod Schemas ----------------------------------- */

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
});

const toolInputSchema = z.object({
  nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
  history: z.array(MessageSchema).optional().describe('The conversation history.'),
});

const toolOutputSchema = z.object({
  // Always include these fields for downstream visibility
  sqlQuery: z.string().default(''),
  injectedSql: z.string().default(''),
  retrievedContext: z.string().default(''),
  data: z.any().optional(),     // will be plainified before returning
  error: z.string().optional(), // always a string
});

/* ------------------------------ Tool Impl ------------------------------------ */

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description:
      'Use this tool to query the database to answer user questions about the data. Takes a natural language question and optional conversation history as input.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery: string = '';
    let injectedSql: string = '';
    let retrievedContext: string = '';

    try {
      // Step 1: Retrieve relevant context from the vector database.
      const searchResults = await searchCodebook(input.nlQuestion, 7);
      retrievedContext = searchResults
        .map((result) => `- ${result.content}`)
        .join('\n');

      // Step 2: Generate SQL from question + context
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook: retrievedContext,
          history: input.history,
        });
        sqlQuery = suggestion.sqlQuery;
        injectedSql = sqlQuery || injectedSql;
      } catch (suggestionError: any) {
        const out = {
          error: `❌ Failed to generate SQL query. Error: ${suggestionError?.message || 'Unknown error'}`,
          sqlQuery: sqlQuery || '',
          injectedSql: injectedSql || '',
          retrievedContext: retrievedContext || '',
        };
        return safeReturn(out);
      }

      if (!sqlQuery || sqlQuery.trim() === '') {
        // Best-effort template if the LLM did not return SQL
        const matches = (retrievedContext.match(/\b[a-zA-Z_][a-zA-Z0-9_]{1,30}\b/g) || [])
          .filter((w) =>
            ![
              'the','and','or','for','is','are','of','to','in','by','with','as','on','at',
              'be','an','a','this','that','these','those','from','not','no','yes','it','its',
              'if','then','else','when','where','which','was','were','has','have','had','can',
              'could','should','would','may','might','will','shall','data','variable','codebook',
              'column','columns','table','ess1','ESS1',
            ].includes(w.toLowerCase())
          )
          .slice(0, 6);

        const prioritized = ['cntry', 'agea', 'gndr'].filter((c) =>
          retrievedContext.toLowerCase().includes(c)
        );
        const placeholderColumns = Array.from(new Set([...prioritized, ...matches]));
        const cols = placeholderColumns.length > 0 ? placeholderColumns : ['cntry'];

        const placeholderSelect = cols.map((c) => `CAST(${c} AS NUMERIC) AS ${c}`).join(', ');
        const missingCodes = `'77','88','99'`;

        sqlQuery = `SELECT ${placeholderSelect}
FROM "ESS1"
WHERE ${cols[0]} NOT IN (${missingCodes})
-- TODO: Adjust columns/filters/aggregations to answer: ${JSON.stringify(input.nlQuestion)}
-- Context excerpt:
-- ${retrievedContext.slice(0, 400).replace(/\n/g, ' ')}`;
        injectedSql = sqlQuery;
      }

      // Step 3: Execute SQL
      const result = await executeQuery(sqlQuery);

      if (result.error) {
        const out = {
          error: `❌ Query execution failed: ${String(result.error)}`,
          sqlQuery: sqlQuery || '',
          injectedSql: injectedSql || '',
          retrievedContext: retrievedContext || '',
        };
        return safeReturn(out);
      }

      if (result.data) {
        const plainData = toPlain(result.data);
        const out = {
          data: plainData,
          sqlQuery: sqlQuery || '',
          injectedSql: injectedSql || '',
          retrievedContext: retrievedContext || '',
        };
        return safeReturn(out);
      }

      // Unexpected shape
      return safeReturn({
        error: 'No data or error returned from executeQuery',
        sqlQuery: sqlQuery || '',
        injectedSql: injectedSql || '',
        retrievedContext: retrievedContext || '',
      });
    } catch (e: any) {
      return safeReturn({
        error: `💥 Unexpected error in executeQueryTool: ${e?.message || 'Unknown error'}`,
        sqlQuery: sqlQuery || '',
        injectedSql: injectedSql || '',
        retrievedContext: retrievedContext || '',
      });
    }
  }
);
