'use server';

import { initDb, type Database } from './data-loader';

let db: Database | null = null;
let dbInitializationPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
    if (db) {
        return db;
    }
    if (!dbInitializationPromise) {
        dbInitializationPromise = initDb().then(initializedDb => {
            db = initializedDb;
            return db;
        });
    }
    return dbInitializationPromise;
}

export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    try {
        const currentDb = await getDb();
        const results = currentDb.exec(query);

        if (results.length === 0) {
            return { results: [{ columns: [], rows: [] }] };
        }
        
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
        return { error: `Query execution failed: ${e.message}` };
    }
}
