-- KLASSE Student Lifecycle SSOT: deterministic final replay after 2027 dependencies.
-- Earlier 20261028 files are version-preserving no-op shims for fresh replay.
-- Original executed SQL remains in supabase/ops/applied_lifecycle_20261028/.
-- Historical grades, results and snapshots are never backfilled by inference.
BEGIN;
SET LOCAL lock_timeout = '4s';

CREATE OR REPLACE FUNCTION public.lifecycle_sync_matricula_ativo()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $lifecycle_sync$
BEGIN
  -- A flag diz exclusivamente se a matrícula está operacionalmente ativa.
  -- O significado académico de aprovado/reprovado é independente.
  NEW.ativo := public.canonicalize_matricula_status_text(NEW.status) = 'ativo';
  RETURN NEW;
END;
$lifecycle_sync$;

DROP TRIGGER IF EXISTS trg_zzz_lifecycle_sync_matricula_ativo ON public.matriculas;
CREATE TRIGGER trg_zzz_lifecycle_sync_matricula_ativo
BEFORE INSERT OR UPDATE OF status, ativo ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_sync_matricula_ativo();



ALTER TABLE public.matriculas ALTER COLUMN ativo SET DEFAULT false;
ALTER TABLE public.matriculas ALTER COLUMN ativo SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_historico_anos_compat()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public'
AS $historico_sync$
BEGIN
  -- resultado_final é canónico; status_final é um alias legado sincronizado.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.resultado_final IS DISTINCT FROM OLD.resultado_final
       AND NEW.status_final IS DISTINCT FROM OLD.status_final
       AND NEW.resultado_final IS DISTINCT FROM NEW.status_final THEN
      RAISE EXCEPTION 'LIFECYCLE_HISTORY_CONFLICT' USING ERRCODE='23514';
    ELSIF NEW.resultado_final IS DISTINCT FROM OLD.resultado_final THEN
      NEW.status_final := NEW.resultado_final;
    ELSIF NEW.status_final IS DISTINCT FROM OLD.status_final THEN
      NEW.resultado_final := NEW.status_final;
    END IF;
  END IF;
  IF NEW.resultado_final IS NOT NULL AND NEW.status_final IS NOT NULL
     AND NEW.resultado_final IS DISTINCT FROM NEW.status_final THEN
    RAISE EXCEPTION 'LIFECYCLE_HISTORY_CONFLICT' USING ERRCODE='23514';
  END IF;
  NEW.resultado_final := COALESCE(NEW.resultado_final, NEW.status_final);
  NEW.status_final := COALESCE(NEW.status_final, NEW.resultado_final);
  NEW.updated_at := now();
  RETURN NEW;
END;
$historico_sync$;



