'use server';

/**
 * @fileOverview A Genkit tool for performing statistical analyses using a Node.js library.
 */

import { ai, isAiConfigured, missingAiMessage } from '@/src/ai/genkit';
import { z } from 'zod';
import { executeQuery } from '@/src/lib/data-service';
import { RandomForestRegression } from 'ml-random-forest';
import {
  buildDesignMatrix,
  computeOlsStatistics,
  determineSignificance,
  studentsTCdf,
  studentsTQuantile,
} from './regression-math';
import { DatasetToolContextSchema, DatasetColumn } from '@/src/features/datasets/types';

const computeArrayStats = (values: number[]) => {
  const n = values.length;
  if (!n) {
    return { min: null, max: null, mean: null, stdDev: null };
  }
  const min = values.reduce((acc, v) => (v < acc ? v : acc), values[0]);
  const max = values.reduce((acc, v) => (v > acc ? v : acc), values[0]);
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    n > 1 ? values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    min,
    max,
    mean,
    stdDev: Math.sqrt(Math.max(variance, 0)),
  };
};

const sanitizeLiteral = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const stringValue = String(value);
  if (!stringValue.length) return null;
  const escaped = stringValue.replace(/'/g, "''");
  return `'${escaped}'`;
};

const toNumericLiteral = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return null;
  return parsed.toString();
};

const quoteIdentifier = (identifier: string): string => `"${identifier}"`;
const castAsNumeric = (identifier: string): string => `CAST(${quoteIdentifier(identifier)} AS NUMERIC)`;

type ColumnKind = 'numeric' | 'boolean' | 'categorical';

const normalizeCategoryValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  const normalized = trimmed.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toBooleanNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') {
    if (value === 0) return 0;
    if (value === 1) return 1;
  }
  const normalized = normalizeCategoryValue(value).toLowerCase();
  if (!normalized.length) return null;
  if (['1', 'true', 'yes', 'y', 'ja'].includes(normalized)) return 1;
  if (['0', 'false', 'no', 'n', 'nein'].includes(normalized)) return 0;
  return null;
};

const sanitizeDummyColumnName = (
  featureName: string,
  categoryValue: string,
  existingNames: Set<string>,
): string => {
  const featureBase = featureName.replace(/[^A-Za-z0-9_]/g, '_') || 'feature';
  const normalizedCategory =
    categoryValue
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'category';
  const baseName = `${featureBase}__${normalizedCategory}`;
  let candidate = /^\d/.test(baseName) ? `col_${baseName}` : baseName;
  let suffix = 1;
  while (existingNames.has(candidate)) {
    candidate = `${baseName}_${suffix++}`;
  }
  existingNames.add(candidate);
  return candidate;
};

const determineColumnKind = (
  columnName: string,
  datasetColumns: DatasetColumn[],
  sampleRows: Record<string, unknown>[],
): ColumnKind => {
  const columnMeta = datasetColumns.find((column) => column.name === columnName);
  if (columnMeta) {
    if (columnMeta.dataType === 'number' || columnMeta.measurementLevel === 'metric') {
      return 'numeric';
    }
    if (columnMeta.dataType === 'boolean') {
      return 'boolean';
    }
    if (columnMeta.dataType === 'string') {
      if (columnMeta.measurementLevel === 'metric') {
        return 'numeric';
      }
      return 'categorical';
    }
  }

  const sampleValues = sampleRows
    .map((row) => row[columnName])
    .filter((value) => value !== null && value !== undefined);

  if (!sampleValues.length) {
    return 'numeric';
  }

  const numericPattern = /^-?\d+(?:[.,]\d+)?$/;
  const numericCount = sampleValues.filter((value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    const normalized = normalizeCategoryValue(value);
    if (!normalized.length) return false;
    if (!numericPattern.test(normalized)) return false;
    const parsed = Number.parseFloat(normalized.replace(',', '.'));
    return Number.isFinite(parsed);
  }).length;

  if (numericCount === sampleValues.length) {
    const booleanLike = sampleValues.every((value) => {
      if (typeof value === 'boolean') return true;
      const normalized = normalizeCategoryValue(value).toLowerCase();
      return normalized === '0' || normalized === '1' || normalized === 'true' || normalized === 'false';
    });
    return booleanLike ? 'boolean' : 'numeric';
  }

  const booleanCount = sampleValues.filter((value) => {
    if (typeof value === 'boolean') return true;
    const normalized = normalizeCategoryValue(value).toLowerCase();
    return ['true', 'false', 'yes', 'no', 'y', 'n', 'ja', 'nein', '0', '1'].includes(normalized);
  }).length;

  if (booleanCount === sampleValues.length) {
    return 'boolean';
  }

  return 'categorical';
};

