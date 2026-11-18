-- AUD-P1: corrigir a policy legada tenant_all_access de excecoes_pauta.
-- A policy anterior permitia a qualquer membro da escola aprovar pedidos via REST.
-- GATE: não aplicar em produção sem CI de PostgreSQL e homologação autenticada.
BEGIN;

CREATE OR REPLACE FUNCTION public.validar_transicao_excecao_pauta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_uid uuid := auth.uid();
DECLARE v_director boolean;
BEGIN
  IF v_uid IS NULL OR NEW.escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'sem_contexto_de_escola' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'PENDENTE' OR NEW.user_id IS DISTINCT FROM v_uid
      OR NEW.solicitado_por IS DISTINCT FROM v_uid OR NEW.criado_por IS DISTINCT FROM v_uid
      OR NEW.ano_letivo_id IS NULL OR NEW.disciplina_id IS NULL
      OR NEW.disciplina_catalogo_id IS NULL OR NEW.trimestre IS NULL OR NEW.trimestre NOT BETWEEN 1 AND 3
      OR NEW.expira_em <= now() OR NEW.expira_em > now() + interval '24 hours 5 minutes'
      OR NEW.aprovado_por IS NOT NULL OR NEW.decidido_em IS NOT NULL
    THEN
      RAISE EXCEPTION 'pedido_de_reabertura_invalido' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.turmas t
      JOIN public.turma_disciplinas td ON td.turma_id=t.id AND td.escola_id=t.escola_id
      JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=t.escola_id
      JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id
        AND cc.escola_id=t.escola_id AND cc.ano_letivo_id=t.ano_letivo_id
        AND cc.status='published'
      JOIN public.professores p ON p.escola_id=t.escola_id AND p.profile_id=v_uid
      WHERE t.id=NEW.turma_id AND t.escola_id=NEW.escola_id
        AND t.ano_letivo_id=NEW.ano_letivo_id
        AND td.avaliacao_disciplina_id=NEW.disciplina_id
        AND cm.disciplina_id=NEW.disciplina_catalogo_id
        AND (td.professor_id=p.id OR EXISTS (
          SELECT 1 FROM public.turma_disciplinas_professores tdp
          WHERE tdp.escola_id=t.escola_id AND tdp.turma_id=t.id
            AND tdp.disciplina_id=NEW.disciplina_catalogo_id AND tdp.professor_id=p.id))
        AND NOT EXISTS (
          SELECT 1 FROM public.turma_disciplinas other_td
          WHERE other_td.turma_id=t.id AND other_td.escola_id=t.escola_id
            AND other_td.avaliacao_disciplina_id=NEW.disciplina_id
            AND other_td.id<>td.id
        )
    ) THEN
      RAISE EXCEPTION 'professor_ou_disciplina_nao_autorizados' USING ERRCODE='42501';
    END IF;
    -- O GET prévio da API não evita corridas. Serializar por âmbito de
    -- pedido e recusar outro pedido activo do mesmo professor.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.escola_id::text || NEW.turma_id::text || NEW.ano_letivo_id::text ||
      NEW.disciplina_id::text || NEW.trimestre::text || v_uid::text, 0));
    IF EXISTS (
      SELECT 1 FROM public.excecoes_pauta e
      WHERE e.escola_id=NEW.escola_id AND e.turma_id=NEW.turma_id
        AND e.ano_letivo_id=NEW.ano_letivo_id AND e.disciplina_id=NEW.disciplina_id
        AND e.trimestre=NEW.trimestre AND e.solicitado_por=v_uid
        AND e.status IN ('PENDENTE','APROVADO') AND e.expira_em>now()
    ) THEN
      RAISE EXCEPTION 'pedido_duplicado' USING ERRCODE='23505';
    END IF;
    RETURN NEW;
  END IF;

  -- Só a equipa de decisão pode alterar o estado; o professor não pode
  -- conceder acesso por uma chamada REST directa.
  SELECT EXISTS (
    SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=OLD.escola_id
      AND eu.user_id=v_uid
      AND eu.papel IN ('diretor','admin_escola','admin','staff_admin',
                       'admin_secretaria','secretaria','admin_financeiro')
  ) INTO v_director;
  IF NOT v_director AND NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'decisao_nao_autorizada' USING ERRCODE='42501';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status','aprovado_por','decidido_em','decisao_motivo','expira_em'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','aprovado_por','decidido_em','decisao_motivo','expira_em'])
  THEN
    RAISE EXCEPTION 'identidade_do_pedido_imutavel' USING ERRCODE='42501';
  END IF;
  IF NOT (
    (OLD.status='PENDENTE' AND NEW.status IN ('APROVADO','REJEITADO')) OR
    (OLD.status='APROVADO' AND NEW.status='EXPIRADO')
  ) OR NEW.aprovado_por IS DISTINCT FROM v_uid OR NEW.decidido_em IS NULL
     OR NEW.decidido_em < now() - interval '5 minutes'
     OR NEW.decidido_em > now() + interval '5 minutes'
  THEN
    RAISE EXCEPTION 'transicao_de_estado_invalida' USING ERRCODE='42501';
  END IF;
  IF NEW.status='APROVADO' THEN
    IF NEW.expira_em <= now() OR NEW.expira_em > now()+interval '24 hours 5 minutes' THEN
      RAISE EXCEPTION 'prazo_de_aprovacao_invalido' USING ERRCODE='42501';
    END IF;
  ELSIF NEW.status IN ('REJEITADO','EXPIRADO') THEN
    IF length(btrim(coalesce(NEW.decisao_motivo,'')))<5 OR NEW.expira_em>now()+interval '5 minutes' THEN
      RAISE EXCEPTION 'decisao_sem_motivo' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validar_transicao_excecao_pauta() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validar_transicao_excecao_pauta ON public.excecoes_pauta;
