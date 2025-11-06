'use server';

import fs from 'node:fs/promises';
import { getDatasetSqlitePath } from '@/src/features/datasets/server/dataset-repository';
import { openDatabaseFromFile } from '@/src/features/datasets/server/sql-engine';

type ExecuteQueryResult = {
  data?: any[];
  error?: string;
};

const ALLOWED_STATEMENTS = ['select', 'with', 'pragma table_info'];

const isReadOnlyQuery = (query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  return ALLOWED_STATEMENTS.some((statement) => normalized.startsWith(statement));
};

const toPlainRows = (columns: string[], values: any[][]): any[] => {
  if (!values?.length) {
    return [];
  }
  return values.map((row) => {
    const record: Record<string, any> = {};
    columns.forEach((column, index) => {
      record[column] = row[index] ?? null;
    });
    return record;
  });
};

export async function executeQuery(query: string, datasetId: string): Promise<ExecuteQueryResult> {
  const trimmedQuery = query.trim();
  console.log('[data-service] Executing query:', trimmedQuery, 'dataset:', datasetId);

  if (!trimmedQuery) {
    return { error: 'Empty query was provided.' };
  }

  if (!isReadOnlyQuery(trimmedQuery)) {
    return { error: 'Only read-only SELECT queries are permitted.' };
  }

  const sqlitePath = getDatasetSqlitePath(datasetId);

  try {
    await fs.access(sqlitePath);
  } catch {
    return { error: `Dataset "${datasetId}" is not available. Please upload the dataset again.` };
  }

  try {
    const db = await openDatabaseFromFile(sqlitePath);
    const resultSets = db.exec(trimmedQuery);
    db.close();

    if (!resultSets.length) {
      return { data: [] };
    }

    const primary = resultSets[0];
    const data = toPlainRows(primary.columns ?? [], primary.values ?? []);
    console.log(`[data-service] Success. Returning ${data.length} rows.`);
    return { data };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[data-service] Query execution failed:', message);
    return { error: `Query execution failed: ${message}` };
  }
}

