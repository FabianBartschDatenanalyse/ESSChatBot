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
): Promise<{ data?: any; error?: string }> {
  console.log(`[stats-service] Starting linear regression for target '${target}' with features '${features.join(', ')}'.`);

  // 1. Construct the SQL query to fetch the necessary data
  const allColumns = [target, ...features];
  let query = `SELECT ${allColumns.map(c => `"${c}"`).join(', ')} FROM "ESS1"`;
  
  const whereClauses: string[] = [];

  // Add filters from the request
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      // Ensure values are properly quoted if they are strings
      const filterValue = typeof value === 'string' ? `'${value}'` : value;
      whereClauses.push(`"${key}" = ${filterValue}`);
    }
  }

  // Add filters to exclude missing values for all involved columns
  // Assuming 77, 88, 99 are common missing value codes and stored as numbers/text
  for (const col of allColumns) {
    whereClauses.push(`"${col}" NOT IN ('77', '88', '99', '777', '888', '999', '66', '55')`);
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
    return { error: errorMsg };
  }

  // 3. Prepare data using Danfo.js
  try {
    // Convert the array of objects into a Danfo DataFrame
    let df = new dfd.DataFrame(queryResult.data);

    // Ensure all columns are numeric
    for (const col of allColumns) {
        df = df.astype(col, 'float32');
    }
    
    // Drop rows with NaN values that might have resulted from casting
    df.dropna({ inplace: true });

    if (df.shape[0] < features.length + 1) {
        return { error: 'Not enough valid data points to run a regression after cleaning.' };
    }

    const X = df.loc({ columns: features });
    const y = df.loc({ columns: [target] });

    // 4. Run the regression
    const model = new dfd.LinearRegression();
    await model.fit(X, y);
    
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
      n: df.shape[0],
      note: "p-values are not provided by the danfo.js library."
    };
    
    console.log('[stats-service] Regression successful:', result);
    return { data: result };

  } catch (e: any) {
    console.error(`[stats-service] An error occurred during regression calculation: ${e.message}`);
    return { error: `Calculation failed: ${e.message}` };
  }
}
