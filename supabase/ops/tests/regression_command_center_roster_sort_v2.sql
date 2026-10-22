\set ON_ERROR_STOP on
-- Reuse the disposable 55-student, two-school, authenticated RLS fixture.
\ir regression_command_center_class_roster_summary.sql
RESET ROLE;

ALTER TABLE public.alunos ADD COLUMN numero_processo text;
UPDATE public.alunos SET numero_processo = 'SYN-' || right(id::text, 4);
ALTER TABLE public.escola_users ADD COLUMN papel text DEFAULT 'secretaria';
ALTER TABLE public.escola_users ADD COLUMN role text DEFAULT 'secretaria';

CREATE FUNCTION public.check_super_admin_role() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.normalize_search_text(VARIADIC pieces text[])
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT lower(trim(array_to_string(pieces, ' ')));
$$;
GRANT EXECUTE ON FUNCTION public.check_super_admin_role(),
  public.normalize_search_text(VARIADIC text[]) TO authenticated;

\ir ../../migrations/20271022130500_command_center_roster_keyset.sql
\ir ../../migrations/20271022132500_command_center_roster_sort_v2.sql

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';

DO $$
DECLARE
  first_id uuid;
  last_id uuid;
  v_name text;
  v_id uuid;
  collected uuid[];
  direction text;
  page_no integer;
  page_items integer;
  item record;
  forbidden boolean := false;
BEGIN
  FOR direction IN SELECT unnest(ARRAY['nome_asc', 'nome_desc']) LOOP
    collected := ARRAY[]::uuid[];
    v_name := NULL;
    v_id := NULL;
    FOR page_no IN 1..3 LOOP
      page_items := 0;
      FOR item IN SELECT * FROM public.command_center_roster_keyset_v2(
        p_escola_id => '00000000-0000-4000-8000-0000000000a1',
        p_ano_letivo => 2026,
        p_turma_id => '00000000-0000-4000-8000-0000000000f1',
        p_query => NULL, p_cursor_name => v_name, p_cursor_id => v_id,
        p_limit => 20, p_sort => direction
      ) LOOP
        page_items := page_items + 1;
        collected := array_append(collected, item.aluno_id);
        v_name := item.cursor_name;
        v_id := item.aluno_id;
        IF page_no = 1 AND page_items = 1 THEN first_id := item.aluno_id; END IF;
        last_id := item.aluno_id;
        IF item.total_filtrado <> 55 THEN RAISE EXCEPTION 'Incorrect total'; END IF;
      END LOOP;
      IF page_items <> (CASE WHEN page_no=3 THEN 15 ELSE 20 END) THEN
        RAISE EXCEPTION 'Unexpected page length % (page %, %)', page_items, page_no, direction;
      END IF;
    END LOOP;
    IF array_length(collected,1) <> 55 OR
      (SELECT count(DISTINCT s) FROM unnest(collected) AS s) <> 55 THEN
      RAISE EXCEPTION 'Duplicate or omitted student: %', direction;
    END IF;
    IF direction = 'nome_asc' AND first_id <> '00000000-0000-4000-8100-000000000001' THEN
      RAISE EXCEPTION 'A-Z first ID wrong';
    END IF;
    IF direction = 'nome_desc' AND first_id <> '00000000-0000-4000-8100-000000000055' THEN
      RAISE EXCEPTION 'Z-A first ID wrong';
    END IF;
  END LOOP;

  BEGIN
    PERFORM * FROM public.command_center_roster_keyset_v2(
      p_escola_id => '00000000-0000-4000-8000-0000000000b2',
      p_ano_letivo => 2026,
      p_turma_id => '00000000-0000-4000-8000-0000000000f2',
      p_sort => 'nome_asc');
  EXCEPTION WHEN insufficient_privilege THEN forbidden := true;
  END;
  IF NOT forbidden THEN RAISE EXCEPTION 'Cross-school query allowed'; END IF;

  BEGIN
    PERFORM * FROM public.command_center_roster_keyset_v2(
      p_escola_id => '00000000-0000-4000-8000-0000000000a1',
      p_ano_letivo => 2026, p_turma_id => '00000000-0000-4000-8000-0000000000f1',
      p_sort => 'operational_guess');
    RAISE EXCEPTION 'Unsupported status ordering was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END; $$;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.command_center_roster_keyset_v2(
  p_escola_id => '00000000-0000-4000-8000-0000000000a1', p_ano_letivo => 2026,
  p_turma_id => '00000000-0000-4000-8000-0000000000f1', p_sort => 'nome_desc'
);