const buildFilterClauses = (filters: Record<string, unknown> | undefined | null): string[] => {
  if (!filters) return [];
  const clauses: string[] = [];

  for (const [column, rawSpec] of Object.entries(filters)) {
    if (rawSpec === undefined || rawSpec === null) continue;

    const columnIdentifier = quoteIdentifier(column);

    const pushInClause = (values: unknown[], operator: 'IN' | 'NOT IN') => {
      if (!values.length) return;

      const numericLiterals = values
        .map(toNumericLiteral)
        .filter((literal): literal is string => literal !== null);

      if (numericLiterals.length === values.length) {
        clauses.push(`${castAsNumeric(column)} ${operator} (${numericLiterals.join(', ')})`);
        return;
      }

      const literals = values
        .map(sanitizeLiteral)
        .filter((literal): literal is string => Boolean(literal));
      if (literals.length) {
        clauses.push(`${columnIdentifier} ${operator} (${literals.join(', ')})`);
      }
    };

    if (Array.isArray(rawSpec)) {
      pushInClause(rawSpec, 'IN');
      continue;
    }

    if (typeof rawSpec === 'object') {
      const spec = rawSpec as Record<string, unknown>;

      if (Array.isArray(spec.in)) {
        pushInClause(spec.in, 'IN');
      }
      if (Array.isArray(spec.notIn)) {
        pushInClause(spec.notIn, 'NOT IN');
      }

      if (Array.isArray(spec.between) && spec.between.length === 2) {
        const low = toNumericLiteral(spec.between[0]);
        const high = toNumericLiteral(spec.between[1]);
        if (low && high) {
          clauses.push(`${castAsNumeric(column)} BETWEEN ${low} AND ${high}`);
        }
      }

      if (spec.gte !== undefined) {
        const literal = toNumericLiteral(spec.gte);
        if (literal) {
          clauses.push(`${castAsNumeric(column)} >= ${literal}`);
        }
      }
      if (spec.lte !== undefined) {
        const literal = toNumericLiteral(spec.lte);
        if (literal) {
          clauses.push(`${castAsNumeric(column)} <= ${literal}`);
        }
      }
      if (spec.gt !== undefined) {
        const literal = toNumericLiteral(spec.gt);
        if (literal) {
          clauses.push(`${castAsNumeric(column)} > ${literal}`);
        }
      }
      if (spec.lt !== undefined) {
        const literal = toNumericLiteral(spec.lt);
        if (literal) {
          clauses.push(`${castAsNumeric(column)} < ${literal}`);
        }
      }

      const equalityValue = spec.eq ?? spec.equals;
      if (equalityValue !== undefined) {
        const numericLiteral = toNumericLiteral(equalityValue);
        if (numericLiteral) {
          clauses.push(`${castAsNumeric(column)} = ${numericLiteral}`);
        } else {
          const literal = sanitizeLiteral(equalityValue);
          if (literal) {
            clauses.push(`${columnIdentifier} = ${literal}`);
          }
        }
      }

      const inequalityValue = spec.neq ?? spec.notEq;
      if (inequalityValue !== undefined) {
        const numericLiteral = toNumericLiteral(inequalityValue);
        if (numericLiteral) {
          clauses.push(`${castAsNumeric(column)} <> ${numericLiteral}`);
        } else {
          const literal = sanitizeLiteral(inequalityValue);
          if (literal) {
            clauses.push(`${columnIdentifier} <> ${literal}`);
          }
        }
      }

      if (spec.isNull === true) {
        clauses.push(`${columnIdentifier} IS NULL`);
      }
      if (spec.isNotNull === true) {
        clauses.push(`${columnIdentifier} IS NOT NULL`);
      }

      continue;
    }

    const numericLiteral = toNumericLiteral(rawSpec);
    if (numericLiteral) {
      clauses.push(`${castAsNumeric(column)} = ${numericLiteral}`);
      continue;
    }

    const literal = sanitizeLiteral(rawSpec);
    if (literal) {
      clauses.push(`${columnIdentifier} = ${literal}`);
    }
  }

  return clauses;
};

