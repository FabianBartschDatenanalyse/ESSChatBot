'use server';

import * as dfd from 'danfojs-node';
import * as tf from '@tensorflow/tfjs-node';
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
  console.log(`[stats-service] Starting linear regression with TensorFlow.js for target '${target}' with features '${features.join(', ')}'.`);

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

  // Add WHERE clauses to filter out common missing value codes
  for (const col of allColumns) {
    whereClauses.push(`"${col}" NOT IN ('7','8','9','77','88','99','66','55', '777', '888', '999')`);
  }
  
  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  let df: dfd.DataFrame;
  let dfClean: dfd.DataFrame;
  let X: tf.Tensor;
  let y: tf.Tensor;
  let weights: tf.Tensor[];

  try {
    // ------------------- 1. Execute Query -------------------
    console.log('[stats-service] Executing SQL query:', query);
    const { data: queryData, error: queryError } = await executeQuery(query);

    if (queryError) {
      throw new Error(`SQL query failed: ${queryError}`);
    }

    if (!queryData || queryData.length === 0) {
      return { error: 'No data available for regression after querying', sqlQuery: query };
    }

    // ------------------- 2. Load and Prepare Data -------------------
    df = new dfd.DataFrame(queryData);
    console.log('[stats-service] Loaded data into DataFrame. Initial shape:', df.shape);

    for (const col of allColumns) {
        df[col] = df[col].apply((val: any) => parseFloat(val), { axis: 0 });
    }
    
    dfClean = df.dropNa({ axis: 0 });
    console.log('[stats-service] DataFrame shape after dropping NaNs:', dfClean.shape);

    if (dfClean.shape[0] < features.length + 2) {
      return { error: `Not enough valid rows after cleaning (rows=${dfClean.shape[0]}) to perform regression.`, sqlQuery: query };
    }

    // ------------------- 3. Create Tensors -------------------
    const X_df = dfClean.loc({ columns: features });
    const y_sr = dfClean[target] as dfd.Series;

    X = tf.tensor2d(X_df.values as number[][]);
    y = tf.tensor2d(y_sr.values as number[], [y_sr.size, 1]);

    console.log('[stats-service] Prepared Tensors for TensorFlow.js:');
    console.log('X shape:', X.shape);
    console.log('y shape:', y.shape);
    
    // ------------------- 4. Build and Train Model -------------------
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [features.length] }));
    model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' });

    console.log('[stats-service] Training TensorFlow.js model...');
    await model.fit(X, y, { epochs: 100 });
    console.log('[stats-service] Model training complete.');

    // ------------------- 5. Extract Results -------------------
    weights = model.getWeights();
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
      n_observations: dfClean.shape[0],
      note: 'Linear regression performed using TensorFlow.js. R-squared is an estimate.',
    };
    
    console.log('[stats-service] Regression calculation successful.');
    return { data: result, sqlQuery: query };

  } catch (e: any) {
    const errorDetails = {
      message: e?.message,
      stack: e?.stack,
    };
    console.error('[stats-service] An exception occurred during regression:', errorDetails);
    return { error: `Regression failed: ${e?.message || 'Unknown error'}. Please check the console for details.`, sqlQuery: query };
  } finally {
      // Clean up tensors
      X?.dispose();
      y?.dispose();
      if(weights) {
        weights.forEach(w => w.dispose());
      }
  }
}
