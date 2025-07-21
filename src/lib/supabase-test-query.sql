-- In Supabase SQL Editor ausführen, um die Funktion zu testen
-- This command calls your `execute_safe_query` function and passes the problematic SQL query as a string argument.
-- The output will be the exact JSON that your function returns to the application.

SELECT execute_safe_query('SELECT cntry, AVG(CAST(trstprl AS NUMERIC)) AS average_trust_in_parliament FROM "ESS1" GROUP BY cntry');
