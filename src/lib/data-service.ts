'use server';

import { supabase } from './supabase';

// Helper function to convert RPC result to the format DataTable expects
function formatQueryResult(data: any) {
    if (!data || data.length === 0) {
        return { columns: [], rows: [] };
    }
    const columns = Object.keys(data[0]);
    return {
        columns,
        rows: data,
    };
}


export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    try {
        // IMPORTANT: The function 'execute_sql' must be created in your Supabase project.
        // See 'src/lib/supabase-function.sql' for the SQL command to create it.
        const { data, error } = await supabase.rpc('execute_sql', { query });

        if (error) {
            // Provide a more user-friendly error message
            let errorMessage = error.message;
            if (error.code === '42501') {
                 errorMessage = "Permission denied. Please check your table's permissions (RLS) and the grants for the 'execute_sql' function.";
            } else if (error.message.includes("does not exist")) {
                 errorMessage = `Query failed: A table or column in your query does not exist. Details: ${error.message}`;
            }
            return { error: errorMessage };
        }

        // The RPC function returns a JSON array.
        // We need to format it for our data table component.
        const formattedResults = formatQueryResult(data);
        
        // The Data Table and SQL tool expect the results in a specific nested format.
        return { results: [formattedResults] };

    } catch (e: any) {
        console.error("Unexpected error executing query:", e);
        return { error: e.message || 'An unexpected error occurred while communicating with the database.' };
    }
}