CREATE OR REPLACE FUNCTION public.gerar_historico_anual(p_matricula_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_matricula record;
  v_historico_ano_id uuid;
  boletim_row record;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_snapshot_lock record;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id não resolvido.';
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = v_escola_id;
  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula com ID % não encontrada.', p_matricula_id;
  END IF;

  IF public.canonicalize_matricula_status_text(v_matricula.status)
     NOT IN ('concluido','reprovado') OR v_matricula.ativo IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'LIFECYCLE_HISTORY_NOT_FINAL: matrícula sem fecho académico confirmado' USING ERRCODE='23514';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT hsl.* INTO v_snapshot_lock
  FROM public.historico_snapshot_locks hsl
  WHERE hsl.escola_id = v_escola_id
    AND hsl.matricula_id = p_matricula_id
  ORDER BY hsl.updated_at DESC
  LIMIT 1;

  IF v_snapshot_lock.id IS NOT NULL AND v_snapshot_lock.status = 'fechado' THEN
    RAISE EXCEPTION 'LEGAL_LOCK: Histórico legal já congelado para esta matrícula. Reabertura auditada obrigatória.';
  END IF;

  INSERT INTO public.historico_anos (escola_id, aluno_id, ano_letivo, ano_letivo_id, turma_id, matricula_id, status_final, snapshot_status)
  VALUES (
    v_matricula.escola_id,
    v_matricula.aluno_id,
    v_matricula.ano_letivo,
    v_matricula.session_id,
    v_matricula.turma_id,
    p_matricula_id,
    v_matricula.status,
    'aberto'
  )
  ON CONFLICT (escola_id, aluno_id, ano_letivo) DO UPDATE SET
    turma_id = EXCLUDED.turma_id,
    matricula_id = EXCLUDED.matricula_id,
    ano_letivo_id = EXCLUDED.ano_letivo_id,
    status_final = EXCLUDED.status_final
  RETURNING id INTO v_historico_ano_id;

  FOR boletim_row IN
    SELECT *
    FROM public.vw_boletim_por_matricula
    WHERE matricula_id = p_matricula_id
  LOOP
    INSERT INTO public.historico_disciplinas (
      historico_ano_id,
      disciplina_id,
      disciplina_nome,
      nota_final,
      status_final,
      notas_detalhe
    )
    VALUES (
      v_historico_ano_id,
      boletim_row.disciplina_id,
      boletim_row.disciplina_nome,
      boletim_row.nota_final,
      CASE
        WHEN boletim_row.nota_final >= 9.5 THEN 'aprovado'
        ELSE 'reprovado'
      END,
      boletim_row.notas_por_tipo
    )
    ON CONFLICT (historico_ano_id, disciplina_id) DO UPDATE SET
      disciplina_nome = EXCLUDED.disciplina_nome,
      nota_final = EXCLUDED.nota_final,
      status_final = EXCLUDED.status_final,
      notas_detalhe = EXCLUDED.notas_detalhe;
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_matricula.escola_id,
    auth.uid(),
    'HISTORICO_ANUAL_GERADO',
    'historico_anos',
    v_historico_ano_id::text,
    'system',
    jsonb_build_object(
      'matricula_id', p_matricula_id,
      'status_final_matricula', v_matricula.status,
      'snapshot_status', 'aberto'
    )
  );

  RETURN v_historico_ano_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_matricula_blindada(p_escola_id uuid, p_matricula_id uuid, p_motivo text DEFAULT NULL::text, p_is_override_manual boolean DEFAULT false, p_status_override text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_matricula record;
  v_has_role boolean := false;
  v_is_admin boolean := false;
  v_status_calculado text;
  v_origem text;
  v_grade jsonb;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) INTO v_has_role;
  IF NOT v_has_role THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_matricula
  FROM public.matriculas
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id
  FOR UPDATE;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  IF public.canonicalize_matricula_status_text(v_matricula.status) NOT IN ('ativo', 'pendente') THEN
    RAISE EXCEPTION 'LOGIC: Esta matrícula já foi finalizada ou não está em andamento.';
  END IF;

  IF p_is_override_manual THEN
    SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola', 'staff_admin']) INTO v_is_admin;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'AUTH: Apenas admin/direção pode aplicar override manual.';
    END IF;

    IF p_status_override IS NULL THEN
      RAISE EXCEPTION 'LOGIC: status_override é obrigatório quando override manual está activo.';
    END IF;

    v_status_calculado := public.canonicalize_matricula_status_text(p_status_override);
    IF v_status_calculado NOT IN ('transferido', 'anulado', 'reprovado_por_faltas') THEN
      RAISE EXCEPTION 'LOGIC: Override inválido. Use transferido, anulado ou reprovado_por_faltas.';
    END IF;
    v_origem := 'override_admin';
  ELSE
    v_grade := public.gradeengine_calcular_situacao(p_matricula_id);

    IF COALESCE(v_grade->>'situacao_final', '') = 'incompleto' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 'incompleto',
        'message', 'Não é possível finalizar. Existem disciplinas sem notas lançadas ou pautas abertas.',
        'motivos', COALESCE(v_grade->'motivos', '[]'::jsonb)
      );
    END IF;

    IF v_grade->>'situacao_final' = 'aprovado' THEN
      v_status_calculado := 'concluido';
    ELSIF v_grade->>'situacao_final' = 'reprovado' THEN
      v_status_calculado := 'reprovado';
    ELSE
      RAISE EXCEPTION 'LOGIC: Situação final desconhecida retornada pelo GradeEngine.';
    END IF;

    v_origem := 'gradeengine';
  END IF;

  UPDATE public.matriculas
  SET status = v_status_calculado,
      ativo = false,
      motivo_fecho = NULLIF(trim(p_motivo), ''),
      data_fecho = now(),
      status_fecho_origem = v_origem,
      updated_at = now()
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id
    AND public.canonicalize_matricula_status_text(status) IN ('ativo', 'pendente');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOGIC: Conflito de concorrência ao finalizar matrícula.';
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'MATRICULA_FINALIZADA_BLINDADA',
    'matriculas',
    p_matricula_id::text,
    'secretaria',
    jsonb_build_object(
      'status', v_status_calculado,
      'origem', v_origem,
      'motivo', NULLIF(trim(p_motivo), '')
    )
  );

  IF v_status_calculado IN ('concluido', 'reprovado') THEN
    PERFORM public.gerar_historico_anual(p_matricula_id);

    -- A decisão calculada pelo GradeEngine é a autoridade académica.
    -- O status da matrícula continua apenas a fechar o vínculo administrativo.
    IF v_origem = 'gradeengine' THEN
      UPDATE public.historico_anos
         SET resultado_final = v_grade->>'situacao_final',
             status_final = v_grade->>'situacao_final'
       WHERE escola_id = v_escola_id
         AND matricula_id = p_matricula_id
         AND snapshot_status = 'aberto';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status_calculado,
    'status_fecho_origem', v_origem
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_aluno_after_matricula()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','extensions'
AS $activate$
BEGIN
  -- Status é normalizado para 'ativo' pelo trigger canónico ANTES deste AFTER.
  -- Não inferir aprovação; atualizar apenas o estado administrativo do aluno.
  IF NEW.status='ativo' AND NEW.ativo IS TRUE
     AND NEW.numero_matricula IS NOT NULL
     AND btrim(NEW.numero_matricula) <> '' THEN
    UPDATE public.alunos
       SET status='ativo'
     WHERE id=NEW.aluno_id
       AND escola_id=NEW.escola_id
       AND status IS DISTINCT FROM 'ativo';
  END IF;
  RETURN NEW;
