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
 * utilizing Danfo.js for data handling.
 */
export async function runLinearRegression(
  target: string,
  features: string[],
  filters?: Record<string, any>
): Promise<RegressionResponse> {
  console.log(`[stats-service] Starting linear regression for target '${target}' with features '${features.join(', ')}'.`);

  // ---- Hoist variables for debugging in catch block ----
  let df: dfd.DataFrame;
  let X_df: dfd.DataFrame;
  let y_sr: dfd.Series;
  let X: number[][];
  let y: number[];
  let query: string = '';

  try {
    // ------------------- 1. Construct SQL Query -------------------
    const allColumns = [target, ...features];
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

    // Add WHERE clauses to filter out common missing value codes
    for (const col of allColumns) {
      whereClauses.push(`"${col}" NOT IN ('7','8','9','77','88','99','66','55', '777', '888', '999')`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // ------------------- 2. Execute Query -------------------
    console.log('[stats-service] Executing SQL query:', query);
    const { data: queryData, error: queryError } = await executeQuery(query);

    if (queryError) {
      throw new Error(`SQL query failed: ${queryError}`);
    }

    if (!queryData || queryData.length === 0) {
      return { error: 'No data available for regression after querying', sqlQuery: query };
    }

    // ------------------- 3. Load and Prepare Data -------------------
    df = new dfd.DataFrame(queryData);
    
    // Cast all relevant columns to float32 for TensorFlow
    const dtypes = allColumns.reduce((acc, col) => {
        acc[col] = 'float32';
        return acc;
    }, {} as {[key: string]: string});

    df = df.astype(dtypes) as dfd.DataFrame;
    
    df = df.dropNa({ axis: 0 });
    
    console.log('[stats-service] DataFrame shape after cleaning:', df.shape);

    if (df.shape[0] < features.length + 2) {
      return { error: `Not enough valid rows after cleaning (rows=${df.shape[0]}) to perform regression.`, sqlQuery: query };
    }

    // ------------------- 4. Create Tensors from Plain Arrays -------------------
    X_df = df.loc({ columns: features });
    y_sr = df[target] as dfd.Series;

    // Force conversion to plain JavaScript arrays
    X = X_df.values as number[][];
    y = y_sr.values as number[];
    
    const X_tensor = tf.tensor2d(X);
    const y_tensor = tf.tensor2d(y, [y.length, 1]);
    
    // ------------------- 5. Build and Train Model -------------------
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [features.length] }));
    model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' });

    console.log('[stats-service] Training TensorFlow.js model...');
    await model.fit(X_tensor, y_tensor, { epochs: 100 });
    console.log('[stats-service] Model training complete.');

    // ------------------- 6. Extract Results -------------------
    const weights = model.getWeights();
    const coefficientsArray = await weights[0].array() as number[][];
    const interceptArray = await weights[1].array() as number[];

    const coefficients: Record<string, number> & { intercept: number } = {
      intercept: interceptArray[0],
    } as any;
    features.forEach((f, i) => {
      coefficients[f] = coefficientsArray[i][0];
    });

    const predictions = model.predict(X_tensor) as tf.Tensor;
    const meanY = y_tensor.mean();
    const totalSumOfSquares = y_tensor.sub(meanY).square().sum();
    const residualSumOfSquares = y_tensor.sub(predictions).square().sum();
    const r2Tensor = tf.scalar(1).sub(residualSumOfSquares.div(totalSumOfSquares));
    const r2 = await r2Tensor.array() as number;

    const result: RegressionResult = {
      coefficients,
      r_squared: r2,
      n_observations: df.shape[0],
      note: 'Linear regression performed using TensorFlow.js. R-squared is an estimate.',
    };

    // Clean up tensors
    tf.dispose([X_tensor, y_tensor, ...weights, predictions, meanY, totalSumOfSquares, residualSumOfSquares, r2Tensor]);
    
    console.log('[stats-service] Regression calculation successful.');
    return { data: result, sqlQuery: query };

  } catch (e: any) {
    const debugInfo = `
      Error: ${e?.message || 'Unknown error'}
      X isArray: ${Array.isArray(X)}
      y isArray: ${Array.isArray(y)}
      X[0] isArray: ${Array.isArray(X?.[0])}
      Sample X[0]: ${JSON.stringify(X?.[0])}
      Sample y[0]: ${JSON.stringify(y?.[0])}
      Stack: ${e?.stack}
    `;
    console.error('[stats-service] Regression failed', debugInfo);
    return { error: `Regression analysis failed. Debug Info: ${debugInfo}`, sqlQuery: query };
  }
}
