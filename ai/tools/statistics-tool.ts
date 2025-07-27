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
    const logs: string[] = ['[statisticsTool] Starting analysis.'];

    try {
      // 1. Construct the SQL query to fetch raw data
      const allColumns = Array.from(new Set([input.target, ...input.features]));
      sqlQuery = `SELECT ${allColumns.map(c => `${c}`).join(', ')} FROM "ESS1"`;
      logs.push(`Step 1: Constructed initial SELECT clause: SELECT ${allColumns.join(', ')} FROM "ESS1"`);


      const whereClauses: string[] = [];
      if (input.filters) {
        for (const [key, value] of Object.entries(input.filters)) {
          whereClauses.push(`${key} = '${value}'`);
        }
      }
      logs.push(`Added user-defined filters: ${JSON.stringify(input.filters) || 'None'}`);

      // Add generic filters to exclude common missing values
      for (const col of allColumns) {
         if (col === 'gndr') {
            whereClauses.push(`gndr IN ('1','2')`);
         } else {
            // This extensive list covers most specified missing values in the codebook
            whereClauses.push(`${col} NOT IN ('7', '8', '9', '55', '66', '77', '88', '99', '555', '777', '888', '999', '9999')`);
         }
      }
      logs.push('Added generic filters for missing values.');


      if (whereClauses.length > 0) {
        sqlQuery += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      logs.push(`Step 1 Complete: Final SQL Query: ${sqlQuery}`);
      console.log(logs[logs.length-1]);


      // 2. Fetch data from Supabase
      logs.push('Step 2: Fetching data from Supabase...');
      console.log(logs[logs.length-1]);
      const { data: queryData, error: queryError } = await executeQuery(sqlQuery);

      if (queryError) {
        logs.push(`❌ SQL query failed: ${queryError}`);
        console.error('[statisticsTool] Error fetching data:', queryError);
        return { error: logs.join('\n'), sqlQuery };
      }
      if (!queryData || queryData.length === 0) {
        logs.push('❌ No data available for analysis after filtering.');
        console.warn(logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery };
      }
      logs.push(`Step 2 Complete: Successfully fetched ${queryData.length} rows.`);
      console.log(logs[logs.length-1]);
      
      // 3. Transform data for the Python service (row-wise filtering and feature engineering)
      logs.push('Step 3: Transforming data for Python service...');
      console.log(logs[logs.length-1]);
      const typedRows: Record<string, number>[] = [];
      for (const raw of queryData) {
        const row: Record<string, number> = {};
        let ok = true;
        for (const col of allColumns) {
          const val = parseFloat(raw[col]);
          if (!Number.isFinite(val)) {
            ok = false;
            break;
          }
          row[col] = val;
        }
        if (ok) typedRows.push(row);
      }

      if (typedRows.length < 10) {
        logs.push(`❌ Not enough clean rows after numeric parsing. Found only ${typedRows.length}.`);
        console.warn(logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery };
      }
      logs.push(`Transformed data into ${typedRows.length} clean rows.`);

      // Feature engineering: female (from gndr) and agec (centered age from agea)
      const hasGndr = allColumns.includes('gndr');
      const hasAgea = allColumns.includes('agea');
      const engineeredFeatures: string[] = [];

      if (hasGndr) {
        engineeredFeatures.push('female');
        logs.push('Engineering feature: "female" from "gndr".');
      }
      if (hasAgea) {
        engineeredFeatures.push('agec');
        const meanAge = typedRows.reduce((sum, r) => sum + (r.agea || 0), 0) / typedRows.length;
        logs.push(`Engineering feature: "agec" from "agea". Calculated mean age: ${meanAge.toFixed(2)}`);
        for (const r of typedRows) r.agec = r.agea - meanAge;
      }
      if (hasGndr) {
         for (const r of typedRows) r.female = r.gndr === 2 ? 1 : 0;
      }
      
      // Build final column-oriented data payload
      const dataForPython: Record<string, number[]> = {};
      const finalFeatures = input.features.map(f => {
          if (f === 'gndr') return 'female';
          if (f === 'agea') return 'agec';
          return f;
      });
      const allFinalCols = Array.from(new Set([input.target, ...finalFeatures, ...input.features, ...engineeredFeatures]));
      
      allFinalCols.forEach(c => dataForPython[c] = []);
      for (const r of typedRows) {
        for(const c of allFinalCols) {
            if (r[c] !== undefined) dataForPython[c].push(r[c]);
        }
      }
      
      const formula = `${input.target} ~ ${finalFeatures.join(' + ')}`;
      logs.push(`Generated regression formula: ${formula}`);
      logs.push('Step 3 Complete: Data transformation finished.');
      console.log(logs[logs.length - 1]);


      // 4. Call the Python regression service
      logs.push('Step 4: Calling Python regression service...');
      console.log(logs[logs.length - 1]);
      const pythonServiceBaseUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
      const pythonServiceUrl = `${pythonServiceBaseUrl}/regress`;
      logs.push(`Service URL: ${pythonServiceUrl}`);
      console.log(logs[logs.length - 1]);

      const payload = { formula, data: dataForPython };
      logs.push(`Payload size: ${JSON.stringify(payload).length} bytes.`);
      console.log(logs[logs.length - 1]);


      let response: Response;
      try {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 15000); // 15s timeout
        
        response = await fetch(pythonServiceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        clearTimeout(timeoutId);

      } catch (netErr: any) {
        logs.push(`❌ Fetch to Python service failed. Error: ${netErr?.message || 'Unknown network error'}`);
        console.error('[statisticsTool] Fetch failed.', netErr);
        return { error: logs.join('\n'), sqlQuery };
      }

      logs.push(`Received response with status: ${response.status}`);
      console.log(logs[logs.length-1]);
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Could not read error body.');
        logs.push(`❌ Analysis service returned an error. Status: ${response.status}, Body: ${errorBody}`);
        console.error(logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery };
      }

      const result = await response.json().catch(e => {
        logs.push(`❌ Failed to parse JSON from analysis service: ${String(e)}`);
        console.error(logs[logs.length-1]);
        return { error: logs.join('\n') };
      });
      
      if(result.error) return { error: result.error, sqlQuery };

      logs.push('Step 4 Complete: Successfully received and parsed result from analysis service.');
      console.log('[statisticsTool] Analysis successful.');
      return { result, sqlQuery };

    } catch (e: any) {
      logs.push(`💥 Unexpected error in statisticsTool: ${e.message || 'Unknown error'}`);
      console.error('[statisticsTool]', e.stack);
      return { error: logs.join('\n'), sqlQuery };
    }
  }
);
