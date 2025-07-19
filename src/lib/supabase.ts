import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is not set. Supabase client not initialized.');
}

// Initialize client only if URL and Key are provided and not empty
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== "" && supabaseAnonKey !== "") 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Overwrite the executeQuery function to handle the case where Supabase is not configured
export async function executeQuery(query: string): Promise<{ results?: any[], error?: string }> {
    if (!supabase) {
        const errorMessage = "Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file.";
        console.error(errorMessage);
        return { error: errorMessage };
    }
    
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
            console.error("Supabase query error:", error);
            return { error: errorMessage };
        }
        
        // The RPC function returns a JSON array of objects.
        // We can directly use this data if we adjust the DataTable component slightly.
        const formattedResults = {
            columns: data && data.length > 0 ? Object.keys(data[0]) : [],
            rows: data || [],
        };
        
        // The Data Table and SQL tool expect the results in a specific nested format.
        return { results: [formattedResults] };

    } catch (e: any) {
        console.error("Unexpected error executing query:", e);
        return { error: e.message || 'An unexpected error occurred while communicating with the database.' };
    }
}
