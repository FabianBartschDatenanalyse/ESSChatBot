'use server';

import { linearRegression, linearRegressionLine } from 'simple-statistics';
import { executeQuery } from './data-service';

/**
 * Prepares the data and runs a linear regression.
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
  let query = `SELECT ${allColumns.join(', ')} FROM "ESS1"`;
  
  const whereClauses: string[] = [];

  // Add filters from the request
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      whereClauses.push(`${key} = '${value}'`);
    }
  }

  // Add filters to exclude missing values for all involved columns
  for (const col of allColumns) {
    // Assuming 77, 88, 99 are common missing value codes
    whereClauses.push(`${col} NOT IN ('77', '88', '99')`);
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

  // 3. Prepare data for simple-statistics (it expects arrays of numbers)
  // And it only supports simple linear regression (one feature) for now.
  if (features.length !== 1) {
      return { error: "Simple-statistics in this example only supports single linear regression (one feature)." };
  }

  const featureName = features[0];
  const dataForRegression: [number, number][] = queryResult.data
    .map(row => {
      const x = parseFloat(row[featureName]);
      const y = parseFloat(row[target]);
      return !isNaN(x) && !isNaN(y) ? [x, y] : null;
    })
    .filter((v): v is [number, number] => v !== null);

  if (dataForRegression.length < 2) {
    return { error: 'Not enough valid data points to run a regression.' };
  }

  // 4. Run the regression
  try {
    const model = linearRegression(dataForRegression); // returns { m: slope, b: intercept }
    const regressionLine = linearRegressionLine(model);
    
    // We don't get p-values or R-squared easily from simple-statistics,
    // so we'll return the basic model for now.
    const result = {
      coefficients: {
        intercept: model.b,
        [featureName]: model.m,
      },
      n: dataForRegression.length,
      note: "p-values and R-squared are not provided by this basic statistical tool."
    };
    
    console.log('[stats-service] Regression successful:', result);
    return { data: result };

  } catch (e: any) {
    console.error(`[stats-service] An error occurred during regression calculation: ${e.message}`);
    return { error: `Calculation failed: ${e.message}` };
  }
}
