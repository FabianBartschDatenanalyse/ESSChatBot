'use server';

/**
 * @fileOverview A Genkit tool for performing statistical analyses using a Node.js library.
 */

import { ai, isAiConfigured, missingAiMessage } from '@/src/ai/genkit';
import { z } from 'zod';
import { executeQuery } from '@/src/lib/data-service';
import { fetchTableColumns } from '@/src/lib/schema-cache';
import { RandomForestRegression } from 'ml-random-forest';
import { buildDesignMatrix, computeOlsStatistics } from './regression-math';

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
const castAsInteger = (identifier: string): string => `CAST(${quoteIdentifier(identifier)} AS INTEGER)`;
const castAsNumeric = (identifier: string): string => `CAST(${quoteIdentifier(identifier)} AS NUMERIC)`;

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
  analysisType: z.enum(['linearRegression', 'randomForestRegression']).describe("The type of regression to perform. Use 'linearRegression' for simple relationships and 'randomForestRegression' for more complex, potentially non-linear models."),
  target: z.string().describe('The target (dependent) variable for the analysis. Must be a single column name.'),
  features: z.array(z.string()).describe('A list of one or more feature (independent) variables. Must be column names.'),
  filters: z.record(z.string(), z.any()).optional().describe('Key-value pairs to filter the dataset. E.g., { "cntry": "DE" }.'),
  codebookContext: z.string().describe('Relevant context from the database codebook.'),
});

const toolOutputSchema = z.object({
  sqlQuery: z.string().optional().describe("The SQL query used to fetch the data for analysis."),
  result: z.any().optional().describe("The result of the statistical analysis."),
  error: z.string().optional().describe("An error message if the analysis failed."),
});

export const statisticsTool = ai.defineTool(
  {
    name: 'statisticsTool',
    description: "Use this tool to perform regression analysis. Choose 'linearRegression' for simple models or 'randomForestRegression' for more complex, non-linear relationships. Provide a target variable, feature variables, and optional filters.",
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

      let allowedColumns: string[] = [];
      try {
        allowedColumns = await fetchTableColumns('ESS1');
      } catch (schemaError) {
        logs.push('[statisticsTool] Warning: Failed to fetch table schema; proceeding without whitelist.');
        console.warn('[statisticsTool] Schema lookup failed.', schemaError);
      }
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
      const selectExpressions = allColumns.map((column) => `${castAsInteger(column)} AS ${quoteIdentifier(column)}`);
      sqlQuery = `SELECT ${selectExpressions.join(', ')} FROM "ESS1"`;
      logs.push(`Step 1: Constructed initial SELECT clause with integer casts: SELECT ${selectExpressions.join(', ')} FROM "ESS1"`);

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

      // Add generic filters to exclude common missing values
      for (const col of allColumns) {
         if (col === 'gndr') {
            whereClauses.push(`${castAsInteger(col)} IN (1, 2)`);
         } else {
            whereClauses.push(`${castAsInteger(col)} NOT IN (7, 8, 9, 55, 66, 77, 88, 99, 555, 777, 888, 999, 9999)`);
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
      
      // 3. Transform data for the regression analysis
      logs.push('Step 3: Transforming data for regression analysis...');
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

      const hasGndr = allColumns.includes('gndr');
      const hasAgea = allColumns.includes('agea');

      const featureEngineeringNotes: string[] = [];

      if (hasAgea) {
        const meanAge = typedRows.reduce((sum, r) => sum + (r.agea || 0), 0) / typedRows.length;
        logs.push(`Engineering feature: "agec" from "agea". Calculated mean age: ${meanAge.toFixed(2)}`);
        for (const r of typedRows) r.agec = r.agea - meanAge;
        featureEngineeringNotes.push('agec = agea - mean(agea)');
      }
      if (hasGndr) {
         logs.push('Engineering feature: "female" from "gndr".');
         for (const r of typedRows) r.female = r.gndr === 2 ? 1 : 0;
         featureEngineeringNotes.push('female = 1 for gndr==2, else 0');
      }
      
      const finalFeatures = input.features.map(f => {
          if (f === 'gndr') return 'female';
          if (f === 'agea') return 'agec';
          return f;
      });
      const uniqueFeatures = Array.from(new Set(finalFeatures));

      const X = typedRows.map(r => uniqueFeatures.map(f => r[f]));
      const y = typedRows.map(r => r[input.target]);
      
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
