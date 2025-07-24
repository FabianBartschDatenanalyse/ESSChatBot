'use server';

import * as tf from '@tensorflow/tfjs';
import { executeQuery } from './data-service';

/**
 * Result returned by runLinearRegression
 */
export interface RegressionResult {
  coefficients: Record<string, number> & { intercept: number };
  r_squared: number | null;
  n_observations: number;
  note: string;
}

export interface RegressionResponse {
  data?: RegressionResult;
  error?: string;
  sqlQuery?: string;
}


// helper: make sure nothing unserializable leaks out
function jsonSafe<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(
      obj,
      (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)
    )
  );
}


/**
 * Prepares the data and runs a linear regression using TensorFlow.js.
 */
export async function runLinearRegression(
  target: string,
  features: string[],
  filters?: Record<string, any>
): Promise<RegressionResponse> {
  let query = '';
  
  try {
    const allColumns = Array.from(new Set([target, ...features]));
    query = `SELECT ${allColumns.map(c => `"${c}"`).join(', ')} FROM "ESS1"`;

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
  
    // Filter out common missing value codes for all columns involved
    for (const col of allColumns) {
       // For gender, explicitly select valid categories.
      if (col === 'gndr') {
          whereClauses.push(`"gndr" IN ('1', '2')`);
      } else {
          // General exclusion for other numeric-like columns
          whereClauses.push(`"${col}" NOT IN ('7','8','9','66','77','88','99','55', '777', '888', '999')`);
      }
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const { data: queryData, error: queryError } = await executeQuery(query);

    if (queryError) {
      return jsonSafe({ error: `SQL query failed: ${queryError}`, sqlQuery: query });
    }

    if (!queryData || queryData.length === 0) {
      return jsonSafe({ error: 'No data available for regression after querying. This might be due to filters or missing values.', sqlQuery: query });
    }
    
    // Validate that all requested columns were returned
    const returnedCols = Object.keys(queryData[0] || {});
    const missingCols = allColumns.filter(c => !returnedCols.includes(c));
    if (missingCols.length > 0) {
        return jsonSafe({
            error: `These columns are not in the DataFrame: ${missingCols.join(', ')}. Returned columns were: ${returnedCols.join(', ')}`,
            sqlQuery: query
        });
    }

    const toNum = (v: any): number => (v === null || v === '' || v === undefined || Number.isNaN(Number(v))) ? NaN : Number(v);
    
    const combinedData = queryData.map(row => {
        const featureValues = features.map(f => toNum(row[f]));
        const targetValue = toNum(row[target]);
        return [...featureValues, targetValue];
    });

    const filteredData = combinedData.filter(row => !row.some(Number.isNaN));
    
    if (filteredData.length < features.length + 2) {
      return jsonSafe({ 
          error: `Not enough valid rows after cleaning NaNs (rows=${filteredData.length}). Original rows from query: ${queryData.length}. This often happens if filters are too restrictive or data contains unexpected non-numeric values.`, 
          sqlQuery: query 
      });
    }

    const X_clean_vals = filteredData.map(row => row.slice(0, features.length));
    const y_clean_vals = filteredData.map(row => row[features.length]);

    const X = tf.tensor2d(X_clean_vals, [X_clean_vals.length, features.length], 'float32');
    const y = tf.tensor2d(y_clean_vals, [y_clean_vals.length, 1], 'float32');
    
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [features.length] }));
    model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' });

    await model.fit(X, y, { epochs: 100, verbose: 0 });

    const [W, b] = model.getWeights();
    const coefficientsData = W.arraySync() as number[][];
    const interceptData = b.arraySync() as number[];

    const coefficients: Record<string, number> & { intercept: number } = {
      intercept: interceptData[0] ?? 0,
    };
    features.forEach((f, i) => {
      coefficients[f] = coefficientsData[i][0] ?? 0;
    });

    const predictions = model.predict(X) as tf.Tensor;
    const meanY = y.mean();
    const totalSumOfSquares = y.sub(meanY).square().sum();
    const residualSumOfSquares = y.sub(predictions).square().sum();
    const r2Tensor = tf.scalar(1).sub(residualSumOfSquares.div(totalSumOfSquares));
    let r2 = r2Tensor.arraySync() as number;

    if (!Number.isFinite(r2)) {
      r2 = null as any;
    }

    const result: RegressionResult = {
      coefficients,
      r_squared: r2,
      n_observations: filteredData.length,
      note: 'Linear regression performed using TensorFlow.js. R-squared is an estimate.',
    };
    
    tf.dispose([X, y, W, b, predictions, meanY, totalSumOfSquares, residualSumOfSquares, r2Tensor]);
    
    return jsonSafe({ data: result, sqlQuery: query });

  } catch (e: any) {
    // Keep it tiny & serializable
    console.error("[stats-service] CATCH BLOCK ERROR:", e);
    return jsonSafe({
      error: `Regression analysis failed: ${e?.message ?? 'Unknown error'}.`,
      sqlQuery: typeof query !== 'undefined' ? query : undefined,
    });
  }
}
