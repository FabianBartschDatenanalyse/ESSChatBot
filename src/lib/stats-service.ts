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
  console.log(`[stats-service] Starting TF.js linear regression for target '${target}' with features '${features.join(', ')}'.`);

  // ---- Hoist variables for debugging in catch block ----
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
  
  // Filter out common missing value codes
  for (const col of allColumns) {
    whereClauses.push(`"${col}" NOT IN ('7','8','9','66','77','88','99','55', '777', '888', '999')`);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }
  
  let df: dfd.DataFrame | undefined;
  let X: tf.Tensor | undefined;
  let y: tf.Tensor | undefined;
  
  try {
    // ---- Execute Query ----
    const { data: queryData, error: queryError } = await executeQuery(query);

    if (queryError) {
      return { error: `SQL query failed: ${queryError}`, sqlQuery: query };
    }

    if (!queryData || queryData.length === 0) {
      return { error: 'No data available for regression after querying. This might be due to filters or missing values.', sqlQuery: query };
    }
    
    // ---- Load and Prepare Data with Danfo.js ----
    df = new dfd.DataFrame(queryData);
    df = df.dropNa({ axis: 0 }); // Drop rows with any NaN values
    
    console.log('[stats-service] DataFrame shape after cleaning:', df.shape);

    if (df.shape[0] < features.length + 2) {
      return { error: `Not enough valid rows after cleaning (rows=${df.shape[0]}) to perform regression.`, sqlQuery: query };
    }

    // --- Select relevant columns and convert to float32 for TensorFlow ---
    const dataForRegression = df.loc({ columns: allColumns });
    const typedData = dataForRegression.asType(allColumns, 'float32');

    // ---- Create Tensors from DataFrame ----
    X = (typedData.loc({ columns: features }).tensor as tf.Tensor);
    y = (typedData.loc({ columns: [target] }).tensor as tf.Tensor);
    
    // ---- Build and Train Model with TensorFlow.js ----
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [features.length] }));
    model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' });

    console.log('[stats-service] Training TensorFlow.js model...');
    await model.fit(X, y, { epochs: 100, verbose: 0 }); // Use verbose: 0 to reduce console noise
    console.log('[stats-service] Model training complete.');

    // ---- Extract Results ----
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
      n_observations: df.shape[0],
      note: 'Linear regression performed using TensorFlow.js. R-squared is an estimate.',
    };

    // Clean up tensors
    tf.dispose([X, y, ...weights, predictions, meanY, totalSumOfSquares, residualSumOfSquares, r2Tensor]);
    
    console.log('[stats-service] Regression calculation successful.');
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
