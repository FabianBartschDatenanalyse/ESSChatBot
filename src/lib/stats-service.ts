'use server';

import * as dfd from 'danfojs';
import { executeQuery } from './data-service';

/**
 * Prepares the data and runs a linear regression using Danfo.js.
 * @param target The dependent variable.
 * @param features An array of independent variables.
 * @param filters Optional key-value pairs to filter the data.
 * @returns An object with the regression result or an error.
 */
export async function runLinearRegression(
  target: string,
  features: string[],
  filters?: Record<string, any>
): Promise<{ data?: any; error?: string; sqlQuery?: string }> {
  console.log(`[stats-service] Starting linear regression for target '${target}' with features '${features.join(', ')}'.`);

  // 1. Construct the SQL query to fetch the necessary data
  const allColumns = [target, ...features];
  let query = `SELECT ${allColumns.join(', ')} FROM "ESS1"`;
  
  const whereClauses: string[] = [];

  // Add filters from the request
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

  // Add filters to exclude common missing value codes for all columns involved.
   for (const col of allColumns) {
    whereClauses.push(`"${col}" NOT IN ('7', '8', '9', '77', '88', '99', '777', '888', '999', '66', '55')`);
  }
  
  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }
  
  console.log('[stats-service] Executing data retrieval query:', query);

  // 2. Fetch the data
  const queryResult = await executeQuery(query);

  if (queryResult.error || !queryResult.data || queryResult.data.length === 0) {
    const errorMsg = `Failed to fetch data for regression: ${queryResult.error || 'No data returned'}`;
    console.error(`[stats-service] ${errorMsg}`);
    return { error: errorMsg, sqlQuery: query };
  }

  console.log(`[stats-service] Successfully fetched ${queryResult.data.length} rows.`);

  // Hoist variables for debugging in catch block
  let df: dfd.DataFrame | undefined;
  let X: number[][] | undefined;
  let y: number[] | undefined;

  try {
    df = new dfd.DataFrame(queryResult.data);
    console.log('[stats-service] DataFrame created. Shape before cleaning:', df.shape);
    
    // Convert all relevant columns to a numeric type.
    for (const col of allColumns) {
        const numericSeries = df[col].apply((val: any) => parseFloat(val), { axis: 0 });
        df.addColumn(col, numericSeries, { inplace: true });
    }
    
    // Drop rows with NaN, null, or undefined values
    df = df.dropNa({ axis: 0 });
    console.log('[stats-service] DataFrame shape after cleaning (dropping nulls):', df.shape);

    if (df.shape[0] < features.length + 2) {
        const errorMsg = `Not enough valid data points to run a regression after cleaning. (Rows: ${df.shape[0]}, Features: ${features.length + 1})`;
        console.error(`[stats-service] ${errorMsg}`);
        return { error: errorMsg, sqlQuery: query };
    }

    const X_df = df.loc({ columns: features });
    const y_sr = df[target] as dfd.Series;
    
    // Force conversion to native JS arrays to avoid internal errors
    X = X_df.tensor.arraySync() as number[][];
    y = y_sr.tensor.arraySync() as number[];

    // DEBUGGING LOGS
    console.log('[stats-service] X type:', typeof X, 'isArray:', Array.isArray(X), 'constructor:', X?.constructor?.name);
    console.log('[stats-service] y type:', typeof y, 'isArray:', Array.isArray(y), 'constructor:', y?.constructor?.name);
    console.log('[stats-service] Sample X[0]:', X?.[0]);
    console.log('[stats-service] Sample y[0]:', y?.[0]);

    // 4. Run the regression
    console.log('[stats-service] Starting model fitting...');
    const model = new dfd.LinearRegression();
    await model.fit(X, y);
    
    console.log('[stats-service] Model fitting successful.');
    // 5. Format and return the results
    const result = {
      coefficients: {
        intercept: model.intercept,
        ...features.reduce((obj, feat, i) => {
          obj[feat] = model.coef[i];
          return obj;
        }, {} as Record<string, number>)
      },
      r_squared: await model.score(X, y),
      n_observations: df.shape[0],
      note: "p-values are not provided by the underlying `danfo.js` library."
    };
    
    console.log('[stats-service] Regression calculation successful:', result);
    return { data: result, sqlQuery: query };

  } catch (e: any) {
    const errorDetails = `
      Error Message: ${e.message}
      
      DEBUGGING LOGS:
      - X type: ${typeof X}
      - X isArray: ${Array.isArray(X)}
      - X constructor: ${X?.constructor?.name}
      - X sample: ${JSON.stringify(X?.[0])}
      
      - y type: ${typeof y}
      - y isArray: ${Array.isArray(y)}
      - y constructor: ${y?.constructor?.name}
      - y sample: ${y?.[0]}
    `;
    const errorMessage = `An error occurred during regression calculation. Details: ${errorDetails}`;
    console.error(`[stats-service] ${errorMessage}`, e);
    return { error: errorMessage, sqlQuery: query };
  }
}
