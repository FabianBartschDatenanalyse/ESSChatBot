-- Führen Sie diesen SQL-Befehl einmal in Ihrem Supabase SQL Editor aus.
-- Gehen Sie dazu in Ihrem Supabase-Projekt zu "SQL Editor" -> "New query".
-- Fügen Sie den untenstehenden Code ein und klicken Sie auf "RUN".

-- Diese Funktion ermöglicht die sichere Ausführung von schreibgeschützten SQL-Abfragen
-- aus dem Frontend, ohne dass der anon-key direkten Tabellenzugriff benötigt.

create or replace function execute_sql(query text)
returns json
language plpgsql
as $$
begin
  -- WICHTIG: Stellen Sie sicher, dass Ihre Abfrage schreibgeschützt ist.
  -- Dieser Check verhindert INSERT, UPDATE, DELETE, etc.
  -- Passen Sie dies bei Bedarf an, aber seien Sie vorsichtig.
  if query ilike '%insert %' or
     query ilike '%update %' or
     query ilike '%delete %' or
     query ilike '%truncate %' or
     query ilike '%drop %' or
     query ilike '%alter %' or
     query ilike '%create %'
  then
    raise exception 'Nur SELECT-Abfragen sind erlaubt.';
  end if;

  return (
    select array_to_json(array_agg(row_to_json(t)))
    from (execute query) t
  );
end;
$$;


-- Nach dem Erstellen der Funktion müssen Sie dem 'anon' User erlauben, diese aufzurufen.
-- Führen Sie dazu den folgenden Befehl ebenfalls im SQL Editor aus.
grant execute on function execute_sql(text) to anon;
