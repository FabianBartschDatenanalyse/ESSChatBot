'use server';

import { initDb, db } from './data-loader';

let isDbInitialized = false;

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    if (!isDbInitialized) {
        try {
            await initDb();
            isDbInitialized = true;
        } catch (e: any) {
             const error = `Database initialization failed: ${e.message}`;
             console.error(error);
             return { error };
        }
    }

    try {
        const results = db.exec(query);
        if (results.length === 0) {
            return { results: [] };
        }
        
        // sql.js returns an array of result objects. We'll use the first one.
        const queryResult = results[0];
        const formattedResults = {
            columns: queryResult.columns,
            rows: queryResult.values.map(row => {
                const rowObject: Record<string, any> = {};
                queryResult.columns.forEach((col, index) => {
                    rowObject[col] = row[index];
                });
                return rowObject;
            }),
        };
        
        return { results: [formattedResults] };

    } catch (e: any) {
        console.error("SQL.js execution error:", e);
        return { error: e.message };
    }
}
