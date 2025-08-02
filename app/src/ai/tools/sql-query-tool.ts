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

const toolInputSchema = z.object({
    nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    codebookContext: z.string().describe('Relevant context from the database codebook to use to construct the query.'),
});

const toolOutputSchema = z.object({
  // Always return a sqlQuery string so the UI can reliably display it
  sqlQuery: z.string().default(''),
  // Optionally return the context so UI can show it in details if desired
  retrievedContext: z.string().default(''),
  data: z.any().optional().describe("The data returned from the query."),
  error: z.string().optional().describe("An error message if the query failed, possibly containing debug logs."),
});

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language question and relevant codebook context as input.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery = '';
    const logs: string[] = ['[executeQueryTool] Received input: ' + JSON.stringify(input, null, 2)];
    
    try {
      // Step 1: Generate SQL using the provided question and retrieved context
      logs.push('Step 1: Generating SQL query...');
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook: input.codebookContext,
        });
        sqlQuery = suggestion.sqlQuery;
        logs.push(`Step 1 Complete: Generated SQL: ${sqlQuery}`);
      } catch (suggestionError: any) {
        logs.push(`❌ Failed to generate SQL query. Error: ${suggestionError.message || 'Unknown error'}`);
        console.error('[executeQueryTool]', logs[logs.length-1]);
        // Return required fields consistently
        return { error: logs.join('\n'), sqlQuery: sqlQuery || '', retrievedContext: input.codebookContext || '' };
      }

      // Provide a best-effort SQL template if the model returned empty
      if (!sqlQuery || sqlQuery.trim() === '') {
        logs.push('⚠️ AI model returned an empty SQL query. Providing best-effort template.');
        const context = input.codebookContext || '';
        // Heuristic extraction of likely columns
        const matches = (context.match(/\b[a-zA-Z_][a-zA-Z0-9_]{1,30}\b/g) || [])
          .filter(w => !['the','and','or','for','is','are','of','to','in','by','with','as','on','at','be','an','a','this','that','these','those','from','not','no','yes','it','its','if','then','else','when','where','which','was','were','has','have','had','can','could','should','would','may','might','will','shall','data','variable','codebook','column','columns','table','ess1','ESS1'].includes(w.toLowerCase()))
          .slice(0, 6);
        const prioritized = ['cntry','trstprl','agea','gndr'].filter(c => context.toLowerCase().includes(c));
        const cols = Array.from(new Set([...prioritized, ...matches]));
        const placeholderColumns = cols.length > 0 ? cols : ['cntry','trstprl'];
        const missingCodes = `'77','88','99'`;
        const selectList = placeholderColumns.map(c => `CAST(${c} AS NUMERIC) AS ${c}`).join(', ');
        sqlQuery = `SELECT ${selectList}
FROM "ESS1"
WHERE ${placeholderColumns[0]} NOT IN (${missingCodes})
-- TODO: Adjust selected columns based on the codebook context above.
-- TODO: Add proper WHERE filters to exclude missing/invalid values for each aggregated column.
-- TODO: Add GROUP BY (e.g., cntry) or aggregations (e.g., AVG(CAST(trstprl AS NUMERIC))) as needed to answer: ${JSON.stringify(input.nlQuestion)}
-- Context excerpt used to infer columns:
-- ${context.slice(0, 400).replace(/\n/g, ' ')}`;
        logs.push('Best-effort SQL template generated.');
      }
      
      // Step 2: Execute SQL
      logs.push('Step 2: Executing SQL query...');
      const result = await executeQuery(sqlQuery);
      
      if (result.error) {
        logs.push(`❌ Query execution failed: ${result.error}`);
        console.error('[executeQueryTool]', logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery: sqlQuery || '', retrievedContext: input.codebookContext || '' };
      }

      if (result.data) {
         if (result.data.length > 0) {
            logs.push(`Step 2 Complete: Query returned ${result.data.length} rows.`);
            console.log(`[executeQueryTool] Query returned ${result.data.length} rows.`);
            return { data: result.data, sqlQuery: sqlQuery || '', retrievedContext: input.codebookContext || '' };
         } else {
            logs.push('Step 2 Complete: SQL executed successfully, but no data was returned.');
            console.warn('[executeQueryTool]', logs[logs.length-1]);
            return { data: [], sqlQuery: sqlQuery || '', retrievedContext: input.codebookContext || '' };
         }
      }
      
      logs.push('❌ No data or error returned from executeQuery.');
      return { error: logs.join('\n'), sqlQuery: sqlQuery || '', retrievedContext: input.codebookContext || '' };

    } catch (e: any) {
      logs.push(`💥 Unexpected error in executeQueryTool: ${e.message || 'Unknown error'}`);
      console.error('[executeQueryTool]', logs[logs.length-1], e);
      return { error: logs.join('\n'), sqlQuery: sqlQuery || '', retrievedContext: input.codebookContext || '' };
    }
  }
);

    