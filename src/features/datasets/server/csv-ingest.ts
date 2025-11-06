import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import Papa from 'papaparse';
import {
  DatasetMetadata,
  DatasetColumn,
  DatasetPreviewRow,
  DEFAULT_MISSING_SENTINELS,
  DatasetColumnType,
  DatasetMeasurementLevel,
} from '@/src/features/datasets/types';
import { datasetTableName } from '@/src/features/datasets/utils';
import { getDatasetSqlitePath } from '@/src/features/datasets/server/dataset-repository';
import { createDatabase, serializeDatabase } from '@/src/features/datasets/server/sql-engine';
import type { DatasetMetadataOverrides } from '@/src/features/datasets/server/metadata-import';

type IngestCsvParams = {
  datasetId: string;
  originalFilename: string;
  buffer: Buffer;
  title?: string;
  overrides?: DatasetMetadataOverrides;
};

export type CsvIngestResult = {
  metadata: DatasetMetadata;
  normalizedRows: DatasetPreviewRow[];
  columnNameMap: Record<string, string>;
};

const SAMPLE_PREVIEW_LIMIT = 50;
const SAMPLE_VALUE_LIMIT = 5;

const SQL_COLUMN_TYPES: Record<DatasetColumnType, string> = {
  string: 'TEXT',
  number: 'REAL',
  boolean: 'INTEGER',
  date: 'TEXT',
};

const inferMeasurementLevel = (type: DatasetColumnType): DatasetMeasurementLevel => {
  switch (type) {
    case 'number':
      return 'metric';
    case 'boolean':
      return 'ordinal';
    case 'date':
    case 'string':
    default:
      return 'nominal';
  }
};

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'y']);
const BOOLEAN_FALSE_VALUES = new Set(['0', 'false', 'no', 'n']);

const normalizeBoolean = (value: string): number | null => {
  const normalized = value.trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) {
    return 1;
  }
  if (BOOLEAN_FALSE_VALUES.has(normalized)) {
    return 0;
  }
  return null;
};

