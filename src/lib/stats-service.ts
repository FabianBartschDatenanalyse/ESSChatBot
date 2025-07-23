'use server';

import * as dfd from 'danfojs-node'; // or 'danfojs-node' if you're on Node runtime
import { executeQuery } from './data-service';

/**
 * Result returned by runLinearRegression
 */
export interface RegressionResult {
  coefficients: Record<string, number> & { intercept: number };
  r_squared: number;
  n_observations: number;
  note: string;
}

export interface RegressionResponse {
  data?: RegressionResult;
  error?: string;
  sqlQuery?: string;
}

/**
 * Prepares the data and runs a linear regression using Danfo.js, avoiding the common
 * `values.includes is not a function` error by forcing plain JS arrays and avoiding
 * APIs that may not exist in some Danfo builds (e.g. df.astype).
 */
export async function runLinearRegression(
  target: string,
  features: string[],
  filters?: Record<string, any>
): Promise<RegressionResponse> {
  console.log(`[stats-service] Starting linear regression for target '${target}' with features '${features.join(', ')}'.`);

  const allColumns = [target, ...features];

  // ------------------- 1. Build SQL query -------------------
  let query = `SELECT ${allColumns.map((c) => `"${c}"`).join(', ')} FROM "ESS1"`;
  const whereClauses: string[] = [];

  // User-supplied filters
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        const inVals = value.map((v) => (typeof v === 'string' ? `'${v}'` : v)).join(',');
        whereClauses.push(`"${key}" IN (${inVals})`);
      } else {
        const filterValue = typeof value === 'string' ? `'${value}'` : value;
        whereClauses.push(`"${key}" = ${filterValue}`);
      }
    }
  }

  // Exclude common missing codes (strings in DB)
  const missings = ['7', '8', '9', '77', '88', '99', '777', '888', '999', '66', '55'];
  for (const col of allColumns) {
    whereClauses.push(`"${col}" NOT IN (${missings.map((m) => `'${m}'`).join(',')})`);
  }

  if (whereClauses.length) query += ` WHERE ${whereClauses.join(' AND ')}`;
  console.log('[stats-service] Executing data retrieval query:', query);

  // ------------------- 2. Fetch data -------------------
  const queryResult = await executeQuery(query);
  if (queryResult.error || !queryResult.data || queryResult.data.length === 0) {
    const errorMsg = `Failed to fetch data for regression: ${queryResult.error || 'No data returned'}`;
    console.error(`[stats-service] ${errorMsg}`);
    return { error: errorMsg, sqlQuery: query };
  }
  console.log(`[stats-service] Successfully fetched ${queryResult.data.length} rows.`);

  // ------------------- Variables for catch logging -------------------
  let df: dfd.DataFrame | undefined;
  let X_df: dfd.DataFrame | undefined;
  let y_sr: dfd.Series | undefined;
  let X: number[][] | undefined;
  let y: number[] | undefined;

  try {
    // ------------------- 3. Create DataFrame -------------------
    df = new dfd.DataFrame(queryResult.data);
    console.log('[stats-service] DataFrame created. Shape before cleaning:', df.shape);

    // ------------------- 4. Numeric coercion (no df.astype) -------------------
    for (const col of allColumns) {
      const ser = (df as dfd.DataFrame)[col].apply((v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
      }, { axis: 0 });
      df.addColumn(col, ser, { inplace: true });
    }

    // Drop rows with NaN values after casting
    df = df.dropNa({ axis: 0 });
    console.log('[stats-service] DataFrame shape after cleaning (dropping NaNs):', df.shape);

    if (df.shape[0] < features.length + 2) {
      const errorMsg = `Not enough valid data points to run a regression after cleaning. (Rows: ${df.shape[0]}, Features: ${features.length + 1})`;
      console.error(`[stats-service] ${errorMsg}`);
      return { error: errorMsg, sqlQuery: query };
    }

    // ------------------- 5. Split X / y -------------------
    X_df = df.loc({ columns: features });
    y_sr = df[target] as dfd.Series;

    // ------------------- 6. Force Plain JS arrays -------------------
    const toPlain2D = (obj: any): number[][] => {
      if (obj?.tensor?.arraySync) return obj.tensor.arraySync();
      if (Array.isArray(obj?.values)) return (obj.values as any[]).map((r) => Array.from(r));
      // last resort: DataFrame -> Series[] -> numbers
      return obj?.values ? Array.from(obj.values) : [];
    };

    const toPlain1D = (obj: any): number[] => {
      if (obj?.tensor?.arraySync) return obj.tensor.arraySync();
      if (obj?.values) return Array.from(obj.values as any);
      return [];
    };

    X = toPlain2D(X_df);
    y = toPlain1D(y_sr);

    console.log('[stats-service] X/y checks:', {
      X_isArray: Array.isArray(X),
      y_isArray: Array.isArray(y),
      X0_isArray: Array.isArray(X?.[0]),
      X0: X?.[0],
      y0: y?.[0],
    });

    console.log('[stats-service] Data before fitting model:', {
          X_type: typeof X,
          y_type: typeof y,
          X_isArray: Array.isArray(X),
          y_isArray: Array.isArray(y),
          X_sample: X?.[0],
          y_sample: y?.[0],
          X_shape: (X as any)?.shape, // Attempt to log shape if it's a DataFrame
          y_shape: (y as any)?.shape,
        });

    // ------------------- 7. Fit model -------------------
    const model = new dfd.LinearRegression();
    await model.fit(X, y);

    // ------------------- 8. Score & format -------------------
    const r2 = await model.score(X, y);

    const coefficients: Record<string, number> & { intercept: number } = {
      intercept: model.intercept,
    } as any;
    features.forEach((f, i) => {
      coefficients[f] = model.coef[i];
    });

    const result: RegressionResult = {
      coefficients,
      r_squared: r2,
      n_observations: df.shape[0],
      note: 'p-values are not provided by the underlying danfo.js library.',
    };

    console.log('[stats-service] Regression calculation successful:', result);
    return { data: result, sqlQuery: query };
  } catch (e: any) {
    const errorDetails = {
      message: e?.message,
      stack: e?.stack,
      X_isArray: Array.isArray(X),
      y_isArray: Array.isArray(y),
      X0: X?.[0],
      y0: y?.[0],
    };

    console.error('[stats-service] Regression failed', e, errorDetails);

    const errorMessage = `Regression failed: ${e?.message || 'Unknown error'}

` +
      `DEBUGGING LOGS:
` +
      `-----------------
` +
      `X isArray: ${errorDetails.X_isArray}
` +
      `y isArray: ${errorDetails.y_isArray}
` +
      `X[0] sample: ${JSON.stringify(errorDetails.X0)}
` +
      `y[0] sample: ${JSON.stringify(errorDetails.y0)}
` +
      `Stack: ${errorDetails.stack || 'Not available'}`;

    return { error: errorMessage, sqlQuery: query };
  }
}
