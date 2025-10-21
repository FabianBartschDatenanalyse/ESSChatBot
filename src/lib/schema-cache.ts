import { executeQuery } from '@/src/lib/data-service';

const VALID_IDENTIFIER = /^[A-Za-z0-9_]+$/;
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
const schemaCache = new Map<string, { columns: string[]; fetchedAt: number }>();

const normalizeKey = (value: string) => value.trim().toLowerCase();

export async function fetchTableColumns(tableName: string): Promise<string[]> {
  const trimmed = tableName.trim();
  if (!VALID_IDENTIFIER.test(trimmed)) {
    throw new Error(`Invalid table identifier "${tableName}".`);
  }

  const cacheKey = normalizeKey(trimmed);
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SCHEMA_CACHE_TTL_MS) {
    return cached.columns;
  }

  const query = `
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '${trimmed}'
ORDER BY ordinal_position
`.trim();

  const { data, error } = await executeQuery(query);
  if (error) {
    throw new Error(`Schema query failed for "${tableName}": ${error}`);
  }

  const columns = Array.isArray(data)
    ? data
        .map((row: any) => String(row?.column_name || '').trim())
        .filter((name) => VALID_IDENTIFIER.test(name))
    : [];

  if (!columns.length) {
    throw new Error(`No columns found for table "${tableName}".`);
  }

  schemaCache.set(cacheKey, { columns, fetchedAt: Date.now() });
  return columns;
}

export { VALID_IDENTIFIER };
