'use server';

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import { executeQuery } from './data-service';

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

export async function runLinearRegression(
  target: string,
  features: string[],
  filters?: Record<string, any>
): Promise<RegressionResponse> {
  let query = '';
  try {
    await tf.setBackend('cpu');
    await tf.ready();

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
    // Generic missing-code filter on all requested columns
    for (const col of allColumns) {
      if (col === 'gndr') {
        whereClauses.push(`"gndr" IN ('1','2')`);
      } else {
        whereClauses.push(`"${col}" NOT IN ('7','8','9','55','66','77','88','99','555','777','888','999','9999')`);
      }
    }
    if (whereClauses.length) query += ` WHERE ${whereClauses.join(' AND ')}`;

    const { data: queryData, error: queryError } = await executeQuery(query);
    if (queryError) return { error: `SQL query failed: ${queryError}`, sqlQuery: query };

    if (!queryData?.length) {
      return { error: 'No data available for regression after querying.', sqlQuery: query };
    }

    // Parse numerics & drop any row with non-finite
    const cleanData = queryData.map(row => {
      const obj: Record<string, number> = {};
      for (const c of allColumns) {
        const v = parseFloat(row[c]);
        if (!Number.isFinite(v)) return null;
        obj[c] = v;
      }
      return obj;
    }).filter((r): r is Record<string, number> => !!r);

    if (cleanData.length < features.length + 2) {
      return {
        error: `Not enough valid rows after cleaning (rows=${cleanData.length}). Original rows=${queryData.length}.`,
        sqlQuery: query
      };
    }

    // Feature engineering: female dummy (0/1) and centered age
    const processedFeatures = features.map(f => {
        if (f === 'gndr') return 'female';
        if (f === 'agea') return 'age_centered';
        return f;
    });

    const processedData = cleanData.map(r => {
        const row: Record<string, number> = {};
        const meanAge = cleanData.reduce((s, r) => s + (r['agea'] || 0), 0) / cleanData.length;
        
        row[target] = r[target];
        if (features.includes('gndr')) {
            row['female'] = r.gndr === 2 ? 1 : 0;
        }
        if (features.includes('agea')) {
            row['age_centered'] = r.agea - meanAge;
        }
        return row;
    });
    
    const featureValues = processedData.map(r => processedFeatures.map(f => r[f]));
    const targetValues = processedData.map(r => [r[target]]);

    const featureTensor = tf.tensor2d(featureValues, [cleanData.length, features.length], 'float32');
    const targetTensor  = tf.tensor2d(targetValues, [cleanData.length, 1], 'float32');

    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [features.length], units: 1 }));
    model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });

    await model.fit(featureTensor, targetTensor, { epochs: 400, batchSize: 512, verbose: 0 });

    // Extract weights safely
    const weights = model.getWeights();
    const kernelT = weights[0];
    const biasT   = weights[1];
    const kernel  = (await kernelT.array()) as number[][];
    const biasVal = (await biasT.data())[0];

    const coefficients: Record<string, number> & { intercept: number } = { intercept: biasVal };
    processedFeatures.forEach((name, i) => { coefficients[name] = kernel[i][0]; });

    // R^2
    const predictions = model.predict(featureTensor) as tf.Tensor;
    const r2_tensor = tf.tidy(() => {
      const y_mean = targetTensor.mean();
      const ss_tot = targetTensor.sub(y_mean).square().sum();
      const ss_res = targetTensor.sub(predictions).square().sum();
      return tf.scalar(1).sub(ss_res.div(ss_tot));
    });
    const r2_value = (await r2_tensor.data())[0];
    const r_squared = Number.isFinite(r2_value) ? r2_value : null;

    tf.dispose([featureTensor, targetTensor, ...weights, predictions, r2_tensor]);

    // Final, JSON-serializable payload
    const payload = {
      data: {
        coefficients,
        r_squared,
        n_observations: cleanData.length,
        note: 'OLS coefficients estimated via gradient descent on a single dense layer.'
      },
      sqlQuery: query,
    };
    
    return JSON.parse(JSON.stringify(payload));
  } catch (e: any) {
    console.error('[stats-service] CATCH BLOCK ERROR:', e);
    return {
      error: `Regression analysis failed: ${e?.message ?? 'Unknown error'}.`,
      sqlQuery: query
    };
  }
}
