-- CURTUME 2025/2026 ONLY. Notes are preserved. A director can sign
-- the authority of the documentary pauta over conflicting operational rows.
-- Source fingerprint invalidates the signature after ANY grade/source edit.
BEGIN;

CREATE TABLE IF NOT EXISTS public.curtume_2025_notas_conferidas (
  escola_id uuid NOT NULL CHECK (escola_id='3744879f-2e19-4671-8995-78604302d8c5'::uuid),
  matricula_id uuid NOT NULL,
  historico_ano_id uuid NOT NULL,
  fontes_hash text NOT NULL,
  referencia text NOT NULL CHECK (length(btrim(referencia))>=8),
  motivo text NOT NULL CHECK (length(btrim(motivo))>=12),
  diretor_id uuid NOT NULL,
  confirmado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(escola_id,matricula_id)
);
ALTER TABLE public.curtume_2025_notas_conferidas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.curtume_2025_notas_conferidas
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.curtume_2025_fontes_hash(
  p_escola_id uuid, p_matricula_id uuid, p_historico_ano_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $fn$
  SELECT pg_catalog.md5(
    coalesce((SELECT string_agg(
      to_jsonb(n)::text || '|' || coalesce(to_jsonb(a)::text,'null'),
      E'\n' ORDER BY n.id)
      FROM public.notas n
      LEFT JOIN public.avaliacoes a ON a.escola_id=n.escola_id AND a.id=n.avaliacao_id
      WHERE n.escola_id=p_escola_id AND n.matricula_id=p_matricula_id
    ),'SEM_NOTAS')
    || '||' ||
    coalesce((SELECT string_agg(to_jsonb(hd)::text, E'\n' ORDER BY hd.id)
      FROM public.historico_disciplinas hd
      WHERE hd.historico_ano_id=p_historico_ano_id
    ),'SEM_PAUTA')
  );
$fn$;
REVOKE ALL ON FUNCTION public.curtume_2025_fontes_hash(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.curtume_2025_notas_conferidas_validas(
  p_escola_id uuid,p_matricula_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE v_h uuid; v_hash text;
BEGIN
  IF p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
    OR p_matricula_id IS NULL
    OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RETURN false;
  END IF;
  SELECT h.id INTO v_h
  FROM public.historico_anos h
  JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
  WHERE h.escola_id=p_escola_id AND h.ano_letivo=2025
    AND h.matricula_id=p_matricula_id AND h.snapshot_status='aberto'
    AND m.ano_letivo=2025 AND m.session_id=h.ano_letivo_id
    AND m.status='concluido' AND NOT m.ativo
    AND m.status_fecho_origem='override_admin';
  IF v_h IS NULL THEN RETURN false; END IF;
  SELECT r.fontes_hash INTO v_hash
    FROM public.curtume_2025_notas_conferidas r
   WHERE r.escola_id=p_escola_id AND r.matricula_id=p_matricula_id
     AND r.historico_ano_id=v_h;
  IF v_hash IS NULL THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM public.notas n
                 WHERE n.escola_id=p_escola_id AND n.matricula_id=p_matricula_id)
     AND v_hash=public.curtume_2025_fontes_hash(p_escola_id,p_matricula_id,v_h);
END;
$fn$;
REVOKE ALL ON FUNCTION public.curtume_2025_notas_conferidas_validas(uuid,uuid)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.curtume_2025_conferir_notas_documentais(
  p_escola_id uuid,p_matricula_id uuid,p_referencia text,p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_role text;
  v_h uuid;
  v_aluno uuid;
  v_hash text;
  v_n integer;
  v_hd integer;
  v_ref text := btrim(coalesce(p_referencia,''));
  v_reason text := btrim(coalesce(p_motivo,''));
BEGIN
  IF p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
    OR p_matricula_id IS NULL OR v_actor IS NULL
    OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'CURTUME_2025_CONFERENCIA_NAO_AUTORIZADA' USING ERRCODE='42501';
  END IF;
  SELECT eu.papel INTO v_role FROM public.escola_users eu
    WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
      AND eu.papel IN ('admin','admin_escola','diretor') LIMIT 1;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'CURTUME_2025_CONFERENCIA_EXIGE_DIRECAO' USING ERRCODE='42501';
  END IF;
  IF length(v_ref)<8 OR length(v_reason)<12 THEN
    RAISE EXCEPTION 'CURTUME_2025_CONFERENCIA_FONTE_OBRIGATORIA' USING ERRCODE='23514';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('curtume2025:conferir:'||p_matricula_id::text,0));
  SELECT h.id,h.aluno_id INTO v_h,v_aluno
    FROM public.historico_anos h
    JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
   WHERE h.escola_id=p_escola_id AND h.matricula_id=p_matricula_id
     AND h.ano_letivo=2025 AND h.snapshot_status='aberto'
     AND m.ano_letivo=2025 AND m.session_id=h.ano_letivo_id
     AND m.status='concluido' AND NOT m.ativo
     AND m.status_fecho_origem='override_admin'
   FOR UPDATE OF h,m;
  IF v_h IS NULL THEN
    RAISE EXCEPTION 'CURTUME_2025_MATRICULA_ORIGEM_INVALIDA' USING ERRCODE='23514';
  END IF;
  SELECT count(*) INTO v_n FROM public.notas n
   WHERE n.escola_id=p_escola_id AND n.matricula_id=p_matricula_id;
  SELECT count(*) INTO v_hd FROM public.historico_disciplinas hd
   WHERE hd.historico_ano_id=v_h;
  IF v_n=0 OR v_hd=0 OR EXISTS(
      SELECT 1 FROM public.historico_disciplinas hd
      WHERE hd.historico_ano_id=v_h AND
        (hd.nota_final IS NULL OR hd.nota_final<0 OR
         hd.disciplina_id IS NULL OR nullif(btrim(hd.disciplina_nome),'') IS NULL OR
         hd.notas_detalhe->>'ano_letivo' NOT IN ('2025','2025/2026') OR
         hd.notas_detalhe->>'fonte' NOT IN
           ('pauta_fisica_excel','pauta_oficial_excel',
            'pauta_escola_transcrita','pauta_escola_oficial_transcrita') OR
         nullif(btrim(hd.notas_detalhe->>'arquivo'),'') IS NULL OR
         nullif(btrim(hd.notas_detalhe->>'aba'),'') IS NULL OR
         nullif(btrim(hd.notas_detalhe->>'linha'),'') IS NULL)
    ) THEN
    RAISE EXCEPTION 'CURTUME_2025_PAUTA_INCONSISTENTE' USING ERRCODE='23514';
  END IF;

  v_hash := public.curtume_2025_fontes_hash(p_escola_id,p_matricula_id,v_h);
  IF EXISTS (
      SELECT 1 FROM public.curtume_2025_notas_conferidas r
      WHERE r.escola_id=p_escola_id AND r.matricula_id=p_matricula_id
        AND r.historico_ano_id=v_h AND r.fontes_hash=v_hash
        AND r.diretor_id=v_actor AND r.referencia=v_ref AND r.motivo=v_reason
    ) THEN
    RETURN jsonb_build_object('ok',true,'reutilizada',true,'matricula_id',p_matricula_id);
  END IF;

  INSERT INTO public.curtume_2025_notas_conferidas
    (escola_id,matricula_id,historico_ano_id,fontes_hash,referencia,motivo,diretor_id,confirmado_em)
  VALUES(p_escola_id,p_matricula_id,v_h,v_hash,v_ref,v_reason,v_actor,now())
  ON CONFLICT(escola_id,matricula_id) DO UPDATE SET
    historico_ano_id=EXCLUDED.historico_ano_id,
    fontes_hash=EXCLUDED.fontes_hash,
    referencia=EXCLUDED.referencia,motivo=EXCLUDED.motivo,
    diretor_id=EXCLUDED.diretor_id,confirmado_em=EXCLUDED.confirmado_em;

  INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
  VALUES(p_escola_id,v_actor,'CURTUME_2025_NOTAS_CONFERIDAS_COM_PAUTA',
    'matriculas',p_matricula_id::text,'secretaria',
    jsonb_build_object('historico_ano_id',v_h,'aluno_id',v_aluno,
      'notas_operacionais_preservadas',v_n,'disciplinas_pauta',v_hd,
      'fontes_hash',v_hash,'papel_autorizado',v_role,
      'fonte_prevalente','pauta_escola_2025_2026',
      'referencia',v_ref,'motivo',v_reason));
  RETURN jsonb_build_object('ok',true,'reutilizada',false,
     'matricula_id',p_matricula_id,
     'notas_operacionais_preservadas',v_n,'disciplinas_pauta',v_hd);
END;
$fn$;
REVOKE ALL ON FUNCTION public.curtume_2025_conferir_notas_documentais(uuid,uuid,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.curtume_2025_conferir_notas_documentais(uuid,uuid,text,text)
  TO authenticated;

-- The signed reconciliation is part of all THREE independent legal checks.
-- Patch exact known bodies only; a changed canonical function fails closed.
DO $patch$
DECLARE v_sql text; v_old text; v_new text; v_signature regprocedure;
BEGIN
  v_signature := 'public.curtume_fechar_pautas_2025_lote(uuid,uuid,uuid,integer)'::regprocedure;
  v_sql := pg_catalog.pg_get_functiondef(v_signature);
  v_old := $a$IF EXISTS(SELECT 1 FROM public.notas n
                WHERE n.escola_id=p_escola_id
                  AND n.matricula_id=v_row.matricula_id) THEN$a$;
  v_new := $b$IF EXISTS(SELECT 1 FROM public.notas n
                WHERE n.escola_id=p_escola_id
                  AND n.matricula_id=v_row.matricula_id)
         AND NOT public.curtume_2025_notas_conferidas_validas(
           p_escola_id,v_row.matricula_id) THEN$b$;
  IF strpos(v_sql,v_old)>0 THEN
    EXECUTE replace(v_sql,v_old,v_new);
  ELSIF strpos(v_sql,'curtume_2025_notas_conferidas_validas')=0 THEN
    RAISE EXCEPTION 'CURTUME_2025_BATCH_GUARD_CHANGED';
  END IF;

  v_signature := 'public.historico_set_snapshot_state(uuid,uuid[],uuid,text,text,uuid)'::regprocedure;
  v_sql := pg_catalog.pg_get_functiondef(v_signature);
  v_old := $a$OR EXISTS (
          SELECT 1 FROM public.notas n
          WHERE n.escola_id=m.escola_id AND n.matricula_id=m.id
        )$a$;
  v_new := $b$OR (EXISTS (
          SELECT 1 FROM public.notas n
          WHERE n.escola_id=m.escola_id AND n.matricula_id=m.id
        ) AND NOT public.curtume_2025_notas_conferidas_validas(m.escola_id,m.id))$b$;
  IF strpos(v_sql,v_old)>0 THEN
    EXECUTE replace(v_sql,v_old,v_new);
  ELSIF strpos(v_sql,'curtume_2025_notas_conferidas_validas')=0 THEN
    RAISE EXCEPTION 'CURTUME_2025_LEGAL_GUARD_CHANGED';
  END IF;

  v_signature := 'public.resolve_raa_progression_for_matricula(uuid,uuid)'::regprocedure;
  v_sql := pg_catalog.pg_get_functiondef(v_signature);
  v_old := $a$AND NOT EXISTS (
        SELECT 1 FROM public.notas n
        WHERE n.escola_id=p_escola_id AND n.matricula_id=m.id
      )$a$;
  v_new := $b$AND (NOT EXISTS (
        SELECT 1 FROM public.notas n
        WHERE n.escola_id=p_escola_id AND n.matricula_id=m.id
      ) OR public.curtume_2025_notas_conferidas_validas(p_escola_id,m.id))$b$;
  IF strpos(v_sql,v_old)>0 THEN
    EXECUTE replace(v_sql,v_old,v_new);
  ELSIF strpos(v_sql,'curtume_2025_notas_conferidas_validas')=0 THEN
    RAISE EXCEPTION 'CURTUME_2025_RAA_GUARD_CHANGED';
  END IF;
END;
$patch$;
COMMIT;
