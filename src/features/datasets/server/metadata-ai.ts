import type {
  DatasetMetadata,
  DatasetPreviewRow,
  DatasetColumn,
} from '@/src/features/datasets/types';
import {
  generateDatasetMetadata,
  type GenerateDatasetMetadataInput,
} from '@/src/ai/flows/generate-dataset-metadata';

type ColumnValueCount = {
  value: string;
  count: number;
};

type AiValueLabel = {
  value: string;
  label: string;
};

const MAX_VALUE_LABELS = 15;

function toDisplayString(value: string | number): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return Number(value).toPrecision(6).replace(/\.?0+$/, '');
  }
  return String(value);
}

function collectValueCounts(
  samplePreview: DatasetPreviewRow[],
  columnName: string,
): ColumnValueCount[] {
  const counts = new Map<string, number>();
  for (const row of samplePreview) {
    const raw = row?.[columnName];
    if (raw === null || raw === undefined) {
      continue;
    }
    const key = typeof raw === 'number' ? toDisplayString(raw) : String(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));
}

function buildMetadataInput(metadata: DatasetMetadata): GenerateDatasetMetadataInput {
  const defaultMissingValues = metadata.defaultMissingValues ?? [];
  return {
    datasetTitle: metadata.title,
    rowCount: metadata.rowCount,
    columns: metadata.columns.map((column) => {
      const sampleValues = column.sampleValues.map(toDisplayString).slice(0, 10);
      const valueCounts = collectValueCounts(metadata.samplePreview ?? [], column.name);
      const distinctSampleValueCount =
        valueCounts.length > 0 ? valueCounts.length : new Set(sampleValues).size;
      return {
        name: column.name,
        displayName: column.displayName,
        originalName: column.originalName,
        dataType: column.dataType,
        measurementLevel: column.measurementLevel,
        sampleValues,
        distinctSampleValueCount,
        valueCounts,
        existingDescription: column.description ?? '',
        existingValueLabels: column.valueLabels ?? [],
        missingValues: column.missingValues ?? [],
        defaultMissingValues,
        inferredMissingCount: column.inferredMissingCount ?? 0,
        minValue: column.minValue ?? null,
        maxValue: column.maxValue ?? null,
      };
    }),
  };
}

function normalizeValueLabels(labels: AiValueLabel[]): string[] {
  const formatted: string[] = [];
  const seen = new Set<string>();
  for (const entry of labels) {
    const rawValue = entry.value?.toString().trim() ?? '';
    const rawLabel = entry.label?.toString().trim() ?? '';
    if (!rawValue && !rawLabel) {
      continue;
    }
    const combined =
      rawValue && rawLabel
        ? `${rawValue}=${rawLabel}`
        : rawLabel
        ? rawLabel
        : rawValue;
    if (!combined.length) {
      continue;
    }
    if (seen.has(combined)) {
      continue;
    }
    seen.add(combined);
    formatted.push(combined);
    if (formatted.length >= MAX_VALUE_LABELS) {
      break;
    }
  }
  return formatted;
}

function mergeMissingValues(column: DatasetColumn, aiMissingValues?: string[]): string[] {
  if (!aiMissingValues?.length) {
    return column.missingValues ?? [];
  }
  const values = new Set<string>(
    (column.missingValues ?? []).map((value) => value.trim()).filter(Boolean),
  );
  for (const entry of aiMissingValues) {
    const cleaned = entry?.toString().trim();
    if (cleaned) {
      values.add(cleaned);
    }
  }
  return Array.from(values);
}

export async function enrichDatasetMetadataWithAi(
  metadata: DatasetMetadata,
): Promise<DatasetMetadata> {
  try {
    const input = buildMetadataInput(metadata);
    const aiResult = await generateDatasetMetadata(input);
    if (!aiResult) {
      return metadata;
    }

    const overrideByName = new Map<string, typeof aiResult.columns[number]>();
    for (const column of aiResult.columns) {
      overrideByName.set(column.name.toLowerCase(), column);
    }

    const updatedColumns = metadata.columns.map((column) => {
      const override =
        overrideByName.get(column.name.toLowerCase()) ??
        overrideByName.get(column.originalName.toLowerCase());
      if (!override) {
        return column;
      }

      const description =
        override.description && override.description.trim().length
          ? override.description.trim()
          : column.description;
      const displayName =
        override.displayName && override.displayName.trim().length
          ? override.displayName.trim()
          : column.displayName;
      const measurementLevel =
        override.measurementLevel ?? column.measurementLevel;
      const valueLabels = override.valueLabels
        ? normalizeValueLabels(override.valueLabels)
        : column.valueLabels;
      const missingValues = mergeMissingValues(column, override.missingValues);

      return {
        ...column,
        description,
        displayName,
        measurementLevel,
        valueLabels,
        missingValues,
      };
    });

    const notes = aiResult.notes?.trim();
    return {
      ...metadata,
      columns: updatedColumns,
      notes: notes
        ? metadata.notes?.trim().length
          ? `${metadata.notes.trim()}\n\n${notes}`
          : notes
        : metadata.notes,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[metadata-ai] Failed to enrich dataset metadata with AI:', error);
    return metadata;
  }
}