const normalizeSqlValue = (
  raw: unknown,
  column: DatasetColumn,
  defaultMissing: Set<string>,
): string | number | null => {
  if (raw === null || raw === undefined) {
    return null;
  }
  const asString = String(raw);
  const trimmed = asString.trim();
  if (!trimmed.length) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (defaultMissing.has(lower)) {
    return null;
  }

  switch (column.dataType) {
    case 'number': {
      const normalized = trimmed.replace(',', '.');
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case 'boolean': {
      return normalizeBoolean(trimmed);
    }
    case 'date':
    case 'string':
    default:
      return trimmed;
  }
};


function toSafeColumnName(raw: string, used: Set<string>): string {
  const fallback = `column_${used.size}`;
  if (!raw || typeof raw !== 'string') {
    let candidate = fallback;
    while (used.has(candidate)) {
      candidate = `${candidate}_${used.size}`;
    }
    used.add(candidate);
    return candidate;
  }

  let normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');

  if (/^\d/.test(normalized)) {
    normalized = `c_${normalized}`;
  }
  if (!normalized) {
    normalized = fallback;
  }

  let candidate = normalized;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${normalized}_${suffix}`;
    suffix += 1;
  }

  used.add(candidate);
  return candidate;
}

const normalizeOverrideKey = (input: string | null | undefined): string | null => {
  if (!input || typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
};

const toSanitizedKey = (input: string | null | undefined): string | null => {
  if (!input || typeof input !== 'string') {
    return null;
  }
  let normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
  if (!normalized.length) {
    return null;
  }
  if (/^\d/.test(normalized)) {
    normalized = `c_${normalized}`;
  }
  return normalized;
};

function detectColumnType(values: any[]): DatasetColumnType {
  const sanitized = values
    .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
    .map((value) => String(value).trim());

  if (!sanitized.length) {
    return 'string';
  }

  const lower = sanitized.map((value) => value.toLowerCase());
  const booleanTokens = new Set(['true', 'false', 'yes', 'no', 'y', 'n', '0', '1']);
  // Restrict boolean detection to columns that contain at least one explicit boolean literal.
  // Purely numeric 0/1 columns are often categorical encodings (e.g., gender) and should remain numeric.
  const textualBooleanTokens = new Set(['true', 'false', 'yes', 'no', 'y', 'n']);
  const isBooleanCandidate = lower.every((token) => booleanTokens.has(token));
  const hasExplicitBooleanLiteral = lower.some((token) => textualBooleanTokens.has(token));
  if (isBooleanCandidate && hasExplicitBooleanLiteral) {
    return 'boolean';
  }

  const numeric = sanitized.every((value) => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed);
  });
  if (numeric) {
    return 'number';
  }

  const dateLike = sanitized.every((value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed);
  });
  if (dateLike) {
    return 'date';
  }

  return 'string';
}

export async function ingestCsvBuffer({
  datasetId,
  originalFilename,
  buffer,
  title,
  overrides,
}: IngestCsvParams): Promise<CsvIngestResult> {
  const csvText = buffer.toString('utf-8');
  const parsed = Papa.parse<Record<string, any>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header ?? '',
  });

  if (parsed.errors?.length) {
    const firstError = parsed.errors[0];
    throw new Error(
      `CSV parse error at row ${firstError.row ?? 'unknown'}: ${firstError.message ?? 'Unknown error'}`,
    );
  }

  const originalHeaders = parsed.meta.fields ?? [];
  if (!originalHeaders.length) {
    throw new Error('CSV file does not contain a header row with column names.');
  }

  const rows = parsed.data ?? [];
  const rowCount = rows.length;

  const usedNames = new Set<string>();
  const columns: DatasetColumn[] = [];
  const columnNameMap: Record<string, string> = {};

  const missingValueCounts = new Map<string, number>();
  const missingValueDisplay = new Map<string, string>();
  const missingValueOrder: string[] = [];

  const registerMissingCandidate = (input: unknown): string | null => {
    if (input === null || input === undefined) {
      return null;
    }
    const trimmed = String(input).trim();
    if (!trimmed.length) {
      return null;
    }
    const normalized = trimmed.toLowerCase();
    if (!missingValueDisplay.has(normalized)) {
      missingValueDisplay.set(normalized, trimmed);
      missingValueOrder.push(normalized);
    }
    return normalized;
  };

  const datasetOverrideMissingLower = new Set<string>();

  if (overrides?.defaultMissingValues?.length) {
    for (const candidate of overrides.defaultMissingValues) {
      if (typeof candidate !== 'string') {
        continue;
      }
      const normalized = registerMissingCandidate(candidate);
      if (normalized) {
        datasetOverrideMissingLower.add(normalized);
      }
    }
  }

  const columnOverridesMap = new Map<string, DatasetMetadataOverrides['columns'][number]>();
  if (overrides?.columns?.length) {
    for (const columnOverride of overrides.columns) {
      const key = normalizeOverrideKey(columnOverride.name) ?? toSanitizedKey(columnOverride.name);
      if (key) {
        columnOverridesMap.set(key, columnOverride);
      }
      const sanitizedKey = toSanitizedKey(columnOverride.name);
      if (sanitizedKey) {
        columnOverridesMap.set(sanitizedKey, columnOverride);
      }
    }
  }

  for (const originalName of originalHeaders) {
    const safeName = toSafeColumnName(originalName, usedNames);
    columnNameMap[originalName] = safeName;

    const normalizedKey = normalizeOverrideKey(originalName);
    const sanitizedKey = toSanitizedKey(originalName);
    const columnOverride =
      (normalizedKey ? columnOverridesMap.get(normalizedKey) : undefined) ??
      (sanitizedKey ? columnOverridesMap.get(sanitizedKey) : undefined);

    const columnValues = rows.map((row) => row?.[originalName]);
    const missingValuesDetected = new Set<string>();
    const normalizedMissingForColumn = new Set<string>();
    let missingCount = 0;

    const overrideMissingLower = new Set<string>();
    if (columnOverride?.missingValues?.length) {
      for (const value of columnOverride.missingValues) {
        const trimmed = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        if (!trimmed.length) {
          continue;
        }
        missingValuesDetected.add(trimmed);
        const normalized = registerMissingCandidate(trimmed);
        if (normalized) {
          overrideMissingLower.add(normalized);
        }
      }
    }

    const normalizedValues: (string | number | null)[] = columnValues.map((value) => {
      if (value === null || value === undefined) {
        missingCount += 1;
        return null;
      }
      const stringValue = String(value).trim();
      if (!stringValue.length) {
        missingValuesDetected.add('');
        missingCount += 1;
        return null;
      }

      const lower = stringValue.toLowerCase();
      if (overrideMissingLower.has(lower) || datasetOverrideMissingLower.has(lower)) {
        missingValuesDetected.add(stringValue);
        const normalized = registerMissingCandidate(stringValue);
        if (normalized) {
          normalizedMissingForColumn.add(normalized);
        }
        missingCount += 1;
        return null;
      }

      const sentinel = DEFAULT_MISSING_SENTINELS.find(
        (candidate) => candidate.length > 0 && lower === candidate.toLowerCase(),
      );
      if (sentinel) {
        missingValuesDetected.add(sentinel);
        const normalized = registerMissingCandidate(sentinel);
        if (normalized) {
          normalizedMissingForColumn.add(normalized);
        }
        missingCount += 1;
        return null;
      }

      return value;
    });

    const inferredType = detectColumnType(normalizedValues);
    const resolvedType = columnOverride?.dataType ?? inferredType;
    const measurementLevel = columnOverride?.measurementLevel ?? inferMeasurementLevel(resolvedType);

    const sampleValues: Array<string | number> = [];
    let minValue: number | null = null;
    let maxValue: number | null = null;

    for (let index = 0; index < normalizedValues.length; index += 1) {
      const normalizedValue = normalizedValues[index];
      if (normalizedValue === null) {
        continue;
      }

      if (resolvedType === 'number') {
        const numeric =
          typeof normalizedValue === 'number'
            ? normalizedValue
            : Number.parseFloat(String(normalizedValue).trim().replace(',', '.'));
        if (!Number.isFinite(numeric)) {
          continue;
        }
        if (sampleValues.length < SAMPLE_VALUE_LIMIT) {
          sampleValues.push(numeric);
        }
        if (minValue === null || numeric < minValue) {
          minValue = numeric;
        }
        if (maxValue === null || numeric > maxValue) {
          maxValue = numeric;
        }
        continue;
      }

      if (resolvedType === 'boolean') {
        const rawValue = columnValues[index];
        const normalizedBoolean = normalizeBoolean(String(rawValue ?? normalizedValue));
        if (normalizedBoolean !== null) {
          if (sampleValues.length < SAMPLE_VALUE_LIMIT) {
            sampleValues.push(normalizedBoolean);
          }
        } else if (sampleValues.length < SAMPLE_VALUE_LIMIT) {
          sampleValues.push(String(normalizedValue));
        }
        continue;
      }

      if (sampleValues.length < SAMPLE_VALUE_LIMIT) {
        sampleValues.push(String(normalizedValue));
      }
    }

    const valueLabels = columnOverride?.valueLabels
      ? Array.from(
          new Set(
            columnOverride.valueLabels
              .map((entry) => String(entry).trim())
              .filter((entry) => entry.length > 0),
          ),
        )
      : [];

    const missingValues = Array.from(missingValuesDetected);

    columns.push({
      id: randomUUID(),
      name: safeName,
      originalName,
      displayName:
        columnOverride?.displayName?.trim().length ? columnOverride.displayName.trim() : originalName || safeName,
      description: columnOverride?.description ?? '',
      dataType: resolvedType,
      measurementLevel,
      valueLabels,
      missingValues,
      sampleValues,
      minValue,
      maxValue,
      inferredMissingCount: missingCount,
    });

    for (const normalized of normalizedMissingForColumn) {
      missingValueCounts.set(normalized, (missingValueCounts.get(normalized) ?? 0) + 1);
    }
  }

  const samplePreview: DatasetPreviewRow[] = rows.slice(0, SAMPLE_PREVIEW_LIMIT).map((row) => {
    const normalizedRow: DatasetPreviewRow = {};
    for (const column of columns) {
      const rawValue = row?.[column.originalName];
      if (rawValue === null || rawValue === undefined) {
        normalizedRow[column.name] = null;
        continue;
      }
      const stringValue = String(rawValue).trim();
      const sentinelMatch = column.missingValues.find(
        (candidate) => candidate.length > 0 && stringValue.toLowerCase() === candidate.toLowerCase(),
      );
      if (sentinelMatch || stringValue.length === 0) {
        normalizedRow[column.name] = null;
        continue;
      }

      if (column.dataType === 'number') {
        const parsedNumber = Number(stringValue.replace(',', '.'));
        normalizedRow[column.name] = Number.isFinite(parsedNumber) ? parsedNumber : null;
      } else if (column.dataType === 'boolean') {
        const normalizedBoolean = normalizeBoolean(stringValue);
        normalizedRow[column.name] = normalizedBoolean !== null ? normalizedBoolean : stringValue;
      } else {
        normalizedRow[column.name] = stringValue;
      }
    }
    return normalizedRow;
  });

  const timestamp = new Date().toISOString();
  const totalColumns = columns.length;
  const defaultMissingValues =
    totalColumns > 0
      ? missingValueOrder
          .filter((normalized) => missingValueCounts.get(normalized) === totalColumns)
          .map((normalized) => missingValueDisplay.get(normalized) ?? normalized)
      : [];

  const findColumnForOverride = (candidate: string | null | undefined): DatasetColumn | undefined => {
    if (!candidate) {
      return undefined;
    }
    const normalizedCandidate = normalizeOverrideKey(candidate);
    const sanitizedCandidate = toSanitizedKey(candidate);
    return columns.find((column) => {
      const normalizedOriginal = normalizeOverrideKey(column.originalName);
      const normalizedSafe = normalizeOverrideKey(column.name);
      if (
        normalizedCandidate &&
        (normalizedOriginal === normalizedCandidate || normalizedSafe === normalizedCandidate)
      ) {
        return true;
      }
      if (sanitizedCandidate) {
        const sanitizedOriginal = toSanitizedKey(column.originalName);
        const sanitizedSafe = toSanitizedKey(column.name);
        if (sanitizedOriginal === sanitizedCandidate || sanitizedSafe === sanitizedCandidate) {
          return true;
        }
      }
      return false;
    });
  };

  let weightColumn: string | null = null;
  if (overrides?.weightColumn) {
    const candidate = findColumnForOverride(overrides.weightColumn);
    if (candidate) {
      weightColumn = candidate.name;
    }
  }
  if (!weightColumn && overrides?.columns?.length) {
    for (const override of overrides.columns) {
      if (!override.isWeight) {
        continue;
      }
      const candidate = findColumnForOverride(override.name);
      if (candidate) {
        weightColumn = candidate.name;
        break;
      }
    }
  }

  const metadata: DatasetMetadata = {
    id: datasetId,
    title: title?.trim().length ? title : originalFilename ?? datasetId,
    status: 'ready',
    createdAt: timestamp,
    updatedAt: timestamp,
    originalFilename,
    rowCount,
    weightColumn,
    defaultMissingValues,
    columns,
    samplePreview,
    notes: overrides?.notes,
  };

  const sqlitePath = getDatasetSqlitePath(datasetId);
  const tableName = datasetTableName(datasetId);
  const globalMissing = new Set((metadata.defaultMissingValues ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
  const columnMissingLookup = new Map<string, Set<string>>();
  for (const column of columns) {
    const combined = new Set<string>(globalMissing);
    for (const value of column.missingValues ?? []) {
      const normalized = String(value).trim().toLowerCase();
      if (normalized) {
        combined.add(normalized);
      }
    }
    columnMissingLookup.set(column.name, combined);
  }

  const db = await createDatabase();
  const columnDefinitions = columns
    .map((column) => `"${column.name}" ${SQL_COLUMN_TYPES[column.dataType] ?? 'TEXT'}`)
    .join(', ');
  db.run(`CREATE TABLE "${tableName}" (${columnDefinitions})`);

  const columnList = columns.map((column) => `"${column.name}"`).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`);

  for (const rawRow of rows) {
    const values = columns.map((column) => {
      const rawValue = rawRow?.[column.originalName];
      const missingSet = columnMissingLookup.get(column.name) ?? globalMissing;
      return normalizeSqlValue(rawValue, column, missingSet);
    });
    stmt.bind(values);
    stmt.step();
    stmt.reset();
  }
  stmt.free();

  const binary = await serializeDatabase(db);
  await fs.writeFile(sqlitePath, Buffer.from(binary));
  db.close();

  return {
    metadata,
    normalizedRows: samplePreview,
    columnNameMap,
  };
}
