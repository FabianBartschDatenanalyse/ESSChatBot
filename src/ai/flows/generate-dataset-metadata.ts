'use server';

import { ai, isAiConfigured } from '@/src/ai/genkit';
import {
  DatasetColumnTypeSchema,
  DatasetMeasurementLevelSchema,
} from '@/src/features/datasets/types';
import { z } from 'genkit';

const ValueCountSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
});

const ColumnProfileSchema = z.object({
  name: z.string().describe('Normalized column name as used in SQL queries.'),
  displayName: z.string().describe('Human readable column label.'),
  originalName: z.string().describe('Original header in the uploaded file.'),
  dataType: DatasetColumnTypeSchema.describe('Data type inferred from the CSV.'),
  measurementLevel: DatasetMeasurementLevelSchema.describe('Current measurement level assignment.'),
  sampleValues: z
    .array(z.string())
    .max(10)
    .describe('Up to 10 representative values (after trimming).'),
  distinctSampleValueCount: z
    .number()
    .int()
    .nonnegative()
    .describe('Approximate distinct values observed in the provided sample.'),
  valueCounts: z
    .array(ValueCountSchema)
    .max(10)
    .describe('Most common values seen in the sample preview.'),
  existingDescription: z.string().default('').describe('Existing description (may be empty).'),
  existingValueLabels: z
    .array(z.string())
    .default([])
    .describe('Existing value labels in "value=label" format, if any.'),
  missingValues: z
    .array(z.string())
    .default([])
    .describe('Column specific missing value codes.'),
  defaultMissingValues: z
    .array(z.string())
    .default([])
    .describe('Global missing sentinels configured for the dataset.'),
  inferredMissingCount: z
    .number()
    .int()
    .nonnegative()
    .describe('Count of missing or sentinel values detected in the sample.'),
  minValue: z.number().nullable().describe('Minimum numeric value (if numeric column).'),
  maxValue: z.number().nullable().describe('Maximum numeric value (if numeric column).'),
});

const GenerateDatasetMetadataInputSchema = z.object({
  datasetTitle: z.string(),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(ColumnProfileSchema).min(1),
});
export type GenerateDatasetMetadataInput = z.infer<typeof GenerateDatasetMetadataInputSchema>;

const AiValueLabelSchema = z.object({
  value: z.string().describe('Exact value as found in the dataset.'),
  label: z.string().describe('Human readable meaning for the value.'),
});

const AiColumnMetadataSchema = z.object({
  name: z.string().describe('Must match the column name provided in the input.'),
  displayName: z.string().optional(),
  description: z.string().optional(),
  measurementLevel: DatasetMeasurementLevelSchema.optional(),
  valueLabels: z.array(AiValueLabelSchema).optional(),
  missingValues: z.array(z.string()).optional(),
});

const GenerateDatasetMetadataOutputSchema = z.object({
  columns: z.array(AiColumnMetadataSchema),
  notes: z.string().optional(),
});
export type GenerateDatasetMetadataOutput = z.infer<typeof GenerateDatasetMetadataOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateDatasetMetadataPrompt',
  input: { schema: GenerateDatasetMetadataInputSchema },
  output: { schema: GenerateDatasetMetadataOutputSchema },
  model: 'openai/gpt-4o',
  prompt: `You are an experienced survey methodologist who writes precise codebooks.
You will receive a dataset titled "{{datasetTitle}}" with approximately {{rowCount}} rows.
For each column, you must refine the metadata and produce short, accurate descriptions,
measurement levels, optional improved display names, sensible value labels, and missing-value hints.

Rules:
1. Always keep the "name" field identical to the provided column name. Do not invent new columns.
2. measurementLevel MUST be one of: "nominal", "ordinal", "metric".
   - Treat discrete ordered scales (e.g., Likert 1-5) as "ordinal".
   - Use "metric" only for truly numeric/continuous quantities.
3. Only add valueLabels when values represent a small discrete set (<= 15 categories) and the meaning is clear.
   - Use the observed sample values and counts as evidence.
   - Value labels must be an array of objects: { "value": "raw value", "label": "meaning" }.
   - Do not fabricate codes that are not visible in the data sample.
4. missingValues should list sentinel codes that represent non-substantive answers (e.g., "77", "999", "NA").
   If unsure, leave the array empty or omit the field.
5. Descriptions should be at most 2 sentences, clearly describing the concept and scale.
   If a good description already exists, refine or keep it.
6. If no improvements are necessary for a column, you may omit fields entirely for that column.
7. You may add a short "notes" field with overall guidance (optional).

Column profiles:
{{#each columns}}
---
Column "{{displayName}}" (name: {{name}}, original: {{originalName}})
- Current type: {{dataType}}
- Current measurement: {{measurementLevel}}
- Sample values:
{{#if sampleValues}}
{{#each sampleValues}}  - {{this}}
{{/each}}
{{else}}
  (none)
{{/if}}
- Most common values (value – count):
{{#if valueCounts}}
{{#each valueCounts}}  - {{value}} – {{count}}
{{/each}}
{{else}}
  (none)
{{/if}}
- Distinct values in sample: {{distinctSampleValueCount}}
- Existing value labels:
{{#if existingValueLabels}}
{{#each existingValueLabels}}  - {{this}}
{{/each}}
{{else}}
  (none)
{{/if}}
- Column missing codes:
{{#if missingValues}}
{{#each missingValues}}  - {{this}}
{{/each}}
{{else}}
  (none)
{{/if}}
- Global missing sentinels shared across columns:
{{#if defaultMissingValues}}
{{#each defaultMissingValues}}  - {{this}}
{{/each}}
{{else}}
  (none)
{{/if}}
- Observed missing count in sample: {{inferredMissingCount}}
- Numeric range (if applicable): min={{minValue}} max={{maxValue}}
- Existing description: {{{existingDescription}}}
{{/each}}

Respond with pure JSON matching this TypeScript type (no extra commentary):
{
  "columns": Array<{
    "name": string;
    "displayName"?: string;
    "description"?: string;
    "measurementLevel"?: "nominal" | "ordinal" | "metric";
    "valueLabels"?: Array<{ "value": string; "label": string }>;
    "missingValues"?: string[];
  }>;
  "notes"?: string;
}
`,
});

const generateDatasetMetadataFlow = ai.defineFlow(
  {
    name: 'generateDatasetMetadataFlow',
    inputSchema: GenerateDatasetMetadataInputSchema,
    outputSchema: GenerateDatasetMetadataOutputSchema,
  },
  async (input) => {
    if (!isAiConfigured) {
      console.warn('[generateDatasetMetadataFlow] AI backend is not configured. Returning empty metadata.');
      return { columns: [] };
    }
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('[generateDatasetMetadataFlow] LLM did not return metadata.');
    }
    return output;
  },
);

export async function generateDatasetMetadata(
  input: GenerateDatasetMetadataInput,
): Promise<GenerateDatasetMetadataOutput | null> {
  if (!isAiConfigured) {
    console.warn('[generateDatasetMetadata] AI backend is not configured. Skipping metadata enrichment.');
    return null;
  }
  return generateDatasetMetadataFlow(input);
}

