'use server';

import * as dfd from 'danfojs'; // or danfojs-node for Node runtime
import { executeQuery } from './data-service';

export async function runLinearRegression(
  target: string,
  features: string[],
  filters?: Record<string, any>
): Promise<{ data?: any; error?: string; sqlQuery?: string }> {

  const allColumns = [target, ...features];
  let query = `SELECT ${allColumns.map(c => `"${c}"`).join(', ')} FROM "ESS1"`;

  const whereClauses: string[] = [];

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        whereClauses.push(`"${key}" IN (${value.map(v => `'${v}'`).join(',')})`);
      } else {
        const filterValue = typeof value === 'string' ? `'${value}'` : value;
        whereClauses.push(`"${key}" = ${filterValue}`);
      }
    }
  }

  for (const col of allColumns) {
    whereClauses.push(`"${col}" NOT IN ('7','8','9','77','88','99','777','888','999','66','55')`);
  }
  if (whereClauses.length) query += ` WHERE ${whereClauses.join(' AND ')}`;

  const queryResult = await executeQuery(query);
  if (queryResult.error || !queryResult.data?.length) {
    return { error: `Failed to fetch data: ${queryResult.error || 'No data returned'}`, sqlQuery: query };
  }

  // ---- Variables we’ll inspect in catch ----
  let df: dfd.DataFrame;
  let X_df: dfd.DataFrame;
  let y_sr: dfd.Series;
  let X: number[][];
  let y: number[];

  try {
    df = new dfd.DataFrame(queryResult.data);

    // Cast numerics
    df = df.astype(allColumns.reduce((m, c) => ({ ...m, [c]: 'float32' }), {}));
    df = df.dropNa({ axis: 0 });

    if (df.shape[0] < features.length + 2) {
      return { error: `Not enough valid rows after cleaning (rows=${df.shape[0]})`, sqlQuery: query };
    }

    X_df = df.loc({ columns: features });
    y_sr = df[target] as dfd.Series;

    // ---- Force plain arrays ----
    if ((X_df as any).tensor?.arraySync) {
      X = (X_df as any).tensor.arraySync() as number[][];
      y = (y_sr as any).tensor.arraySync() as number[];
    } else {
      // Fallback if tensor is absent
      X = (X_df.values as any[]).map(row => Array.from(row));
      y = Array.from(y_sr.values as any);
    }

    console.log('[stats-service] X/y checks:', {
      X_isArray: Array.isArray(X),
      y_isArray: Array.isArray(y),
      X0_isArray: Array.isArray(X?.[0]),
      X0: X?.[0],
      y0: y?.[0],
    });

    const model = new dfd.LinearRegression();
    await model.fit(X, y);

    const r2 = await model.score(X, y);

    const result = {
      coefficients: {
        intercept: model.intercept,
        ...features.reduce((o, f, i) => ({ ...o, [f]: model.coef[i] }), {}),
      },
      r_squared: r2,
      n_observations: df.shape[0],
      note: 'p-values are not provided by danfo.js.',
    };

    return { data: result, sqlQuery: query };
  } catch (e: any) {
    const errorDetails = {
      error: e,
      message: e?.message,
      stack: e?.stack,
      X_isArray: Array.isArray(X),
      y_isArray: Array.isArray(y),
      X0: X?.[0],
      y0: y?.[0],
    };
    console.error('[stats-service] Regression failed', errorDetails);
    
    // Create a detailed, multi-line error message string for the LLM
    const errorMessage = `Regression failed: ${e?.message || 'Unknown error'}\n\n` +
                         `DEBUGGING LOGS:\n` +
                         `-----------------\n` +
                         `X isArray: ${errorDetails.X_isArray}\n` +
                         `y isArray: ${errorDetails.y_isArray}\n` +
                         `X[0] sample: ${JSON.stringify(errorDetails.X0)}\n` +
                         `y[0] sample: ${JSON.stringify(errorDetails.y0)}\n` +
                         `Stack: ${errorDetails.stack || 'Not available'}`;

    return { error: errorMessage, sqlQuery: query };
  }
}
