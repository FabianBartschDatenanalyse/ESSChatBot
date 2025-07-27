'use server';

/**
 * @fileOverview A Genkit tool for performing statistical analyses by calling a Python backend.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { executeQuery } from '@/lib/data-service';

// Schema for the data structure required by the Python regression service
const RegressionRequestSchema = z.object({
  formula: z.string().describe('The regression formula, e.g., "trstprl ~ female + agec".'),
  data: z.record(z.array(z.number())).describe('Column-oriented data for the regression.'),
});

const toolInputSchema = z.object({
  target: z.string().describe('The target (dependent) variable for the analysis. Must be a single column name.'),
  features: z.array(z.string()).describe('A list of one or more feature (independent) variables. Must be column names.'),
  filters: z.record(z.string(), z.any()).optional().describe('Key-value pairs to filter the dataset. E.g., { "cntry": "DE" }.'),
  codebookContext: z.string().describe('Relevant context from the database codebook.'),
});

const toolOutputSchema = z.object({
  result: z.any().optional(),
  error: z.string().optional(),
  sqlQuery: z.string().optional().describe("The SQL query used to fetch the data for analysis.")
});

export const statisticsTool = ai.defineTool(
  {
    name: 'statisticsTool',
    description: 'Use this tool to perform multiple linear regression. Provide a target variable, feature variables, and optional filters.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    console.log('[statisticsTool] Received input:', JSON.stringify(input, null, 2));
    let sqlQuery = '';

    try {
      // 1. Construct the SQL query to fetch raw data
      const allColumns = Array.from(new Set([input.target, ...input.features]));
      sqlQuery = `SELECT ${allColumns.map(c => `${c}`).join(', ')} FROM "ESS1"`;

      const whereClauses: string[] = [];
      if (input.filters) {
        for (const [key, value] of Object.entries(input.filters)) {
          whereClauses.push(`${key} = '${value}'`);
        }
      }
      // Add generic filters to exclude common missing values
      for (const col of allColumns) {
         if (col === 'gndr') {
            whereClauses.push(`gndr IN ('1','2')`);
         } else {
            whereClauses.push(`${col} NOT IN ('7','8','9','55','66','77','88','99','555','777','888','999','9999')`);
         }
      }

      if (whereClauses.length > 0) {
        sqlQuery += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      console.log('[statisticsTool] Step 1: Constructed SQL Query:', sqlQuery);

      // 2. Fetch data from Supabase
      console.log('[statisticsTool] Step 2: Fetching data from Supabase...');
      const { data: queryData, error: queryError } = await executeQuery(sqlQuery);

      if (queryError) {
        console.error('[statisticsTool] Error fetching data:', queryError);
        return { error: `SQL query failed: ${queryError}`, sqlQuery };
      }
      if (!queryData || queryData.length === 0) {
        console.warn('[statisticsTool] No data available for analysis after filtering.');
        return { error: 'Not enough data available for analysis after filtering.', sqlQuery };
      }
      console.log(`[statisticsTool] Successfully fetched ${queryData.length} rows.`);
      
      // 3. Transform data for the Python service (row-wise filtering)
      console.log('[statisticsTool] Step 3: Transforming data for Python service...');
      const cols = allColumns.slice(); // copy
      const typedRows = [] as Record<string, number>[];

      for (const raw of queryData) {
        const row: Record<string, number> = {};
        let ok = true;
        for (const c of cols) {
          const v = parseFloat(raw[c]);
          if (!Number.isFinite(v)) { ok = false; break; }
          row[c] = v;
        }
        if (ok) typedRows.push(row);
      }

      if (typedRows.length < 10) {
        console.warn('[statisticsTool] Not enough clean rows after numeric parsing.');
        return { error: 'Not enough clean rows after numeric parsing.', sqlQuery };
      }
      console.log(`[statisticsTool] Transformed data into ${typedRows.length} clean rows.`);

      // Feature engineering for formula consistency:
      const hasGndr = cols.includes('gndr');
      const hasAgea = cols.includes('agea');

      let meanAge = 0;
      if (hasAgea) {
        meanAge = typedRows.reduce((s, r) => s + r.agea, 0) / typedRows.length;
        console.log(`[statisticsTool] Calculated mean age: ${meanAge}`);
      }

      for (const r of typedRows) {
        if (hasGndr) r.female = r.gndr === 2 ? 1 : 0;
        if (hasAgea) r.agec = r.agea - meanAge;
      }
      console.log(`[statisticsTool] Feature engineering complete (female, agec).`);

      // Build column-oriented data with equal lengths
      const columnData: Record<string, number[]> = {};
      const requiredCols = new Set<string>(cols);
      if (hasGndr) requiredCols.add('female');
      if (hasAgea) requiredCols.add('agec');

      for (const c of requiredCols) columnData[c] = [];
      for (const r of typedRows) {
          for (const c of requiredCols) {
              if (r[c] !== undefined) columnData[c].push(r[c]);
          }
      }
      console.log('[statisticsTool] Converted data to column-oriented format.');

      // Decide which formula to use based on desired features
      let formula: string;
      if (input.features.includes('gndr') || input.features.includes('agea')) {
        formula = `${input.target} ~ ${[
          input.features.includes('gndr') ? 'female' : null,
          input.features.includes('agea') ? 'agec' : null,
          ...input.features.filter(f => f !== 'gndr' && f !== 'agea')
        ].filter(Boolean).join(' + ')}`;
      } else {
        formula = `${input.target} ~ ${input.features.join(' + ')}`;
      }
      console.log(`[statisticsTool] Generated regression formula: ${formula}`);

      // 4. Call the Python regression service with timeout & clearer errors
      console.log('[statisticsTool] Step 4: Calling Python regression service...');
      const pythonServiceBaseUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
      const pythonServiceUrl = new URL('/regress', pythonServiceBaseUrl).toString();

      console.log(`[statisticsTool] Service URL: ${pythonServiceUrl}`);
      const payload = { formula, data: columnData };
      console.log(`[statisticsTool] Payload size: ${JSON.stringify(payload).length} bytes`);


      const ctrl = new AbortController();
      const to = setTimeout(() => {
        console.error('[statisticsTool] Request timed out after 15s.');
        ctrl.abort('timeout');
      }, 15000); // 15s timeout

      let response: Response;
      try {
        response = await fetch(pythonServiceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
      } catch (netErr: any) {
        clearTimeout(to);
        console.error(`[statisticsTool] Fetch failed. Error: ${netErr?.message || netErr}`);
        return { error: `Cannot reach analysis service at ${pythonServiceUrl}: ${netErr?.message || netErr}`, sqlQuery };
      }
      clearTimeout(to);

      console.log(`[statisticsTool] Received response with status: ${response.status}`);
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Could not read error body.');
        console.error(`[statisticsTool] Analysis service returned an error. Status: ${response.status}, Body: ${errorBody}`);
        return { error: `Analysis service HTTP ${response.status}: ${errorBody || 'no body'}`, sqlQuery };
      }

      const result = await response.json().catch(e => {
        console.error('[statisticsTool] Failed to parse JSON from analysis service:', e);
        return { error: `Invalid JSON from analysis service: ${String(e)}` };
      });

      console.log('[statisticsTool] Successfully received and parsed result from analysis service.');
      return { result, sqlQuery };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in statisticsTool: ${e.message || 'Unknown error'}`;
      console.error('[statisticsTool]', errorMsg, e.stack);
      return { error: errorMsg, sqlQuery };
    }
  }
);
