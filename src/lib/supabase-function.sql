-- This SQL code should be executed in your Supabase SQL Editor.
-- It creates or replaces a secure function for running read-only queries.

-- Drop the existing function if it exists to ensure a clean setup.
DROP FUNCTION IF EXISTS execute_safe_query(text);

-- Create or replace the function to execute safe, read-only SELECT queries.
CREATE OR REPLACE FUNCTION execute_safe_query(query_text TEXT)
RETURNS JSON -- The function will return a single JSON object.
LANGUAGE plpgsql
AS $$
DECLARE
    -- Variable to hold the JSON result of the query.
    query_result JSON;
    -- Variable to hold the final JSON response, including status.
    response JSON;
BEGIN
    -- Check if the query is a read-only SELECT statement.
    -- This is a security measure to prevent modifications to the database.
    IF lower(query_text) LIKE 'select%' THEN
        -- Execute the query and aggregate the results into a single JSON array.
        EXECUTE format('SELECT json_agg(t) FROM (%s) t', query_text)
        INTO query_result;

        -- Construct a success response object.
        -- The coalesce function handles cases where the query returns no rows,
        -- ensuring we return an empty array '[]' instead of NULL.
        response := json_build_object(
            'status', 'success',
            'data', coalesce(query_result, '[]'::json)
        );
    ELSE
        -- If the query is not a SELECT statement, construct an error response.
        response := json_build_object(
            'status', 'error',
            'error', 'Only SELECT queries are allowed.'
        );
    END IF;

    -- Return the final JSON response.
    RETURN response;
EXCEPTION
    -- Catch any SQL errors during execution (e.g., syntax errors, missing tables).
    WHEN others THEN
        -- Construct a detailed error response.
        response := json_build_object(
            'status', 'error',
            'error', SQLERRM -- SQLERRM is a system variable containing the error message.
        );
        -- Return the error response.
        RETURN response;
END;
$$;