END;
$activate$;

DO $lifecycle_constraints$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.matriculas'::regclass AND conname='chk_lifecycle_status_ativo_consistente') THEN
  ALTER TABLE public.matriculas ADD CONSTRAINT chk_lifecycle_status_ativo_consistente CHECK ((status = 'ativo') = ativo) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.historico_anos'::regclass AND conname='fk_lifecycle_historico_matricula') THEN
  ALTER TABLE public.historico_anos ADD CONSTRAINT fk_lifecycle_historico_matricula FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.historico_anos'::regclass AND conname='chk_lifecycle_historico_com_matricula') THEN
  ALTER TABLE public.historico_anos ADD CONSTRAINT chk_lifecycle_historico_com_matricula CHECK (matricula_id IS NOT NULL) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.historico_anos'::regclass AND conname='chk_lifecycle_historico_resultado_par') THEN
  ALTER TABLE public.historico_anos ADD CONSTRAINT chk_lifecycle_historico_resultado_par CHECK (status_final IS NULL OR status_final = resultado_final) NOT VALID;
 END IF;
END $lifecycle_constraints$;
ALTER TABLE public.matriculas VALIDATE CONSTRAINT chk_lifecycle_status_ativo_consistente;
ALTER TABLE public.historico_anos VALIDATE CONSTRAINT fk_lifecycle_historico_matricula;
ALTER TABLE public.historico_anos VALIDATE CONSTRAINT chk_lifecycle_historico_resultado_par;
DO $lifecycle_historico_validate$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.historico_anos WHERE matricula_id IS NULL) THEN
  ALTER TABLE public.historico_anos VALIDATE CONSTRAINT chk_lifecycle_historico_com_matricula;
 END IF;
