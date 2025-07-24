'use server';

import * as dfd from 'danfojs';
import * as tf from '@tensorflow/tfjs';
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
 * Prepares the data and runs a linear regression using TensorFlow.js,
 * utilizing Danfo.js for data loading and manual JS for preprocessing.
 */
export async function runLinearRegression(
  target: string,
  features: string[],
  filters?: Record<string, any>
): Promise<RegressionResponse> {
  console.log(`[stats-service] Starting TF.js linear regression for target '${target}' with features '${features.join(', ')}'.`);

  // 1. Dedupe columns early
  const allColumns = Array.from(new Set([target, ...features]));
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
  
  // Filter out common missing value codes
  for (const col of allColumns) {
    whereClauses.push(`"${col}" NOT IN ('7','8','9','66','77','88','99','55', '777', '888', '999')`);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }
  
  let df: dfd.DataFrame | undefined;
  
  try {
    const { data: queryData, error: queryError } = await executeQuery(query);

    if (queryError) {
      return { error: `SQL query failed: ${queryError}`, sqlQuery: query };
    }

    if (!queryData || queryData.length === 0) {
      return { error: 'No data available for regression after querying. This might be due to filters or missing values.', sqlQuery: query };
    }
    
    df = new dfd.DataFrame(queryData);

    // Helpful debug
    console.log('[stats-service] SQL returned keys:', Object.keys(queryData[0] || {}));

    // Ensure every requested col is present
    const dfCols = df.columns as string[];
    const missing = allColumns.filter(c => !dfCols.includes(c));
    if (missing.length) {
      return {
        error: `These columns are not in the DataFrame: ${missing.join(', ')}. Returned columns were: ${dfCols.join(', ')}`,
        sqlQuery: query,
      };
    }
    
    // --- Manual Casting and NaN check ---
    const toNum = (v: any): number => (v === null || v === '' ? NaN : Number(v));

    const X_vals: number[][] = (df.loc({ columns: features }).values as any[][]).map((r: any[]) => r.map(toNum));
    const y_vals: number[] = (df.loc({ columns: [target] }).values as any[][]).map((r: any[]) => toNum(r[0]));

    // Combine and filter out rows with any NaN values
    const combined = X_vals.map((row, i) => [...row, y_vals[i]]);
    const filtered = combined.filter(row => !row.some(Number.isNaN));

    if (filtered.length < features.length + 2) {
      return { error: `Not enough valid rows after cleaning NaNs (rows=${filtered.length}). Original rows: ${queryData.length}`, sqlQuery: query };
    }

    const X_clean_vals = filtered.map(row => row.slice(0, features.length));
    const y_clean_vals = filtered.map(row => row[features.length]);

    const X = tf.tensor2d(X_clean_vals, [X_clean_vals.length, features.length], 'float32');
    const y = tf.tensor2d(y_clean_vals, [y_clean_vals.length, 1], 'float32');
    
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [features.length] }));
    model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' });

    await model.fit(X, y, { epochs: 100, verbose: 0 });

    const weights = model.getWeights();
    const coefficientsArray = await weights[0].array() as number[][];
    const interceptArray = await weights[1].array() as number[];

    const coefficients: Record<string, number> & { intercept: number } = {
      intercept: interceptArray[0],
    } as any;
    features.forEach((f, i) => {
      coefficients[f] = coefficientsArray[i][0];
    });

    const predictions = model.predict(X) as tf.Tensor;
    const meanY = y.mean();
    const totalSumOfSquares = y.sub(meanY).square().sum();
    const residualSumOfSquares = y.sub(predictions).square().sum();
    const r2Tensor = tf.scalar(1).sub(residualSumOfSquares.div(totalSumOfSquares));
    const r2 = await r2Tensor.array() as number;

    const result: RegressionResult = {
      coefficients,
      r_squared: r2,
      n_observations: filtered.length,
      note: 'Linear regression performed using TensorFlow.js. R-squared is an estimate.',
    };

    tf.dispose([X, y, ...weights, predictions, meanY, totalSumOfSquares, residualSumOfSquares, r2Tensor]);
    
    return { data: result, sqlQuery: query };

  } catch (e: any) {
    const debugInfo = `
      Error: ${e?.message || 'Unknown error'}
      Stack: ${e?.stack}
    `;
    console.error('[stats-service] Regression failed', debugInfo);
    return { error: `Regression analysis failed. Debug Info: ${debugInfo}`, sqlQuery: query };
  }
}
