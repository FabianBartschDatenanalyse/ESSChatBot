'use server';

/**
 * @fileOverview A Genkit tool for creating data visualizations.
 *
 * This tool orchestrates a multi-step process to generate a chart:
 * 1. Performs a vector search on the codebook to find relevant context.
 * 2. Uses an LLM to plan the chart (type, axes, SQL query) based on the user's question and context.
 * 3. Executes the generated SQL query to fetch the data.
 * 4. Constructs a Vega-Lite specification for the chart.
 * 5. Renders the spec into a PNG image on the server.
 * 6. Returns the PNG data URL and the Vega-Lite spec.
 */

import { ai } from '@/src/ai/genkit';
import { z } from 'zod';
import { searchCodebook } from '@/src/lib/vector-search';
import { executeQuery } from '@/src/lib/data-service';
import {-l} from 'vega-lite';
import {View, parse} from 'vega';

const ChartPlanSchema = z.object({
  chartType: z.enum(['bar', 'line', 'scatter', 'pie', 'arc', 'point']).describe("The type of chart to generate."),
  x_axis: z.string().describe("The column to use for the x-axis. Must be from the codebook."),
  y_axis: z.string().describe("The column to use for the y-axis. Must be from the codebook."),
  y_aggregation: z.enum(['AVG', 'SUM', 'COUNT', 'NONE']).describe("The aggregation to apply to the y-axis. Use 'NONE' for pre-aggregated data or scatter plots."),
  sqlQuery: z.string().describe("The SQL query to fetch the data for the chart. Follows the same rules as suggestSqlQuery."),
});

const toolInputSchema = z.object({
  nlQuestion: z.string().describe('The natural language question to generate a chart for.'),
});

const toolOutputSchema = z.object({
  vegaLiteSpec: z.any().optional().describe("The Vega-Lite JSON specification for the chart."),
  pngDataUrl: z.string().optional().describe("A data URL of the rendered PNG chart image."),
  error: z.string().optional().describe("An error message if the chart generation failed."),
});

export const chartingTool = ai.defineTool(
  {
    name: 'chartingTool',
    description: 'Use this tool to create a data visualization when the user asks to "show", "plot", "draw", or "visualize" data. It generates a chart and returns it as an image.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    try {
      // 1. Retrieve context from vector DB
      const retrievedContext = (await searchCodebook(input.nlQuestion, 7)).map(r => r.content).join('\n');
      console.log('[chartingTool] Retrieved context.');

      // 2. Plan the chart and generate SQL
      const planningPrompt = `You are an expert chart designer and SQL writer. Your task is to create a plan for a chart based on a user's question and a database codebook.

      **CRITICAL RULES FOR SQL:**
      - The table name MUST be "ESS1" (in double quotes).
      - Column names MUST NOT be quoted.
      - Cast columns to NUMERIC for any aggregation (AVG, SUM).
      - Exclude missing values (like 77, 88, 99 for numeric, or empty strings for text) in the WHERE clause.

      **User's Question:**
      ${input.nlQuestion}

      **Relevant Codebook Context:**
      ${retrievedContext}

      Based on the above, create a plan for the chart and the SQL query to get the data.
      `;
      
      const planResponse = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: planningPrompt,
        output: { schema: ChartPlanSchema },
      });

      const plan = planResponse.output;
      if (!plan) {
        return { error: "Failed to generate a chart plan." };
      }
      console.log('[chartingTool] Generated plan:', plan);

      // 3. Execute SQL query
      const { data, error } = await executeQuery(plan.sqlQuery);
      if (error || !data || data.length === 0) {
        console.error('[chartingTool] SQL query failed or returned no data:', error);
        return { error: `Query failed or returned no data: ${error || 'No data'}` };
      }
      console.log(`[chartingTool] Fetched ${data.length} rows.`);

      // 4. Build Vega-Lite spec
      const spec: any = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": input.nlQuestion,
        "data": { "values": data },
        "mark": { "type": plan.chartType, "tooltip": true },
        "encoding": {
          "x": { "field": plan.x_axis, "type": "nominal", "axis": { "labelAngle": -45 } },
          "y": { 
            "field": plan.y_axis, 
            "type": "quantitative",
            "aggregate": plan.y_aggregation !== 'NONE' ? plan.y_aggregation.toLowerCase() : undefined,
          },
        },
      };
      
      // Adjust encoding for scatter plots (no aggregation)
      if (plan.chartType === 'scatter') {
        spec.encoding.x.type = 'quantitative';
        delete spec.encoding.y.aggregate;
      }
      
      console.log('[chartingTool] Generated Vega-Lite spec.');

      // 5. Render to PNG on the server
      const vegaSpec = parse(-l(spec));
      const view = new View(vegaSpec, { renderer: 'canvas' });
      const canvas = await view.toCanvas();
      const pngDataUrl = canvas.toDataURL('image/png');
      console.log('[chartingTool] Rendered chart to PNG.');

      return {
        pngDataUrl,
        vegaLiteSpec: spec,
      };

    } catch (e: any) {
      console.error('Unexpected error in chartingTool:', e);
      return { error: `An unexpected error occurred: ${e.message}` };
    }
  }
);
