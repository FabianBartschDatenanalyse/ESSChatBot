'use server';

/**
 * @fileOverview A Genkit tool for generating and executing SQL queries.
 *
 * This file defines the `executeQueryTool`, which allows an AI agent to
 * query a database. The tool takes a natural language query, converts
 * it to SQL, executes it, and returns the result.
 */

import { ai, isAiConfigured, missingAiMessage } from '@/src/ai/genkit';
import { executeQuery } from '@/src/lib/data-service';
import { z, Message } from 'genkit';
import { suggestSqlQuery, type SuggestSqlQueryOutput } from '@/src/ai/flows/suggest-sql-query';
import { DatasetToolContextSchema } from '@/src/features/datasets/types';

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
  dataset: DatasetToolContextSchema,
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

    if (!isAiConfigured) {
      return safeReturn({
        error: missingAiMessage,
        sqlQuery,
        injectedSql,
        retrievedContext,
      });
    }

    try {
      // Step 1: Use dataset metadata as authoritative context.
      const tableName = input.dataset.tableName;
      retrievedContext = input.dataset.context;
      const allowedColumns = input.dataset.columns.map((column) => column.name);

      // Step 2: Generate SQL from question + context
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook: retrievedContext,
          history: input.history,
          allowedColumns,
          tableName,
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
        const fallbackColumns = allowedColumns.slice(0, 3);
        if (!fallbackColumns.length) {
          const out = {
            error: 'Dataset does not expose any columns to build a SQL query.',
            sqlQuery: '',
            injectedSql: '',
            retrievedContext: retrievedContext || '',
          };
          return safeReturn(out);
        }

        const placeholderSelect = fallbackColumns.map((column) => `"${column}"`).join(', ');
        sqlQuery = `SELECT ${placeholderSelect}
FROM "${tableName}"
LIMIT 50
-- TODO: Adjust columns/filters/aggregations to answer: ${JSON.stringify(input.nlQuestion)}`;
        injectedSql = sqlQuery;
      }

      // Step 3: Execute SQL
      const result = await executeQuery(sqlQuery, input.dataset.id);

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
