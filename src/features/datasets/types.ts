import { z } from 'zod';

export const DatasetColumnTypeSchema = z.enum(['string', 'number', 'boolean', 'date']);
export type DatasetColumnType = z.infer<typeof DatasetColumnTypeSchema>;

export const DatasetMeasurementLevelSchema = z.enum(['nominal', 'ordinal', 'metric']);
export type DatasetMeasurementLevel = z.infer<typeof DatasetMeasurementLevelSchema>;

export const DatasetColumnSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  originalName: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().default(''),
  dataType: DatasetColumnTypeSchema,
  measurementLevel: DatasetMeasurementLevelSchema.default('nominal'),
  valueLabels: z.array(z.string()).default([]),
  missingValues: z.array(z.string()).default([]),
  sampleValues: z.array(z.union([z.string(), z.number()])).default([]),
  minValue: z.number().nullable().default(null),
  maxValue: z.number().nullable().default(null),
  inferredMissingCount: z.number().int().nonnegative().default(0),
});
export type DatasetColumn = z.infer<typeof DatasetColumnSchema>;

export const DatasetPreviewRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));
export type DatasetPreviewRow = z.infer<typeof DatasetPreviewRowSchema>;

export const DatasetStatusSchema = z.enum(['processing', 'ready', 'error']);
export type DatasetStatus = z.infer<typeof DatasetStatusSchema>;

export const DatasetMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: DatasetStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  originalFilename: z.string(),
  rowCount: z.number().int().nonnegative(),
  weightColumn: z.string().nullable(),
  defaultMissingValues: z.array(z.string()).default([]),
  columns: z.array(DatasetColumnSchema),
  samplePreview: z.array(DatasetPreviewRowSchema).default([]),
  notes: z.string().optional(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
});
export type DatasetMetadata = z.infer<typeof DatasetMetadataSchema>;

export const DatasetSummarySchema = DatasetMetadataSchema.omit({
  samplePreview: true,
  notes: true,
});
export type DatasetSummary = z.infer<typeof DatasetSummarySchema>;

export const UpdateDatasetColumnSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  valueLabels: z.array(z.string()).optional(),
  missingValues: z.array(z.string()).optional(),
  dataType: DatasetColumnTypeSchema.optional(),
  measurementLevel: DatasetMeasurementLevelSchema.optional(),
});

export const UpdateDatasetPayloadSchema = z.object({
  title: z.string().optional(),
  weightColumn: z.string().nullable().optional(),
  defaultMissingValues: z.array(z.string()).optional(),
  columns: z.array(UpdateDatasetColumnSchema).optional(),
  notes: z.string().optional(),
});
export type UpdateDatasetPayload = z.infer<typeof UpdateDatasetPayloadSchema>;

export type DatasetIndexFile = {
  version: 1;
  datasets: DatasetMetadata[];
};

export const DEFAULT_MISSING_SENTINELS = ['', 'NA', 'N/A', 'NaN', 'NULL', 'null', '99', '999', '88', '77'];

export const DatasetToolContextSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  rowCount: z.number().int().nonnegative(),
  tableName: z.string().min(1),
  context: z.string(),
  columns: z.array(DatasetColumnSchema),
  defaultMissingValues: z.array(z.string()),
  weightColumn: z.string().nullable(),
});
export type DatasetToolContext = z.infer<typeof DatasetToolContextSchema>;
