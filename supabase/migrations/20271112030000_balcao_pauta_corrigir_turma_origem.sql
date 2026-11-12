-- Source-class correction in the SAME selected pupil's 2025 pauta.
-- One click chooses an existing turma. No attachment, request, or manual reason.
-- Grade transcription remains in the installed audited grade writer.
BEGIN;

CREATE TABLE IF NOT EXISTS public.balcao_pauta_turma_correction_nonce (
  escola_id uuid NOT NULL,
  matricula_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  turma_origem_id uuid NOT NULL,
  turma_destino_id uuid NOT NULL,
  PRIMARY KEY (escola_id, matricula_id, actor_id)
);
ALTER TABLE public.balcao_pauta_turma_correction_nonce ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.balcao_pauta_turma_correction_nonce FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_turma_transfer_academic_evidence_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.turma_id IS NOT DISTINCT FROM OLD.turma_id THEN
    RETURN NEW;
  END IF;

  -- Only the audited, one-student RPC may correct a pending legacy pupil's
  -- source turma before transcription from the school's physical pauta.
  -- Table is not accessible to authenticated/anon clients.
  IF EXISTS (
    SELECT 1 FROM public.balcao_pauta_turma_correction_nonce nonce
    WHERE nonce.matricula_id = OLD.id
      AND nonce.escola_id = OLD.escola_id
      AND nonce.actor_id = auth.uid()
      AND nonce.turma_origem_id = OLD.turma_id
      AND nonce.turma_destino_id = NEW.turma_id
  ) THEN
    RETURN NEW;
  END IF;


  -- Nenhuma turma histórica pode ser movimentada em operação administrativa
  -- ordinária, mesmo que o caller evite a rota Next.js.
  IF OLD.session_id IS NULL
     OR OLD.session_id IS DISTINCT FROM NEW.session_id
     OR NOT EXISTS (
       SELECT 1 FROM public.anos_letivos y
       WHERE y.id = OLD.session_id AND y.escola_id = OLD.escola_id
         AND y.ativo IS TRUE
     ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P1051',
      MESSAGE = 'Ano letivo histórico ou inativo; usar o fluxo académico autorizado.';
  END IF;

  IF NOT EXISTS (
     SELECT 1
     FROM public.turmas source
     JOIN public.turmas target ON target.id = NEW.turma_id
     WHERE source.id = OLD.turma_id
       AND source.escola_id = OLD.escola_id
       AND target.escola_id = OLD.escola_id
       AND source.session_id = target.session_id
       AND source.session_id = OLD.session_id
       AND source.curso_id IS NOT DISTINCT FROM target.curso_id
       AND source.classe_id IS NOT DISTINCT FROM target.classe_id
       AND source.status_validacao = 'ativo'
       AND target.status_validacao = 'ativo'
       AND source.status_fecho = 'ABERTO'
       AND target.status_fecho = 'ABERTO'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P1052',
      MESSAGE = 'Turmas incompatíveis, encerradas ou de outra escola.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notas n
    WHERE n.escola_id = OLD.escola_id AND n.matricula_id = OLD.id
  ) OR EXISTS (
    SELECT 1 FROM public.exame_resultados er
    WHERE er.escola_id = OLD.escola_id AND er.matricula_id = OLD.id
  ) OR EXISTS (
    SELECT 1 FROM public.frequencias fr
    WHERE fr.escola_id = OLD.escola_id AND fr.matricula_id = OLD.id
  ) OR EXISTS (
    SELECT 1 FROM public.frequencia_status_periodo fp
    WHERE fp.escola_id = OLD.escola_id AND fp.matricula_id = OLD.id
  ) OR EXISTS (
    SELECT 1 FROM public.presencas p
    WHERE p.escola_id = OLD.escola_id
      AND p.aluno_id = OLD.aluno_id
      AND p.turma_id = OLD.turma_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P1050',
      MESSAGE = 'Existem notas, exames ou frequência na turma de origem. A transferência em massa requer conciliação académica para preservar as pautas.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_turma_transfer_secondary_evidence_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.turma_id IS NOT DISTINCT FROM OLD.turma_id THEN
    RETURN NEW;
  END IF;

  -- Only the audited, one-student RPC may correct a pending legacy pupil's
  -- source turma before transcription from the school's physical pauta.
  -- Table is not accessible to authenticated/anon clients.
  IF EXISTS (
    SELECT 1 FROM public.balcao_pauta_turma_correction_nonce nonce
    WHERE nonce.matricula_id = OLD.id
      AND nonce.escola_id = OLD.escola_id
      AND nonce.actor_id = auth.uid()
      AND nonce.turma_origem_id = OLD.turma_id
      AND nonce.turma_destino_id = NEW.turma_id
  ) THEN
    RETURN NEW;
  END IF;


  -- Covers even a direct UPDATE from a privileged legacy writer. Artifact
  -- publication takes the same class lock before writing its source record;
  -- evaluate the evidence under a fresh READ COMMITTED snapshot afterwards.
  PERFORM 1 FROM public.turmas t
  WHERE t.id = OLD.turma_id AND t.escola_id = OLD.escola_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P1052',
      MESSAGE='Turma de origem da matrícula não encontrada.';
  END IF;
  -- Grades from superseded writers must remain anchored to their real class.
  -- Historical and officially published evidence cannot be safely moved
  -- merely by overwriting matriculas.turma_id.
  IF public.turma_transfer_has_secondary_evidence_v1(
    OLD.escola_id, OLD.id, OLD.turma_id, OLD.aluno_id, OLD.ano_letivo
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P1050',
      MESSAGE = 'Existe histórico, pauta ou decisão académica ligada à turma de origem. Não alterar a matrícula sem conciliação temporal certificada.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.balcao_corrigir_turma_origem_pauta(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_turma_destino_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_source public.matriculas%ROWTYPE;
  v_old_turma public.turmas%ROWTYPE;
  v_new_turma public.turmas%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR
     public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id OR
     NOT public.user_has_role_in_school(p_escola_id,ARRAY[
       'secretaria','admin_secretaria','admin_secretario','admin_financeiro',
       'admin','admin_escola','staff_admin','diretor'
     ]::text[]) THEN
    RAISE EXCEPTION 'Não tem acesso à pauta desta escola.'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_source FROM public.matriculas
  WHERE id=p_matricula_id AND escola_id=p_escola_id FOR UPDATE;
  IF NOT FOUND OR v_source.turma_id IS NULL THEN
    RAISE EXCEPTION 'Matrícula do aluno não encontrada.' USING ERRCODE='23514';
  END IF;
  IF v_source.turma_id = p_turma_destino_id THEN
    RETURN pg_catalog.jsonb_build_object('ok',true,'matricula_id',v_source.id,
      'turma_id',v_source.turma_id,'alterada',false);
  END IF;
  IF v_source.status <> 'pendente' OR v_source.ativo IS DISTINCT FROM false
     OR v_source.status_fecho_origem IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION 'A turma desta matrícula já não permite correção de origem.'
      USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.anos_letivos ano
    WHERE ano.id=v_source.session_id AND ano.escola_id=p_escola_id
      AND ano.ano=v_source.ano_letivo AND ano.ativo=false
      AND ano.ano = (SELECT max(ano_ativo.ano)-1
                     FROM public.anos_letivos ano_ativo
                     WHERE ano_ativo.escola_id=p_escola_id AND ano_ativo.ativo=true)
  ) THEN
    RAISE EXCEPTION 'A pauta não pertence ao ano anterior.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_old_turma FROM public.turmas WHERE id=v_source.turma_id AND escola_id=p_escola_id;
  SELECT * INTO v_new_turma FROM public.turmas WHERE id=p_turma_destino_id AND escola_id=p_escola_id;
  IF v_old_turma.id IS NULL OR v_new_turma.id IS NULL
     OR v_old_turma.session_id IS DISTINCT FROM v_source.session_id
     OR v_new_turma.session_id IS DISTINCT FROM v_source.session_id
     OR v_new_turma.ano_letivo IS DISTINCT FROM v_source.ano_letivo
     OR v_old_turma.curso_id IS DISTINCT FROM v_new_turma.curso_id
     OR v_new_turma.status_validacao IS DISTINCT FROM 'ativo' THEN
    RAISE EXCEPTION 'Escolha uma turma válida do mesmo ano e curso.'
      USING ERRCODE='23514';
  END IF;

  -- An existing individual assessment or officially closed history cannot be
  -- silently re-bound to another pauta. No upload/approval is required.
  IF EXISTS (SELECT 1 FROM public.notas n
             WHERE n.matricula_id=v_source.id AND n.escola_id=p_escola_id)
     OR EXISTS (SELECT 1 FROM public.notas_avaliacoes n WHERE n.matricula_id=v_source.id)
     OR EXISTS (SELECT 1 FROM public.lancamentos l WHERE l.matricula_id=v_source.id)
     OR EXISTS (SELECT 1 FROM public.frequencias f WHERE f.matricula_id=v_source.id AND f.escola_id=p_escola_id)
     OR EXISTS (SELECT 1 FROM public.exame_resultados e WHERE e.matricula_id=v_source.id AND e.escola_id=p_escola_id)
     OR EXISTS (SELECT 1 FROM public.historico_anos h
               WHERE h.escola_id=p_escola_id
                 AND (h.matricula_id=v_source.id
                   OR (h.aluno_id=v_source.aluno_id AND h.ano_letivo=v_source.ano_letivo)))
     OR EXISTS (SELECT 1 FROM public.historico_snapshot_locks h
                WHERE h.escola_id=p_escola_id AND h.matricula_id=v_source.id AND h.status='fechado')
  THEN
    RAISE EXCEPTION 'A turma tem avaliações deste aluno já registadas. Abra a pauta existente.'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.balcao_pauta_turma_correction_nonce(
    escola_id, matricula_id, actor_id, turma_origem_id, turma_destino_id
  ) VALUES(p_escola_id,v_source.id,v_actor,v_source.turma_id,p_turma_destino_id);

  UPDATE public.matriculas
  SET turma_id=v_new_turma.id,updated_at=now(),updated_by=v_actor
  WHERE id=v_source.id AND escola_id=p_escola_id AND turma_id=v_source.turma_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A matrícula foi alterada. Atualize a pauta.' USING ERRCODE='40001';
  END IF;

  DELETE FROM public.balcao_pauta_turma_correction_nonce
  WHERE escola_id=p_escola_id AND matricula_id=v_source.id AND actor_id=v_actor;

  INSERT INTO public.audit_logs(
    escola_id,actor_id,action,entity,entity_id,portal,details,before,after
  ) VALUES (
    p_escola_id,v_actor,'BALCAO_PAUTA_TURMA_ORIGEM_CORRIGIDA',
    'matriculas',v_source.id::text,'secretaria',
    pg_catalog.jsonb_build_object(
      'aluno_id',v_source.aluno_id,'ano_letivo',v_source.ano_letivo,
      'origem','pauta_fisica_escola'),
    pg_catalog.jsonb_build_object('turma_id',v_old_turma.id),
    pg_catalog.jsonb_build_object('turma_id',v_new_turma.id)
  );
  RETURN pg_catalog.jsonb_build_object('ok',true,'matricula_id',v_source.id,
    'turma_id',v_new_turma.id,'alterada',true);
END;
$function$;
REVOKE ALL ON FUNCTION public.balcao_corrigir_turma_origem_pauta(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_corrigir_turma_origem_pauta(uuid,uuid,uuid) TO authenticated;

COMMIT;