type NormalizedFilterResult = {
  baseFilters: Record<string, unknown> | null;
  additionalClauses: string[];
  referencedColumns: string[];
  logMessages: string[];
};

const normalizeFilters = (
  filters: Record<string, unknown> | undefined | null
): NormalizedFilterResult => {
  const baseFilters: Record<string, unknown> = {};
  const referencedColumns = new Set<string>();
  const additionalClauses: string[] = [];
  const logMessages: string[] = [];

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'includeAny' || key === 'exclude') continue;
      if (value === undefined) continue;
      baseFilters[key] = value;
      referencedColumns.add(key);
    }
  }

  const rawExclude = (filters as any)?.exclude;
  if (rawExclude && typeof rawExclude === 'object' && !Array.isArray(rawExclude)) {
    for (const [column, spec] of Object.entries(rawExclude as Record<string, unknown>)) {
      referencedColumns.add(column);
      const exclusion =
        Array.isArray(spec) ? { notIn: spec } : spec !== undefined ? { notEq: spec } : undefined;
      if (!exclusion) continue;
      const clauses = buildFilterClauses({ [column]: exclusion });
      if (clauses.length) {
        additionalClauses.push(...clauses);
      }
    }
    if (additionalClauses.length) {
      logMessages.push('Expanded exclude filters into NOT IN/<> clauses.');
    }
  }

  const includeAnySpec = Array.isArray((filters as any)?.includeAny)
    ? ((filters as any).includeAny as unknown[])
    : [];
  if (includeAnySpec.length) {
    const orBranches: string[] = [];
    for (const entry of includeAnySpec) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const clauseSpec = entry as Record<string, unknown>;
      Object.keys(clauseSpec).forEach((column) => referencedColumns.add(column));
      const clauses = buildFilterClauses(clauseSpec);
      if (!clauses.length) continue;
      const combined = clauses.length === 1 ? clauses[0] : `(${clauses.join(' AND ')})`;
      orBranches.push(combined);
    }
    if (orBranches.length) {
      additionalClauses.push(`(${orBranches.join(' OR ')})`);
      logMessages.push(`Expanded includeAny into OR clause with ${orBranches.length} branch(es).`);
    }
  }

  return {
    baseFilters: Object.keys(baseFilters).length ? baseFilters : null,
    additionalClauses,
    referencedColumns: Array.from(referencedColumns),
    logMessages,
  };
};

const toolInputSchema = z.object({
  dataset: DatasetToolContextSchema,
  analysisType: z
    .enum(['linearRegression', 'randomForestRegression', 'independentTTest'])
    .describe(
      "The statistical procedure to run. Use 'linearRegression' for simple models, 'randomForestRegression' for non-linear regression, and 'independentTTest' to compare two groups on a numeric outcome.",
    ),
  target: z
    .string()
    .describe('The target (dependent) variable for the analysis. Must be a single column name.'),
  features: z
    .array(z.string())
    .describe(
      "A list of feature variables. For regression, supply one or more predictors. For an 'independentTTest', supply exactly one grouping variable.",
    ),
  filters: z
    .record(z.string(), z.any())
    .optional()
    .describe('Key-value pairs to filter the dataset. E.g., { "cntry": "DE" }.'),
});

const toolOutputSchema = z.object({
  sqlQuery: z.string().optional().describe("The SQL query used to fetch the data for analysis."),
  result: z.any().optional().describe("The result of the statistical analysis."),
  error: z.string().optional().describe("An error message if the analysis failed."),
});

