BEGIN;

-- A matrícula destino existia antes da migration. O backfill deve materializar
-- a dependência automaticamente, usando RAA/snapshot, sem chamada manual.
DO $case1$
DECLARE
  v_status text;
  v_destino uuid;
BEGIN
  SELECT status, matricula_destino_id
    INTO v_status, v_destino
  FROM public.dependencias_academicas_transicao
  WHERE escola_id = '00000000-0000-0000-0000-000000000901'
    AND matricula_origem_id = '00000000-0000-0000-0000-000000000903'
    AND disciplina_id = '00000000-0000-0000-0000-000000000905';

  IF v_status IS DISTINCT FROM 'em_recurso' THEN
    RAISE EXCEPTION 'carryover regression: migration backfill expected em_recurso, got %', v_status;
  END IF;

  IF v_destino IS DISTINCT FROM '00000000-0000-0000-0000-000000000908'::uuid THEN
    RAISE EXCEPTION 'carryover regression: migration backfill destination missing';
  END IF;
END;
$case1$;

DO $case2$
DECLARE
  v_relrowsecurity boolean;
  v_def text;
BEGIN
  SELECT c.relrowsecurity INTO v_relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'dependencias_academicas_transicao';

  IF v_relrowsecurity IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'carryover regression: RLS not enabled';
  END IF;

  IF has_table_privilege('anon', 'public.dependencias_academicas_transicao', 'SELECT') THEN
    RAISE EXCEPTION 'carryover regression: anon can select lifecycle';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.dependencias_academicas_transicao', 'SELECT') THEN
    RAISE EXCEPTION 'carryover regression: authenticated cannot read lifecycle';
  END IF;

  IF has_table_privilege('authenticated', 'public.dependencias_academicas_transicao', 'INSERT')
     OR has_table_privilege('authenticated', 'public.dependencias_academicas_transicao', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.dependencias_academicas_transicao', 'DELETE') THEN
    RAISE EXCEPTION 'carryover regression: authenticated has write grant';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.sync_dependencias_academicas_transicao(uuid,uuid,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.sync_dependencias_academicas_transicao(uuid,uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'carryover regression: sync exposed to human/anon role';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'resolve_estado_resultado_academico_base'
    AND pg_get_function_identity_arguments(p.oid) = 'p_matricula_id uuid, p_disciplina_id uuid';

  IF position('exame_substitutivo_resolvido' in v_def) = 0
     OR position('extraordinario' in v_def) = 0
     OR position('recurso' in v_def) = 0 THEN
    RAISE EXCEPTION 'carryover regression: substitutive exam SSOT missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_dependencias_matricula' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_dependencias_exame_resultado' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_dependencias_exame_sessao' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'carryover regression: lifecycle trigger missing';
  END IF;
END;
$case2$;

INSERT INTO public.escolas(id, nome)
VALUES ('00000000-0000-0000-0000-000000000101', 'Escola Carryover');

INSERT INTO public.alunos(id, escola_id, nome)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'Aluno Carryover'
);

INSERT INTO public.disciplinas_catalogo(id, escola_id, nome, sigla)
VALUES (
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000101',
  'Física',
  'FIS'
);

INSERT INTO public.matriculas(
  id, escola_id, aluno_id, turma_id, ano_letivo, status, ativo
) VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000401',
  2026,
  'concluido',
  false
);

INSERT INTO public.turma_disciplinas(
  id, escola_id, turma_id, avaliacao_disciplina_id
) VALUES (
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000501'
);

INSERT INTO public.matriculas(
  id, escola_id, aluno_id, turma_id, ano_letivo, status, ativo,
  origem_transicao_matricula_id
) VALUES (
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000402',
  2027,
  'ativo',
  true,
  '00000000-0000-0000-0000-000000000301'
);

SELECT public.sync_dependencias_academicas_transicao(
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000302'
);

DO $case3$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.dependencias_academicas_transicao
  WHERE escola_id = '00000000-0000-0000-0000-000000000101'
    AND matricula_origem_id = '00000000-0000-0000-0000-000000000301'
    AND disciplina_id = '00000000-0000-0000-0000-000000000501';

  IF v_status IS DISTINCT FROM 'em_recurso' THEN
    RAISE EXCEPTION 'carryover regression: expected em_recurso, got %', v_status;
  END IF;
END;
$case3$;

INSERT INTO public.exame_sessoes(id, escola_id, tipo, estado)
VALUES (
  '00000000-0000-0000-0000-000000000701',
  '00000000-0000-0000-0000-000000000101',
  'extraordinario',
  'publicada'
);

CREATE OR REPLACE FUNCTION public.resolve_estado_resultado(
  p_matricula_id uuid,
  p_disciplina_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'status', 'aprovado',
    'positivo', true,
    'nota', 12,
    'motivo', 'exame_substitutivo_resolvido',
    'exame_sessao_id', '00000000-0000-0000-0000-000000000701'::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(
  p_escola_id uuid,
  p_matricula_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'decision', 'transitou',
    'destino', 'proxima_etapa',
    'motivo', 'sem_pendencias',
    'efetivacao_matricula_bloqueada', false,
    'disciplina_ids_pendentes', '[]'::jsonb
  );
$$;

SELECT public.sync_dependencias_academicas_transicao(
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000302'
);

DO $case4$
DECLARE
  v_status text;
  v_note numeric;
  v_resolved timestamptz;
  v_events integer;
BEGIN
  SELECT status, resultado_nota, resolvido_em
    INTO v_status, v_note, v_resolved
  FROM public.dependencias_academicas_transicao
  WHERE escola_id = '00000000-0000-0000-0000-000000000101'
    AND matricula_origem_id = '00000000-0000-0000-0000-000000000301'
    AND disciplina_id = '00000000-0000-0000-0000-000000000501';

  SELECT count(*)::integer INTO v_events
  FROM public.dependencias_academicas_transicao_eventos e
  JOIN public.dependencias_academicas_transicao d ON d.id = e.dependencia_id
  WHERE d.matricula_origem_id = '00000000-0000-0000-0000-000000000301'
    AND d.disciplina_id = '00000000-0000-0000-0000-000000000501';

  IF v_status IS DISTINCT FROM 'resolvida_aprovada'
     OR v_note IS DISTINCT FROM 12
     OR v_resolved IS NULL THEN
    RAISE EXCEPTION 'carryover regression: resolution did not close correctly status=% note=% resolved=%',
      v_status, v_note, v_resolved;
  END IF;

  IF v_events < 2 THEN
    RAISE EXCEPTION 'carryover regression: expected audit transitions, got %', v_events;
  END IF;
END;
$case4$;

ROLLBACK;