END $lifecycle_historico_validate$;

CREATE OR REPLACE VIEW public.v_student_lifecycle_ssot_v1
WITH (security_invoker=true) AS
SELECT m.id AS matricula_id, m.escola_id, m.aluno_id, m.ano_letivo,
       m.session_id AS ano_letivo_id, m.turma_id,
       m.origem_transicao_matricula_id, m.status AS status_persistido,
       m.ativo AS ativo_persistido, m.motivo_fecho, m.data_fecho,
       CASE
         WHEN m.status='ativo' AND m.ativo THEN 'ativa'
         WHEN m.status='pendente' AND NOT m.ativo THEN 'pendente'
         WHEN m.status IN ('concluido','reprovado','reprovado_por_faltas','transferido','inativo','trancado')
           AND NOT m.ativo THEN 'encerrada'
         WHEN m.status IN ('anulado','desistente','cancelado')
           AND NOT m.ativo THEN 'cancelada'
         ELSE 'revisao'
       END AS estado_operacional,
       h.id AS historico_id, h.resultado_final AS resultado_registrado,
       h.snapshot_status,
       CASE
         WHEN h.snapshot_status='fechado' AND EXISTS (
           SELECT 1 FROM public.historico_snapshot_locks sl
           WHERE sl.historico_ano_id=h.id AND sl.matricula_id=m.id
             AND sl.escola_id=m.escola_id AND sl.status='fechado'
         ) THEN h.resultado_final ELSE NULL::text
       END AS resultado_oficial
FROM public.matriculas m
LEFT JOIN public.historico_anos h
  ON h.matricula_id=m.id AND h.escola_id=m.escola_id
 AND h.aluno_id=m.aluno_id AND h.ano_letivo=m.ano_letivo
WHERE
  current_user IN ('service_role','postgres')
  OR public.is_super_admin()
  OR public.user_has_role_in_school(m.escola_id,
    ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  OR EXISTS (
    SELECT 1 FROM public.alunos a
    WHERE a.id=m.aluno_id AND a.escola_id=m.escola_id
      AND a.profile_id=auth.uid()
  );

REVOKE ALL ON public.v_student_lifecycle_ssot_v1 FROM PUBLIC, anon;
GRANT SELECT ON public.v_student_lifecycle_ssot_v1 TO authenticated, service_role;

-- Escola/polo controla o contexto. O cargo é uma condição ADICIONAL,
-- jamais alternativa: cc_security.allowed_turma devolve true quando
-- os polos ainda não são aplicados na escola.
DROP POLICY IF EXISTS lifecycle_matriculas_insert_staff ON public.matriculas;
DROP POLICY IF EXISTS lifecycle_matriculas_update_staff ON public.matriculas;
DROP POLICY IF EXISTS lifecycle_matriculas_delete_staff ON public.matriculas;

CREATE POLICY lifecycle_matriculas_insert_staff ON public.matriculas
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  )
);

CREATE POLICY lifecycle_matriculas_update_staff ON public.matriculas
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  )
);

CREATE POLICY lifecycle_matriculas_delete_staff ON public.matriculas
AS RESTRICTIVE FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  )
);

-- KLASSE P0: remove direct JWT access to legacy SECURITY DEFINER writers.
-- They remain callable internally by owner/service_role.
-- No changes to student data, RAA results, notes, receipts or history.

REVOKE EXECUTE ON FUNCTION public.confirmar_matricula_core(uuid,integer,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_matricula_core(uuid,integer,uuid,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.confirmar_matricula(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_matricula(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.finalizar_matricula_anual(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_matricula_anual(uuid,uuid,text,text) TO service_role;

COMMIT;
