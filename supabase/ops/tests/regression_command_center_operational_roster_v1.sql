\set ON_ERROR_STOP on
-- Synthetic disposable test only; does not access the live Supabase project.
\ir regression_command_center_roster_sort_v2.sql
RESET ROLE;
CREATE TABLE public.candidaturas (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
  matricula_id uuid, ano_letivo integer NOT NULL
);
CREATE TABLE public.candidaturas_status_log (
  id uuid PRIMARY KEY, candidatura_id uuid NOT NULL, escola_id uuid NOT NULL,
  created_at timestamptz NOT NULL, metadata jsonb
);
CREATE TABLE public.mensalidades (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
  matricula_id uuid, ano_letivo text, data_vencimento date,
  status text, valor numeric, valor_previsto numeric, valor_pago_total numeric
);
CREATE TABLE public.public_rate_limits (
  scope text NOT NULL, key text NOT NULL, count integer NOT NULL DEFAULT 0,
  PRIMARY KEY(scope,key)
);
CREATE FUNCTION public.check_public_rate_limit(
  p_scope text,p_key text,p_limit integer,p_window_seconds integer,p_block_seconds integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog, public
AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.public_rate_limits(scope,key,count) VALUES(p_scope,p_key,1)
  ON CONFLICT(scope,key) DO UPDATE SET count=public.public_rate_limits.count+1
  RETURNING count INTO v_count;
  RETURN jsonb_build_object('allowed',v_count <= p_limit);
END; $$;
GRANT SELECT ON public.candidaturas,public.candidaturas_status_log,public.mensalidades TO authenticated;
ALTER TABLE public.candidaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidaturas_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_scope ON public.candidaturas TO authenticated
  USING (public.has_access_to_escola_fast(escola_id));
CREATE POLICY candidate_event_scope ON public.candidaturas_status_log TO authenticated
  USING (public.has_access_to_escola_fast(escola_id));
CREATE POLICY tuition_scope ON public.mensalidades TO authenticated
  USING (public.has_access_to_escola_fast(escola_id));

-- Document pending for student 1 and student 4. Student 3 has a later
-- resolved event, so it cannot be included as pending.
INSERT INTO public.candidaturas VALUES
('00000000-0000-4000-8300-000000000001','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8100-000000000001','00000000-0000-4000-8200-000000000001',2026),
('00000000-0000-4000-8300-000000000003','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8100-000000000003','00000000-0000-4000-8200-000000000003',2026),
('00000000-0000-4000-8300-000000000004','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8100-000000000004','00000000-0000-4000-8200-000000000004',2026),
('00000000-0000-4000-8300-000000000999','00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8100-000000000999','00000000-0000-4000-8200-000000000999',2026);
INSERT INTO public.candidaturas_status_log VALUES
('00000000-0000-4000-8400-000000000001','00000000-0000-4000-8300-000000000001','00000000-0000-4000-8000-0000000000a1','2026-01-01','{"tipo":"DOCUMENTOS_PENDENTES"}'),
('00000000-0000-4000-8400-000000000003','00000000-0000-4000-8300-000000000003','00000000-0000-4000-8000-0000000000a1','2026-01-01','{"tipo":"DOCUMENTOS_PENDENTES"}'),
('00000000-0000-4000-8400-000000000013','00000000-0000-4000-8300-000000000003','00000000-0000-4000-8000-0000000000a1','2026-01-02','{"tipo":"DOCUMENTOS_REENVIADOS_ACEITES"}'),
('00000000-0000-4000-8400-000000000004','00000000-0000-4000-8300-000000000004','00000000-0000-4000-8000-0000000000a1','2026-01-01','{"tipo":"DOCUMENTOS_PENDENTES"}'),
('00000000-0000-4000-8400-000000000999','00000000-0000-4000-8300-000000000999','00000000-0000-4000-8000-0000000000b2','2026-01-01','{"tipo":"DOCUMENTOS_PENDENTES"}');

-- Student 2 has a confirmed overdue balance, student 4 both signals.
-- Student 5 has pending proof with zero balance: not overdue.
-- Student 6 has a canceled tuition: must never count.
INSERT INTO public.mensalidades VALUES
('00000000-0000-4000-8500-000000000002','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8100-000000000002','00000000-0000-4000-8200-000000000002','2026','2026-01-10','pendente',100,100,20),
('00000000-0000-4000-8500-000000000004','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8100-000000000004','00000000-0000-4000-8200-000000000004','2026','2026-01-10','parcial',100,100,50),
('00000000-0000-4000-8500-000000000005','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8100-000000000005','00000000-0000-4000-8200-000000000005','2026','2026-01-10','pending',100,100,100),
('00000000-0000-4000-8500-000000000006','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8100-000000000006','00000000-0000-4000-8200-000000000006','2026','2026-01-10','cancelado',100,100,0),
('00000000-0000-4000-8500-000000000999','00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8100-000000000999','00000000-0000-4000-8200-000000000999','2026','2026-01-10','pendente',100,100,0);
\ir ../../migrations/20271022133000_command_center_operational_roster_v1.sql

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';

DO $$
DECLARE
  item record;
  v_doc integer;
  v_fin integer;
  v_all integer;
  v_priority integer;
  v_name text;
  v_id uuid;
  v_counter integer;
  v_page integer;
  v_rows integer;
  seen uuid[];
  got_rate_limit boolean := false;
  forbidden boolean := false;
BEGIN
  SELECT count(*) INTO v_doc FROM public.command_center_roster_operational_v1(
    p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
    p_ano_letivo=>2026,p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
    p_filter=>'documentos_sinalizados'
  );
  SELECT count(*) INTO v_fin FROM public.command_center_roster_operational_v1(
    p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
    p_ano_letivo=>2026,p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
    p_filter=>'propinas_vencidas'
  );
  IF v_doc <> 2 OR v_fin <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 current documentary signals and 2 overdue balances: %/%',v_doc,v_fin;
  END IF;

  seen:=ARRAY[]::uuid[];
  v_name:=NULL; v_id:=NULL;v_priority:=NULL;
  FOR v_page IN 1..3 LOOP
    v_rows:=0;
    FOR item IN SELECT * FROM public.command_center_roster_operational_v1(
      p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
      p_ano_letivo=>2026,p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
      p_cursor_name=>v_name,p_cursor_id=>v_id,p_cursor_priority=>v_priority,
      p_limit=>20,p_sort=>'pendencias_primeiro'
    ) LOOP
      v_rows:=v_rows+1;
      seen:=array_append(seen,item.aluno_id);
      v_name:=item.cursor_name;v_id:=item.aluno_id;v_priority:=item.pendencias_count;
      IF v_page=1 AND v_rows=1 AND item.aluno_id <> '00000000-0000-4000-8100-000000000004' THEN
        RAISE EXCEPTION 'Both-signals student must sort first';
      END IF;
      IF item.total_filtrado <> 55 THEN RAISE EXCEPTION 'Wrong total'; END IF;
    END LOOP;
    IF v_rows <> CASE WHEN v_page=3 THEN 15 ELSE 20 END THEN
      RAISE EXCEPTION 'Unstable priority page length';
    END IF;
  END LOOP;
  IF array_length(seen,1)<>55 OR
     (SELECT count(DISTINCT student_id) FROM unnest(seen) AS student_id)<>55 THEN
    RAISE EXCEPTION 'Priority cursor duplicate or omission';
  END IF;

  BEGIN
    PERFORM * FROM public.command_center_roster_operational_v1(
      p_escola_id=>'00000000-0000-4000-8000-0000000000b2',
      p_ano_letivo=>2026,p_turma_id=>'00000000-0000-4000-8000-0000000000f2');
  EXCEPTION WHEN insufficient_privilege THEN forbidden:=true;
  END;
  IF NOT forbidden THEN RAISE EXCEPTION 'Cross-school access permitted'; END IF;
END; $$;

-- Exercise shared 30/minute counter, and verify the 31st query returns a
-- COMMIT-safe sentinel instead of raising and rolling back the counter.
DO $$
DECLARE i integer; rec record; blocked integer := 0;
BEGIN
  FOR i IN 1..34 LOOP
    SELECT * INTO rec FROM public.command_center_roster_operational_v1(
      p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
      p_ano_letivo=>2026,p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
      p_limit=>2);
    IF rec.rate_limited THEN blocked:=blocked+1; END IF;
  END LOOP;
  IF blocked<1 THEN RAISE EXCEPTION 'Distributed throttle did not deny any request'; END IF;
END; $$;

RESET ROLE;
SELECT count AS fixture_shared_requests FROM public.public_rate_limits
WHERE scope='command_center_roster';

-- Ensure fixture query plans are gathered from an unthrottled scope.
TRUNCATE public.public_rate_limits;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.command_center_roster_operational_v1(
  p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
  p_ano_letivo=>2026,p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
  p_sort=>'pendencias_primeiro',p_limit=>20);