CREATE TRIGGER validar_transicao_excecao_pauta
BEFORE INSERT OR UPDATE ON public.excecoes_pauta
FOR EACH ROW EXECUTE FUNCTION public.validar_transicao_excecao_pauta();

ALTER TABLE public.excecoes_pauta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_all_access ON public.excecoes_pauta;
DROP POLICY IF EXISTS excecoes_pauta_select_scope ON public.excecoes_pauta;
DROP POLICY IF EXISTS excecoes_pauta_insert_professor ON public.excecoes_pauta;
DROP POLICY IF EXISTS excecoes_pauta_decisao_staff ON public.excecoes_pauta;
CREATE POLICY excecoes_pauta_select_scope ON public.excecoes_pauta
FOR SELECT TO authenticated USING (
  (escola_id=(select public.current_tenant_escola_id()) OR public.check_super_admin_role())
  AND (solicitado_por=(select auth.uid()) OR public.check_super_admin_role() OR
    EXISTS (SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id=excecoes_pauta.escola_id AND eu.user_id=(select auth.uid())
        AND eu.papel IN ('diretor','admin_escola','admin','staff_admin',
                         'admin_secretaria','secretaria','admin_financeiro')))
);
CREATE POLICY excecoes_pauta_insert_professor ON public.excecoes_pauta
FOR INSERT TO authenticated WITH CHECK (
  escola_id=(select public.current_tenant_escola_id())
  AND user_id=(select auth.uid()) AND solicitado_por=(select auth.uid())
  AND criado_por=(select auth.uid()) AND status='PENDENTE'
);
CREATE POLICY excecoes_pauta_decisao_staff ON public.excecoes_pauta
FOR UPDATE TO authenticated USING (
  (escola_id=(select public.current_tenant_escola_id()) OR public.check_super_admin_role())
  AND (public.check_super_admin_role() OR EXISTS (
    SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=excecoes_pauta.escola_id
      AND eu.user_id=(select auth.uid()) AND eu.papel IN
        ('diretor','admin_escola','admin','staff_admin','admin_secretaria','secretaria','admin_financeiro')))
) WITH CHECK (
  (escola_id=(select public.current_tenant_escola_id()) OR public.check_super_admin_role())
  AND (public.check_super_admin_role() OR EXISTS (
    SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=excecoes_pauta.escola_id
      AND eu.user_id=(select auth.uid()) AND eu.papel IN
        ('diretor','admin_escola','admin','staff_admin','admin_secretaria','secretaria','admin_financeiro')))
);
-- Sem política DELETE; revogação auditada é UPDATE APROVADO -> EXPIRADO.
COMMIT;
