
'use server';

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu'; // Explicitly import the backend
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
      // Different missing codes for different vars - add specific filters
      if (col === 'gndr') {
          whereClauses.push(`"gndr" IN ('1', '2')`);
      } else {
          // General missing value codes
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

    // Convert all relevant columns to numbers and filter out rows with non-finite values.
    const filteredData = queryData
      .map(row => {
          const newRow: { [key: string]: any } = {};
          for (const col of allColumns) {
              newRow[col] = parseFloat(row[col]); // Ensure data is numeric
          }
          return newRow;
      })
      .filter(row => {
        for (const col of allColumns) {
            if (!Number.isFinite(row[col])) {
                return false; // Remove rows with NaN/Infinity after parsing
            }
        }
        return true;
    });
    
    if (filteredData.length < features.length + 2) {
      return jsonSafe({ 
          error: `Not enough valid rows after cleaning (rows=${filteredData.length}). Original rows from query: ${queryData.length}. This often happens if filters are too restrictive or data contains unexpected non-numeric values.`, 
          sqlQuery: query 
      });
    }

    // --- build features ---
    // Recode gndr to binary and center age (optional but recommended)
    const rows = filteredData
      .map(r => {
        const g = Number(r['gndr']);               // values '1' or '2' -> 1/2
        const female = g === 2 ? 1 : 0;            // 1=female, 0=male
        return { trstprl: Number(r['trstprl']), female, agea: Number(r['agea']) };
      });

    // Center age for a nicer intercept (predicted trust for males at mean age)
    const meanAge = rows.reduce((s, r) => s + r.agea, 0) / rows.length;
    rows.forEach(r => { (r as any)['agec'] = r.agea - meanAge });

    // Assemble matrices: X = [1, female, agec], y = trstprl
    const n = rows.length;
    const X_vals = rows.map(r => [1, r.female, (r as any).agec]);     // intercept in col 0
    const y_vals = rows.map(r => [r.trstprl]);

    const X = tf.tensor2d(X_vals, [n, 3], 'float32');
    const y = tf.tensor2d(y_vals, [n, 1], 'float32');

    // beta = (X'X)^+ X'y
    const Xt = X.transpose();
    const XtX = Xt.matMul(X);
    const XtX_inv = tf.linalg.pinv(XtX);
    const XtY = Xt.matMul(y);
    const beta = XtX_inv.matMul(XtY); // shape (3 x 1)

    // Predictions and R^2
    const yhat = X.matMul(beta);
    const ybar = y.mean();
    const ss_tot = y.sub(ybar).square().sum();
    const ss_res = y.sub(yhat).square().sum();
    const r2_tensor = tf.scalar(1).sub(ss_res.div(ss_tot));
    const r2 = await r2_tensor.array() as number;

    // Pull coefficients
    const b = (await beta.array()) as number[][];
    const intercept = b[0][0];
    const b_female = b[1][0];   // mean difference (female − male) at same age
    const b_agec   = b[2][0];   // change per +1 year, holding gender fixed

    // Package results
    const coefficients = {
      intercept,
      female: b_female,
      agec: b_agec,       // note: coefficient is for centered age
      mean_age: meanAge,  // include so caller can reconstruct with uncentered age
    };
    
    tf.dispose([X, y, Xt, XtX, XtX_inv, XtY, beta, yhat, ybar, ss_tot, ss_res, r2_tensor]);
    
    return jsonSafe({
      data: {
        coefficients,
        r_squared: Number.isFinite(r2) ? r2 : null,
        n_observations: n,
        note: 'OLS via closed-form (pinv). Standard errors available if needed.',
      },
      sqlQuery: query,
    });

  } catch (e: any) {
    // Keep it tiny & serializable
    console.error("[stats-service] CATCH BLOCK ERROR:", e);
    const err = e as Error;
    return jsonSafe({
      error: `Regression analysis failed: ${err?.message ?? 'Unknown error'}.`,
      sqlQuery: typeof query !== 'undefined' ? query : undefined,
    });
  }
}
