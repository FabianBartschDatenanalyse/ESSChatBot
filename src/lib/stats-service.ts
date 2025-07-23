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
  let query = `SELECT ${allColumns.map(c => `"${c}"`).join(', ')} FROM "ESS1"`;
  
  const whereClauses: string[] = [];

  // Add filters from the request
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      const filterValue = typeof value === 'string' ? `'${value}'` : value;
      whereClauses.push(`"${key}" = ${filterValue}`);
    }
  }

  // Add filters to exclude common missing value codes
  for (const col of allColumns) {
    whereClauses.push(`"${col}" NOT IN ('7', '8', '9', '77', '88', '99', '777', '888', '999', '66', '55')`);
  }
  
  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }
  
  console.log('[stats-service] Executing data retrieval query:', query);

  // 2. Fetch the data using the existing data service
  const queryResult = await executeQuery(query);

  if (queryResult.error || !queryResult.data || queryResult.data.length === 0) {
    const errorMsg = `Failed to fetch data for regression: ${queryResult.error || 'No data returned'}`;
    console.error(`[stats-service] ${errorMsg}`);
    return { error: errorMsg, sqlQuery: query };
  }

  console.log(`[stats-service] Successfully fetched ${queryResult.data.length} rows.`);

  // 3. Prepare data using Danfo.js
  try {
    let df = new dfd.DataFrame(queryResult.data);
    console.log('[stats-service] DataFrame created. Shape before cleaning:', df.shape);
    
    // Ensure all columns are numeric. This is the corrected implementation.
    for (const col of allColumns) {
        // astype is called on a Series (column), not the DataFrame
        const a_col = df[col].astype('float32');
        df.addColumn(col, a_col, { inplace: true });
    }
    
    // Drop rows with NaN, null, or undefined values that might have resulted from casting or were present in the data
    df.dropna({ inplace: true });
    console.log('[stats-service] DataFrame shape after cleaning (dropping nulls):', df.shape);


    if (df.shape[0] < features.length + 2) {
        const errorMsg = `Not enough valid data points to run a regression after cleaning. (Rows: ${df.shape[0]}, Features: ${features.length + 1})`;
        console.error(`[stats-service] ${errorMsg}`);
        return { error: errorMsg, sqlQuery: query };
    }

    const X = df.loc({ columns: features });
    const y = df.loc({ columns: [target] });

    console.log('[stats-service] Starting model fitting...');
    // 4. Run the regression
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
    const errorMessage = `An error occurred during regression calculation: ${e.message}`;
    console.error(`[stats-service] ${errorMessage}`, e);
    return { error: errorMessage, sqlQuery: query };
  }
}
