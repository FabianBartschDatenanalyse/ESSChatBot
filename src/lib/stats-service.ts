'use server';

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu'; // Explicitly import the backend to ensure it's bundled.
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
 * This implementation uses an iterative gradient descent approach which is
 * guaranteed to work with the core TF.js library.
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
        whereClauses.push(`"${col}" NOT IN ('7','8','9','66','77','88','99','55', '555', '777', '888', '999', '9999')`);
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
    
    // Convert all relevant columns to numbers and filter out rows with non-finite values.
    const cleanData = queryData
        .map(row => {
            const newRow: { [key: string]: number } = {};
            let hasInvalidData = false;
            for (const col of allColumns) {
                const val = parseFloat(row[col]);
                if (!Number.isFinite(val)) {
                    hasInvalidData = true;
                    break;
                }
                newRow[col] = val;
            }
            return hasInvalidData ? null : newRow;
        })
        .filter((row): row is { [key: string]: number } => row !== null);
    
    if (cleanData.length < features.length + 2) {
      return jsonSafe({ 
          error: `Not enough valid rows after cleaning (rows=${cleanData.length}). Original rows from query: ${queryData.length}. This often happens if filters are too restrictive or data contains unexpected non-numeric values.`, 
          sqlQuery: query 
      });
    }

    const targetTensor = tf.tensor2d(cleanData.map(r => [r[target]]));
    const featureTensor = tf.tensor2d(cleanData.map(r => features.map(f => r[f])));

    // Define the model
    const model = tf.sequential();
    model.add(tf.layers.dense({
        inputShape: [features.length],
        units: 1,
    }));

    model.compile({
        optimizer: tf.train.adam(0.1),
        loss: 'meanSquaredError',
    });

    // Train the model
    await model.fit(featureTensor, targetTensor, {
        epochs: 100,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if (epoch % 20 === 0) {
                    console.log(`[stats-service] Epoch ${epoch}: loss = ${logs?.loss}`);
                }
            }
        }
    });

    // Extract results
    const weights = model.getWeights();
    const kernel = await weights[0].array() as number[][];
    const bias = await weights[1].array() as number;

    const coefficients: Record<string, number> & { intercept: number } = { intercept: bias };
    features.forEach((feature, i) => {
        coefficients[feature] = kernel[i][0];
    });

    // Calculate R-squared
    const predictions = model.predict(featureTensor) as tf.Tensor;
    const y_true = targetTensor;
    const y_mean = y_true.mean();
    const ss_total = y_true.sub(y_mean).square().sum();
    const ss_res = y_true.sub(predictions).square().sum();
    const r2_tensor = tf.scalar(1).sub(ss_res.div(ss_total));
    const r_squared = await r2_tensor.array() as number;
    
    tf.dispose([targetTensor, featureTensor, ...weights, predictions, y_mean, ss_total, ss_res, r2_tensor]);
    
    return jsonSafe({
      data: {
        coefficients,
        r_squared: Number.isFinite(r_squared) ? r_squared : null,
        n_observations: cleanData.length,
        note: 'OLS coefficients estimated via iterative gradient descent.',
      },
      sqlQuery: query,
    });

  } catch (e: any) {
    console.error("[stats-service] CATCH BLOCK ERROR:", e);
    const err = e as Error;
    return jsonSafe({
      error: `Regression analysis failed: ${err?.message ?? 'Unknown error'}.`,
      sqlQuery: typeof query !== 'undefined' ? query : undefined,
    });
  }
}