export const statisticsTool = ai.defineTool(
  {
    name: 'statisticsTool',
    description:
      "Use this tool to run statistical analyses. Choose 'linearRegression' for simple models, 'randomForestRegression' for more complex, non-linear relationships, or 'independentTTest' to test whether two groups differ on a numeric outcome. Provide a target variable, feature variables, and optional filters.",
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    console.log('[statisticsTool] Received input:', JSON.stringify(input, null, 2));
    let sqlQuery = '';
    const logs: string[] = [`[statisticsTool] Starting ${input.analysisType} analysis.`];

    if (!isAiConfigured) {
      return { error: missingAiMessage };
    }

    try {
      // 1. Construct the SQL query to fetch raw data
      const allColumns = Array.from(new Set([input.target, ...input.features]));
      const normalizedFilters = normalizeFilters(input.filters);

      const datasetColumns = input.dataset.columns ?? [];
      const allowedColumns = datasetColumns.map((column) => column.name);
      if (allowedColumns.length) {
        const allowedSet = new Set(allowedColumns);
        const invalidColumns = allColumns.filter(col => !allowedSet.has(col));
        const invalidFilters = normalizedFilters.referencedColumns.filter(column => !allowedSet.has(column));
        if (invalidColumns.length || invalidFilters.length) {
          const details = [
            invalidColumns.length ? `Unknown target/features: ${invalidColumns.join(', ')}` : null,
            invalidFilters.length ? `Unknown filters: ${invalidFilters.join(', ')}` : null,
          ].filter(Boolean);
          const message = details.length
            ? details.join('; ')
            : 'Requested columns not found in schema.';
          logs.push(`�?O Column validation failed. ${message}`);
          return { error: logs.join('\n'), sqlQuery };
        }
      }
      const selectExpressions = allColumns.map((column) => `${quoteIdentifier(column)}`);
      sqlQuery = `SELECT ${selectExpressions.join(', ')} FROM "${input.dataset.tableName}"`;
      logs.push(
        `Step 1: Constructed initial SELECT clause for table "${input.dataset.tableName}": SELECT ${selectExpressions.join(', ')} FROM "${input.dataset.tableName}"`,
      );

      const whereClauses: string[] = [];
      const filterClauses = buildFilterClauses(normalizedFilters.baseFilters);
      if (filterClauses.length) {
        whereClauses.push(...filterClauses);
      }
      if (normalizedFilters.additionalClauses.length) {
        whereClauses.push(...normalizedFilters.additionalClauses);
      }
      logs.push(
        `Added user-defined filters: ${
          normalizedFilters.baseFilters ? JSON.stringify(normalizedFilters.baseFilters) : 'None'
        }`
      );
      if (normalizedFilters.logMessages.length) {
        logs.push(...normalizedFilters.logMessages);
      }

      // Add dataset-specific filters to exclude missing values
      for (const columnName of allColumns) {
        const columnMeta = datasetColumns.find((column) => column.name === columnName);
        const missingCandidates = new Set(
          [
            ...(input.dataset.defaultMissingValues ?? []),
            ...(columnMeta?.missingValues ?? []),
          ]
            .map((value) => (value === null || value === undefined ? '' : String(value).trim()))
            .filter((value) => value.length > 0),
        );

        whereClauses.push(`${quoteIdentifier(columnName)} IS NOT NULL`);

        if (missingCandidates.size > 0) {
          const literals = Array.from(missingCandidates)
            .map((candidate) => toNumericLiteral(candidate) ?? sanitizeLiteral(candidate))
            .filter((literal): literal is string => Boolean(literal));
          if (literals.length > 0) {
            whereClauses.push(`${quoteIdentifier(columnName)} NOT IN (${literals.join(', ')})`);
          }
        }
      }
      logs.push('Added dataset-specific filters for missing values.');

      if (whereClauses.length > 0) {
        sqlQuery += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      logs.push(`Step 1 Complete: Final SQL Query: ${sqlQuery}`);
      console.log(logs[logs.length-1]);

      // 2. Fetch data from Supabase
      logs.push('Step 2: Fetching data from Supabase...');
      console.log(logs[logs.length-1]);
      const { data: queryData, error: queryError } = await executeQuery(sqlQuery, input.dataset.id);

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

      if (input.analysisType === 'independentTTest') {
        logs.push('Step 3: Preparing data for independent-samples t-test...');
        console.log(logs[logs.length - 1]);

        if (input.features.length !== 1) {
          logs.push('�?O independentTTest expects exactly one grouping variable in features[].');
          return { error: logs.join('\n'), sqlQuery };
        }

        const groupingVariable = input.features[0];
        const grouped = new Map<string, number[]>();

        for (const raw of queryData) {
          const rawTarget = raw[input.target];
          const rawGroup = raw[groupingVariable];
          if (rawTarget === null || rawTarget === undefined) continue;
          if (rawGroup === null || rawGroup === undefined) continue;

          const targetValue = Number.parseFloat(String(rawTarget));
          if (!Number.isFinite(targetValue)) continue;

          const groupKey = String(rawGroup).trim();
          if (!groupKey.length) continue;

          const bucket = grouped.get(groupKey) ?? [];
          bucket.push(targetValue);
          grouped.set(groupKey, bucket);
        }

        const groupEntries = Array.from(grouped.entries()).sort(([a], [b]) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
        );

        if (groupEntries.length !== 2) {
          logs.push(
            `�?O independentTTest requires exactly two groups after filtering, but found ${groupEntries.length}.`,
          );
          return { error: logs.join('\n'), sqlQuery };
        }

        const summarizeGroup = (label: string, values: number[]) => {
          const n = values.length;
          const sum = values.reduce((acc, value) => acc + value, 0);
          const mean = n > 0 ? sum / n : NaN;
          const variance =
            n > 1
              ? values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (n - 1)
              : NaN;
          const stdDev = Number.isFinite(variance) ? Math.sqrt(Math.max(variance, 0)) : NaN;
          const stdError = Number.isFinite(stdDev) && n > 0 ? stdDev / Math.sqrt(n) : NaN;
          return {
            groupValue: label,
            n,
            mean,
            variance,
            stdDev,
            stdError,
          };
        };

        const groupSummaries = groupEntries.map(([label, values]) =>
          summarizeGroup(label, values),
        );

        if (groupSummaries.some((group) => group.n < 2 || !Number.isFinite(group.variance))) {
          logs.push('�?O Each group needs at least two valid observations to run a t-test.');
          return { error: logs.join('\n'), sqlQuery };
        }

        logs.push(
          `Prepared groups ${groupSummaries[0].groupValue} (n=${groupSummaries[0].n}) and ${groupSummaries[1].groupValue} (n=${groupSummaries[1].n}).`,
        );

        const [firstGroup, secondGroup] = groupSummaries;
        const meanDifference = firstGroup.mean - secondGroup.mean;
        const standardError = Math.sqrt(
          firstGroup.variance / firstGroup.n + secondGroup.variance / secondGroup.n,
        );

        if (!Number.isFinite(standardError) || standardError === 0) {
          logs.push('�?O Unable to compute a standard error for the group difference (zero variance).');
          return { error: logs.join('\n'), sqlQuery };
        }

        const numerator = (
          firstGroup.variance / firstGroup.n + secondGroup.variance / secondGroup.n
        ) ** 2;
        const denomPartA =
          firstGroup.n > 1
            ? (firstGroup.variance ** 2) / (firstGroup.n ** 2 * (firstGroup.n - 1))
            : 0;
        const denomPartB =
          secondGroup.n > 1
            ? (secondGroup.variance ** 2) / (secondGroup.n ** 2 * (secondGroup.n - 1))
            : 0;
        const denominator = denomPartA + denomPartB;
        const degreesOfFreedom =
          denominator > 0 ? numerator / denominator : firstGroup.n + secondGroup.n - 2;

        const tStatistic = meanDifference / standardError;
        const rawPValue =
          degreesOfFreedom > 0
            ? 2 * (1 - studentsTCdf(Math.abs(tStatistic), degreesOfFreedom))
            : null;
        const pValue =
          rawPValue !== null ? Math.min(Math.max(rawPValue, 0), 1) : null;

        const confidenceLevel = 0.95;
        let confidenceInterval: { lower: number | null; upper: number | null } = {
          lower: null,
          upper: null,
        };
        if (degreesOfFreedom > 0) {
          const critical = studentsTQuantile(
            1 - (1 - confidenceLevel) / 2,
            degreesOfFreedom,
          );
          if (Number.isFinite(critical)) {
            const margin = critical * standardError;
            confidenceInterval = {
              lower: meanDifference - margin,
              upper: meanDifference + margin,
            };
          }
        }
        const normalizedConfidenceInterval = {
          lower:
            confidenceInterval.lower !== null && Number.isFinite(confidenceInterval.lower)
              ? confidenceInterval.lower
              : null,
          upper:
            confidenceInterval.upper !== null && Number.isFinite(confidenceInterval.upper)
              ? confidenceInterval.upper
              : null,
        };

        let cohensD: number | null = null;
        let hedgesG: number | null = null;
        if (firstGroup.n > 1 && secondGroup.n > 1) {
          const pooledVariance =
            ((firstGroup.n - 1) * firstGroup.variance +
              (secondGroup.n - 1) * secondGroup.variance) /
            (firstGroup.n + secondGroup.n - 2);
          if (pooledVariance > 0) {
            const pooledStd = Math.sqrt(pooledVariance);
            if (pooledStd > 0) {
              cohensD = meanDifference / pooledStd;
              const correction = 1 - 3 / (4 * (firstGroup.n + secondGroup.n) - 9);
              hedgesG = cohensD * correction;
            }
          }
        }

        const analysisResult = {
          model: 'Independent Samples t-Test',
          target: input.target,
          groupingVariable,
          groups: groupSummaries.map((group) => ({
            groupValue: group.groupValue,
            n: group.n,
            mean: group.mean,
            stdDev: Number.isFinite(group.stdDev) ? group.stdDev : null,
            standardError: Number.isFinite(group.stdError) ? group.stdError : null,
          })),
          difference: {
            referenceGroup: firstGroup.groupValue,
            comparisonGroup: secondGroup.groupValue,
            meanDifference,
            standardError,
            degreesOfFreedom,
            tStatistic,
            pValue,
            significance: pValue !== null ? determineSignificance(pValue) : null,
            confidenceInterval: {
              ...normalizedConfidenceInterval,
              level: confidenceLevel,
            },
          },
          effectSize: {
            cohensD: cohensD !== null && Number.isFinite(cohensD) ? cohensD : null,
            hedgesG: hedgesG !== null && Number.isFinite(hedgesG) ? hedgesG : null,
          },
          assumptions: [
            'Unabhaengige Stichproben pro Gruppe',
            'Zielvariable ist intervallskaliert und annaehernd normalverteilt oder Stichproben sind gross (CLT)',
            'Welch-t-Test erlaubt unterschiedliche Varianzen',
          ],
        };

        logs.push('Step 4: Welch t-test computed successfully.');
        console.log('[statisticsTool] Analysis successful.');
        return { result: analysisResult, sqlQuery };
      }

      // 3. Transform data for the regression analysis
      logs.push('Step 3: Transforming data for regression analysis...');
      console.log(logs[logs.length - 1]);

      const sampleRows = queryData
        .slice(0, Math.min(queryData.length, 200))
        .map((row) => row as Record<string, unknown>);

      const columnKinds = new Map<string, ColumnKind>();
      for (const columnName of allColumns) {
        columnKinds.set(columnName, determineColumnKind(columnName, datasetColumns, sampleRows));
      }

      const targetKind = columnKinds.get(input.target) ?? 'numeric';
      if (targetKind === 'categorical') {
        logs.push(
          `ERROR Target variable "${input.target}" appears categorical. Numeric target required for ${input.analysisType}.`,
        );
        return { error: logs.join('\n'), sqlQuery };
      }

      type FeatureEncoding = {
        originalName: string;
        kind: ColumnKind;
        outputColumns: string[];
        categories?: string[];
        baseline?: string;
      };

      const existingFeatureNames = new Set<string>(allColumns);
      const featureEncodings = new Map<string, FeatureEncoding>();
      const featureEngineeringNotes: string[] = [];

      for (const feature of input.features) {
        const kind = columnKinds.get(feature) ?? 'numeric';

        if (kind === 'categorical') {
          const categories = Array.from(
            new Set(
              queryData
                .map((row) => normalizeCategoryValue(row[feature]))
                .filter((value) => value.length > 0),
            ),
          );

          if (categories.length <= 1) {
            logs.push(
              `INFO Feature "${feature}" dropped because only one category remains after filtering.`,
            );
            featureEngineeringNotes.push(`Feature "${feature}" dropped (single category).`);
            continue;
          }

          categories.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
          const baseline = categories[0];
          const dummyColumns = categories.slice(1).map((category) =>
            sanitizeDummyColumnName(feature, category, existingFeatureNames),
          );

          featureEncodings.set(feature, {
            originalName: feature,
            kind,
            categories,
            baseline,
            outputColumns: dummyColumns,
          });

          featureEngineeringNotes.push(
            `Feature "${feature}" encoded into ${dummyColumns.join(', ')} (baseline "${baseline}").`,
          );
          continue;
        }

        if (kind === 'boolean') {
          featureEncodings.set(feature, {
            originalName: feature,
            kind,
            outputColumns: [feature],
          });
          featureEngineeringNotes.push(`Feature "${feature}" coerced to 0/1 from boolean values.`);
          continue;
        }

        featureEncodings.set(feature, {
          originalName: feature,
          kind: 'numeric',
          outputColumns: [feature],
        });
      }

      if (!featureEncodings.size) {
        logs.push('ERROR No usable features remain after preprocessing.');
        return { error: logs.join('\n'), sqlQuery };
      }

      const typedRows: Record<string, number>[] = [];
      const unknownCategoricalValues = new Map<string, Set<string>>();

      for (const raw of queryData) {
        const row: Record<string, number> = {};
        let ok = true;

        const targetValue =
          targetKind === 'boolean'
            ? toBooleanNumeric(raw[input.target])
            : toNumericValue(raw[input.target]);
        if (targetValue === null) {
          ok = false;
        } else {
          row[input.target] = targetValue;
        }

        if (!ok) continue;

        for (const [featureName, encoding] of featureEncodings.entries()) {
          if (encoding.kind === 'numeric') {
            const value = toNumericValue(raw[featureName]);
            if (value === null) {
              ok = false;
              break;
            }
            row[encoding.outputColumns[0]] = value;
            continue;
          }

          if (encoding.kind === 'boolean') {
            const value = toBooleanNumeric(raw[featureName]);
            if (value === null) {
              ok = false;
              break;
            }
            row[encoding.outputColumns[0]] = value;
            continue;
          }

          const normalized = normalizeCategoryValue(raw[featureName]);
          for (const columnName of encoding.outputColumns) {
            row[columnName] = 0;
          }

          if (!normalized) {
            ok = false;
            break;
          }

          const categories = encoding.categories ?? [];
          const categoryIndex = categories.indexOf(normalized);
          if (categoryIndex === -1) {
            let unknownSet = unknownCategoricalValues.get(featureName);
            if (!unknownSet) {
              unknownSet = new Set<string>();
              unknownCategoricalValues.set(featureName, unknownSet);
            }
            unknownSet.add(normalized);
            continue;
          }

          if (categoryIndex > 0) {
            const columnName = encoding.outputColumns[categoryIndex - 1];
            row[columnName] = 1;
          }
        }

        if (ok) {
          typedRows.push(row);
        }
      }

      if (unknownCategoricalValues.size) {
        for (const [featureName, values] of unknownCategoricalValues.entries()) {
          logs.push(
            `INFO Feature "${featureName}" encountered unseen categories (${Array.from(values).join(
              ', ',
            )}); treated as baseline.`,
          );
        }
      }

      if (typedRows.length < 10) {
        logs.push(`ERROR Not enough clean rows after preprocessing. Found ${typedRows.length}.`);
        console.warn(logs[logs.length - 1]);
        return { error: logs.join('\n'), sqlQuery };
      }

      if (featureEncodings.has('agea')) {
        const encoding = featureEncodings.get('agea');
        if (encoding && encoding.kind === 'numeric') {
          const sourceColumn = encoding.outputColumns[0];
          const meanAge =
            typedRows.reduce((sum, row) => sum + (row[sourceColumn] ?? 0), 0) / typedRows.length;
          const centeredColumn = 'agea_centered';
          for (const row of typedRows) {
            row[centeredColumn] = row[sourceColumn] - meanAge;
          }
          encoding.outputColumns = [centeredColumn];
          featureEngineeringNotes.push(
            `Feature "agea" centered to "${centeredColumn}" (mean ${meanAge.toFixed(2)}).`,
          );
        }
      }

      const finalFeatureColumns = Array.from(featureEncodings.values()).flatMap(
        (encoding) => encoding.outputColumns,
      );
      const uniqueFeatures = Array.from(new Set(finalFeatureColumns));

      if (!uniqueFeatures.length) {
        logs.push('ERROR No predictor columns available after feature encoding.');
        return { error: logs.join('\n'), sqlQuery };
      }

      const X = typedRows.map((r) => uniqueFeatures.map((f) => r[f] ?? 0));
      const y = typedRows.map((r) => r[input.target]);
      logs.push(`Transformed data into ${typedRows.length} clean rows.`);
      logs.push(`Prepared ${uniqueFeatures.length} predictor columns for analysis.`);
      logs.push(`Step 3 Complete: Data prepared for regression with ${X.length} samples.`);

      // 4. Perform regression analysis
      logs.push(`Step 4: Performing ${input.analysisType} analysis in Node.js...`);
      console.log(logs[logs.length - 1]);
      
      let analysisResult;

      if (input.analysisType === 'randomForestRegression') {
        const model = new RandomForestRegression({
            nEstimators: 10
        });
        model.train(X, y);
        // Random Forest doesn't have simple coefficients/intercept. 
        // We'll return a message about feature importance, which is more relevant.
        // For now, we'll return a success message. A real implementation might extract feature importances.
        analysisResult = {
            model: "Random Forest Regression",
            target: input.target,
            predictors: uniqueFeatures,
            observations: X.length,
            message: "Model trained successfully.",
            featureEngineering: featureEngineeringNotes,
        };
        logs.push('Random Forest model trained.');
      } else { // Default to linear regression
        const { design, featureNames: designFeatureNames } = buildDesignMatrix(typedRows, uniqueFeatures);
        const regressionStats = computeOlsStatistics(design, y, designFeatureNames);
        if (!regressionStats) {
          logs.push('�?O Failed to compute OLS statistics (singular matrix).');
          return { error: logs.join('\n'), sqlQuery };
        }

        const coefficientMap = regressionStats.coefficients.reduce((acc, item) => {
          acc[item.term] = item.coefficient;
          return acc;
        }, {} as Record<string, number>);

        const residualStats = computeArrayStats(regressionStats.residuals);
        const fittedStats = computeArrayStats(regressionStats.fitted);

        analysisResult = {
          model: "Linear Regression",
          target: input.target,
          predictors: uniqueFeatures,
          observations: regressionStats.model.observations,
          intercept: coefficientMap['Intercept'] ?? 0,
          coefficientsByTerm: coefficientMap,
          coefficientTable: regressionStats.coefficients,
          modelSummary: regressionStats.model,
          diagnostics: {
            residuals: {
              ...residualStats,
              sse: regressionStats.sse,
            },
            fitted: fittedStats,
            sst: regressionStats.sst,
            responseMean: regressionStats.responseMean,
            confidenceLevel: 0.95,
          },
          featureEngineering: featureEngineeringNotes,
        };
      }
      
      logs.push('Step 4 Complete: Regression analysis finished successfully.');
      console.log('[statisticsTool] Analysis successful.');
      return { result: analysisResult, sqlQuery };

    } catch (e: any) {
      logs.push(`💥 Unexpected error in statisticsTool: ${e.message || 'Unknown error'}`);
      console.error('[statisticsTool]', e);
      return { error: logs.join('\n'), sqlQuery };
    }
  }
);

