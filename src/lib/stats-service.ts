
'use server';

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
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
  console.log(`[stats-service] Starting regression for target '${target}' with features [${features.join(', ')}]`);
  
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
  
    for (const col of allColumns) {
        whereClauses.push(`"${col}" NOT IN ('7','8','9','66','77','88','99','55', '555', '777', '888', '999', '9999')`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    console.log('[stats-service] Executing SQL Query:', query);

    const { data: queryData, error: queryError } = await executeQuery(query);

    if (queryError) {
      return jsonSafe({ error: `SQL query failed: ${queryError}`, sqlQuery: query });
    }

    if (!queryData || queryData.length === 0) {
      return jsonSafe({ error: 'No data available for regression after querying. This might be due to filters or missing values.', sqlQuery: query });
    }
    console.log(`[stats-service] Received ${queryData.length} rows from database.`);
    
    const cleanData = queryData
      .map(row => {
        const newRow: { [key: string]: number } = {};
        for (const col of allColumns) {
          const val = parseFloat(row[col]);
          if (!Number.isFinite(val)) {
            return null; // Exclude row if any value is not a finite number
          }
          newRow[col] = val;
        }
        return newRow;
      })
      .filter((row): row is { [key: string]: number } => row !== null);

    if (cleanData.length < features.length + 2) {
      return jsonSafe({ 
          error: `Not enough valid rows after cleaning (rows=${cleanData.length}). Original rows from query: ${queryData.length}. This often happens if filters are too restrictive or data contains non-numeric values.`, 
          sqlQuery: query 
      });
    }
    console.log(`[stats-service] Have ${cleanData.length} clean data rows for regression.`);

    // Feature Engineering: Recode gender and center age
    const meanAge = cleanData.reduce((sum, row) => sum + row['agea'], 0) / cleanData.length;
    const processedFeatures = cleanData.map(row => {
        const featureValues: number[] = [];
        features.forEach(feature => {
            if (feature === 'gndr') {
                featureValues.push(row[feature] === 2 ? 1 : 0); // 1 for female, 0 for male
            } else if (feature === 'agea') {
                featureValues.push(row[feature] - meanAge); // Centered age
            } else {
                featureValues.push(row[feature]);
            }
        });
        return featureValues;
    });

    const targetTensor = tf.tensor2d(cleanData.map(r => [r[target]]));
    const featureTensor = tf.tensor2d(processedFeatures);
    
    console.log('[stats-service] Tensors created successfully.');

    const model = tf.sequential();
    model.add(tf.layers.dense({
        inputShape: [features.length],
        units: 1,
    }));

    model.compile({
        optimizer: tf.train.adam(0.1),
        loss: 'meanSquaredError',
    });
    console.log('[stats-service] Model compiled. Starting training...');

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
    console.log('[stats-service] Model training complete. Extracting results...');

    const weights = model.getWeights();
    const kernel = await weights[0].array() as number[][];
    const bias = await weights[1].array() as number;

    const coefficients: Record<string, number> & { intercept: number } = { intercept: bias };
    const finalFeatureNames = features.map(f => f === 'gndr' ? 'female' : (f === 'agea' ? 'age_centered' : f));
    finalFeatureNames.forEach((feature, i) => {
        coefficients[feature] = kernel[i][0];
    });

    const predictions = model.predict(featureTensor) as tf.Tensor;
    const y_true = targetTensor;
    const r2_tensor = tf.tidy(() => {
        const y_mean = y_true.mean();
        const ss_total = y_true.sub(y_mean).square().sum();
        const ss_res = y_true.sub(predictions).square().sum();
        return tf.scalar(1).sub(ss_res.div(ss_total));
    });
    
    const r_squared = await r2_tensor.array() as number;
    console.log('[stats-service] Results extracted.');
    
    tf.dispose([targetTensor, featureTensor, ...weights, predictions, r2_tensor]);
    
    const resultData = {
      data: {
        coefficients,
        r_squared: Number.isFinite(r_squared) ? r_squared : null,
        n_observations: cleanData.length,
        note: 'OLS coefficients estimated via iterative gradient descent.',
      },
      sqlQuery: query,
    };
    console.log('[stats-service] Returning successful result:', JSON.stringify(resultData, null, 2));
    return jsonSafe(resultData);

  } catch (e: any) {
    console.error("[stats-service] CATCH BLOCK ERROR:", e);
    const err = e as Error;
    return jsonSafe({
      error: `Regression analysis failed: ${err?.message ?? 'Unknown error'}.`,
      sqlQuery: query,
    });
  }
}
