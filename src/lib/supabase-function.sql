-- Save this function in your Supabase project's SQL Editor
-- Go to Database -> SQL Editor -> "New query"

create or replace function execute_safe_query(query_text text)
returns json[]
language plpgsql
as $$
begin
  -- IMPORTANT: This function is designed for safe, read-only queries.
  -- It prevents modifications to the database by checking the query text.
  -- Do not remove this check unless you understand the security implications.
  if lower(query_text) similar to '%(insert|update|delete|truncate|drop|alter|create|grant|revoke)%' then
    raise exception 'Modification queries are not allowed.';
  end if;

  return (
    select array_agg(row_to_json(t))
    from (execute query_text) t
  );
end;
$$;
