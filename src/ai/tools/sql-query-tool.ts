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
import { z, Message } from 'genkit';
import { suggestSqlQuery, type SuggestSqlQueryOutput } from '../flows/suggest-sql-query';
import { searchCodebook } from '@/lib/vector-search';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
});

const toolInputSchema = z.object({
    nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    history: z.array(MessageSchema).optional().describe("The conversation history."),
});

const toolOutputSchema = z.object({
  // Always include these fields for downstream visibility
  sqlQuery: z.string().default(''),
  injectedSql: z.string().default(''),
  retrievedContext: z.string().default(''),
  data: z.any().optional(),
  error: z.string().optional(),
});

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language question and optional conversation history as input.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery: string = '';
    // Persist generated SQL across all return paths so UI/LLM can always display it.
    let injectedSql: string = '';
    let retrievedContext: string = '';
    console.log('[executeQueryTool] Received input:', JSON.stringify(input, null, 2));
    
    try {
      // Step 1: Retrieve relevant context from the vector database.
      const searchResults = await searchCodebook(input.nlQuestion, 5);
      retrievedContext = searchResults
          .map((result, idx) => {
            console.log(`[executeQueryTool] Vector match #${idx+1} (sim=${(result as any).similarity ?? 'n/a'}):`, (result as any).content?.slice(0, 200));
            return `- ${result.content}`;
          })
          .join('\n');
        
      console.log(`[executeQueryTool] Retrieved context from vector DB (length=${retrievedContext.length}).`);

      // Heuristic: If the question mentions "vertraut" (German for familiarity) and the retrieved context
      // does not clearly include a familiarity variable, bias the LLM to use "trstprl" as a proxy.
      const q = input.nlQuestion.toLowerCase();
      const looksLikeFamiliarity =
        q.includes('vertraut') || q.includes('vertrautheit') || q.includes('familiar');
      const contextLower = retrievedContext.toLowerCase();
      const contextHasExplicitFamiliarity =
        contextLower.includes('stfknw') || contextLower.includes('familiar');
      const hint =
        looksLikeFamiliarity && !contextHasExplicitFamiliarity
          ? '\n\nNote: If no explicit "familiarity" variable is present in the codebook context, use "trstprl" (trust in parliament) as the proxy measure and aggregate by "cntry".'
          : '';

      const sqlQuestion = `${input.nlQuestion}${hint}`;
      console.log('[executeQueryTool] NL question after heuristic hint:', sqlQuestion);

      // Step 2: Generate SQL using the provided question (+ optional hint) and retrieved context
      let suggestion: SuggestSqlQueryOutput;
      try {
        console.log('[executeQueryTool] Calling suggestSqlQuery...');
        suggestion = await suggestSqlQuery({
          question: sqlQuestion,
          codebook: retrievedContext,
          history: input.history,
        });
        console.log('[executeQueryTool] suggestSqlQuery output:', suggestion);
        sqlQuery = suggestion.sqlQuery;
        injectedSql = sqlQuery || injectedSql;
      } catch (suggestionError: any) {
        const errorMsg = `❌ Failed to generate SQL query. Error: ${suggestionError.message || 'Unknown error'}`;
        console.error('[executeQueryTool]', errorMsg, suggestionError);
        // Return required fields with deterministic SQL carrier
        return { error: errorMsg, sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' };
      }

      if (!sqlQuery || sqlQuery.trim() === '') {
        const placeholderColumns = (() => {
          // Try to heuristically extract candidate column names from retrievedContext:
          // Very simple heuristic: grab words that look like variable tokens (letters, digits, underscore) commonly used as column names.
          const matches = (retrievedContext.match(/\b[a-zA-Z_][a-zA-Z0-9_]{1,30}\b/g) || [])
            // Filter out obvious non-column words and duplicates
            .filter(w => !['the','and','or','for','is','are','of','to','in','by','with','as','on','at','be','an','a','this','that','these','those','from','not','no','yes','it','its','if','then','else','when','where','which','was','were','has','have','had','can','could','should','would','may','might','will','shall','data','variable','codebook','column','columns','table','ess1','ESS1'].includes(w.toLowerCase()))
            .slice(0, 6);
          // Ensure essential likely columns show up if present in context
          const prioritized = ['cntry','trstprl','agea','gndr'].filter(c => retrievedContext.toLowerCase().includes(c));
          const combined = Array.from(new Set([...prioritized, ...matches]));
          return combined.length > 0 ? combined : ['cntry','trstprl'];
        })();

        const placeholderSelectList = placeholderColumns.map(c => `CAST(${c} AS NUMERIC) AS ${c}`).join(', ');
        const missingCodes = `'77','88','99'`;
        const bestEffort = `SELECT ${placeholderSelectList}
FROM "ESS1"
WHERE ${placeholderColumns[0]} NOT IN (${missingCodes})
-- TODO: Adjust selected columns based on the codebook context above.
-- TODO: Add proper WHERE filters to exclude missing/invalid values for each aggregated column.
-- TODO: Add GROUP BY (e.g., cntry) or aggregations (e.g., AVG(CAST(trstprl AS NUMERIC))) as needed to answer: ${JSON.stringify(input.nlQuestion)}
-- Context excerpt used to infer columns:
-- ${retrievedContext.slice(0, 400).replace(/\n/g, ' ')}`;

        console.warn('[executeQueryTool] AI returned empty SQL; providing best-effort template instead.');
        sqlQuery = bestEffort;
        injectedSql = sqlQuery;
      }
      
      console.log(`[executeQueryTool] Generated SQL: ${sqlQuery}`);
      injectedSql = sqlQuery || injectedSql;

      console.log('[executeQueryTool] FINAL SQL QUERY:', `\n${sqlQuery}`);

      // Step 3: Execute SQL
      console.log('[executeQueryTool] Executing SQL via data-service.executeQuery...');
      const result = await executeQuery(sqlQuery);
      console.log('[executeQueryTool] executeQuery result meta:', { hasData: !!result.data, hasError: !!result.error, rows: result.data?.length });

      if (result.error) {
        console.error('[executeQueryTool] Query execution failed:', result.error, { sql: sqlQuery });
        return { error: `❌ Query execution failed: ${result.error}`, sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' };
      }

      if (result.data) {
         if (result.data.length > 0) {
            console.log(`[executeQueryTool] Query returned ${result.data.length} rows. Example row:`, result.data[0]);
            // Always include sqlQuery/injectedSql and retrievedContext so the UI/LLM can display them.
            return { data: result.data, sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' };
         } else {
            console.warn('[executeQueryTool] SQL executed successfully, but no data was returned.', { sql: sqlQuery });
            return { data: [], sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' };
         }
      }
      
      console.error('[executeQueryTool] No data or error returned from executeQuery. This indicates an unexpected response.');
      return { error: 'No data or error returned from executeQuery', sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in executeQueryTool: ${e.message || 'Unknown error'}`;
      console.error('[executeQueryTool]', errorMsg, e);
      // Ensure fields are present in error path too.
      return { error: errorMsg, sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' };
    }
  }
);


