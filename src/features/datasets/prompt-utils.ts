import type { DatasetColumn, DatasetMetadata } from '@/src/features/datasets/types';

const MAX_SUMMARY_CHARS = 20000;
const MAX_DESCRIPTION_LENGTH = 140;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_VALUE_LABELS = 5;
const MAX_VALUE_LABEL_LENGTH = 60;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const truncateText = (value: string, maxLength: number): string => {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const formatMissingList = (values: string[], limit = 6): string => {
  if (values.length === 0) {
    return 'none';
  }

  const truncated = values.slice(0, limit);
  const suffix = values.length > limit ? `, ... (+${values.length - limit} more)` : '';

  return truncated.map((value) => `"${value}"`).join(', ') + suffix;
};

const formatNumericValue = (value: number): string => {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};

const formatValueLabels = (valueLabels: string[]): string => {
  if (!valueLabels.length) {
    return '';
  }

  const truncated = valueLabels.slice(0, MAX_VALUE_LABELS).map((label) => truncateText(label, MAX_VALUE_LABEL_LENGTH));
  const suffix = valueLabels.length > MAX_VALUE_LABELS ? ` (+${valueLabels.length - MAX_VALUE_LABELS} more)` : '';

  return truncated.join('; ') + suffix;
};

const formatColumnForPrompt = (column: DatasetColumn): string => {
  const descriptorParts: string[] = [];

  if (column.displayName && column.displayName !== column.name) {
    descriptorParts.push(truncateText(column.displayName, MAX_DISPLAY_NAME_LENGTH));
  }

  if (column.description) {
    descriptorParts.push(truncateText(column.description, MAX_DESCRIPTION_LENGTH));
  }

  const headerSuffix =
    column.originalName && column.originalName !== column.name ? ` (source: ${column.originalName})` : '';

  const metaParts: string[] = [];

  if (column.dataType === 'number' && column.minValue !== null && column.maxValue !== null) {
    metaParts.push(`range ${formatNumericValue(column.minValue)} to ${formatNumericValue(column.maxValue)}`);
  }

  const labelsSummary = formatValueLabels(column.valueLabels ?? []);
  if (labelsSummary) {
    metaParts.push(`labels ${labelsSummary}`);
  }

  const descriptors = descriptorParts.length ? ` - ${descriptorParts.join(' - ')}` : '';
  const meta = metaParts.length ? ` (${metaParts.join('; ')})` : '';

  return `- ${column.name} [${column.dataType}]${headerSuffix}${descriptors}${meta}`;
};

export type DatasetPromptContext = {
  summary: string;
  allowedColumns: string[];
  missingValueMap: Record<string, string[]>;
  columnMap: Record<string, DatasetColumn>;
};

type DatasetPromptCacheEntry = {
  updatedAt: string;
  context: DatasetPromptContext;
};

type DatasetPromptContextCache = Map<string, DatasetPromptCacheEntry>;

declare global {
  // eslint-disable-next-line no-var
  var __datasetPromptContextCache: DatasetPromptContextCache | undefined;
}

const getDatasetPromptContextCache = (): DatasetPromptContextCache => {
  if (!globalThis.__datasetPromptContextCache) {
    globalThis.__datasetPromptContextCache = new Map();
  }
  return globalThis.__datasetPromptContextCache;
};

const datasetPromptContextCache = getDatasetPromptContextCache();

const computeDatasetPromptContext = (dataset: DatasetMetadata): DatasetPromptContext => {
  const allowedColumns: string[] = [];
  const missingValueMap: Record<string, string[]> = {};
  const columnMap: Record<string, DatasetColumn> = {};
  const globalMissing = dataset.defaultMissingValues ?? [];

  const lines = dataset.columns.map((column) => {
    allowedColumns.push(column.name);
    columnMap[column.name] = column;
    const combinedMissing = Array.from(new Set([...globalMissing, ...(column.missingValues ?? [])])).filter(
      (value) => value !== '',
    );
    missingValueMap[column.name] = combinedMissing;
    return formatColumnForPrompt(column);
  });

  const rowCountFormatted = dataset.rowCount.toLocaleString('en-US');

  const prefixParts = [
    `Dataset "${dataset.title}"`,
    `Rows: ${rowCountFormatted}`,
    dataset.weightColumn ? `Weight column: ${dataset.weightColumn}` : 'Weight column: none (weight = 1)',
    `Global missing values: ${formatMissingList(globalMissing)}`,
    '',
    'Columns:',
  ];

  const prefix = prefixParts.join('\n');
  const availableForColumns = MAX_SUMMARY_CHARS - prefix.length - 1;
  const columnLines: string[] = [];

  if (availableForColumns > 0) {
    let used = 0;
    for (const line of lines) {
      const lineLength = line.length + 1;
      if (used + lineLength > availableForColumns) {
        break;
      }
      columnLines.push(line);
      used += lineLength;
    }

    if (columnLines.length < lines.length) {
      const remaining = lines.length - columnLines.length;
      columnLines.push(`- ... (${remaining} additional columns omitted. See ALLOWED COLUMNS for the full list.)`);
    }
  } else if (lines.length > 0) {
    columnLines.push(`- ... (${lines.length} columns omitted. See ALLOWED COLUMNS for the full list.)`);
  }

  const summary = [...prefixParts, ...columnLines].join('\n');

  return {
    summary,
    allowedColumns,
    missingValueMap,
    columnMap,
  };
};

export function getDatasetPromptContext(dataset: DatasetMetadata): DatasetPromptContext {
  const cacheKey = dataset.id;
  const lastUpdated = dataset.updatedAt;
  const cachedEntry = datasetPromptContextCache.get(cacheKey);

  if (cachedEntry && cachedEntry.updatedAt === lastUpdated) {
    return cachedEntry.context;
  }

  const context = computeDatasetPromptContext(dataset);
  datasetPromptContextCache.set(cacheKey, { updatedAt: lastUpdated, context });
  return context;
}

export const buildDatasetPromptContext = getDatasetPromptContext;

export const invalidateDatasetPromptContext = (datasetId: string): void => {
  datasetPromptContextCache.delete(datasetId);
};

export const clearDatasetPromptContextCache = (): void => {
  datasetPromptContextCache.clear();
};
