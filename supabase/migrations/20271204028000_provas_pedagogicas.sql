BEGIN;
-- Calendar is the single source of truth for class-specific dates. No question content is copied.
ALTER TABLE public.calendario_avaliacoes ADD COLUMN prova_id uuid REFERENCES public.provas_pedagogicas(id);
CREATE UNIQUE INDEX calendario_prova_turma_ativa_idx ON public.calendario_avaliacoes(prova_id,turma_id) WHERE prova_id IS NOT NULL AND estado<>'cancelado';
CREATE OR REPLACE FUNCTION provas_private.calendario_prova_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.prova_id IS DISTINCT FROM OLD.prova_id OR (OLD.prova_id IS NOT NULL AND NEW.periodo_letivo_id IS DISTINCT FROM OLD.periodo_letivo_id) THEN RAISE EXCEPTION 'immutable_proof_link' USING ERRCODE='23514'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.prova_id IS NULL THEN RETURN NEW; END IF;
 IF NOT provas_private.provas_papel(NEW.escola_id,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','admin_financeiro']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.provas_pedagogicas p
  JOIN public.turma_disciplinas td ON td.id=NEW.turma_disciplina_id AND td.escola_id=p.escola_id AND td.turma_id=NEW.turma_id AND td.curso_matriz_id=p.curso_matriz_id
  JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=p.escola_id AND t.ano_letivo_id=p.ano_letivo_id AND t.session_id=p.ano_letivo_id
  JOIN public.curso_matriz cm ON cm.id=p.curso_matriz_id AND cm.escola_id=p.escola_id AND cm.classe_id=t.classe_id AND cm.curso_id=t.curso_id
  JOIN public.periodos_letivos pl ON pl.id=NEW.periodo_letivo_id AND pl.escola_id=p.escola_id AND pl.ano_letivo_id=p.ano_letivo_id AND pl.tipo='TRIMESTRE' AND pl.numero=p.trimestre
  WHERE p.id=NEW.prova_id AND p.escola_id=NEW.escola_id AND p.ano_letivo_id=NEW.ano_letivo_id AND p.estado='aprovada'
   AND (td.periodos_ativos IS NULL OR p.trimestre=ANY(td.periodos_ativos))
 ) THEN RAISE EXCEPTION 'invalid_proof_calendar_context' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION provas_private.calendario_prova_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_calendario_prova_guard BEFORE INSERT OR UPDATE ON public.calendario_avaliacoes FOR EACH ROW EXECUTE FUNCTION provas_private.calendario_prova_guard();

-- Reuse RLS; the returned relation is filterable and paginated by PostgREST.
CREATE FUNCTION public.provas_por_professor(p_escola uuid,p_professor uuid)
RETURNS SETOF public.provas_pedagogicas LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.* FROM public.provas_pedagogicas p
 JOIN public.professores pr ON pr.id=p_professor AND pr.escola_id=p_escola
 WHERE p.escola_id=p_escola
 AND provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','admin_financeiro'])
 AND (p.autor_id=pr.profile_id OR EXISTS (
  SELECT 1 FROM public.turma_disciplinas td
  JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=p_escola AND t.ano_letivo_id=p.ano_letivo_id AND t.session_id=p.ano_letivo_id
  JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=p_escola AND cm.classe_id=t.classe_id AND cm.curso_id=t.curso_id
  WHERE td.escola_id=p_escola AND td.curso_matriz_id=p.curso_matriz_id
    AND (td.periodos_ativos IS NULL OR p.trimestre=ANY(td.periodos_ativos))
    AND (td.professor_id=pr.id OR EXISTS (SELECT 1 FROM public.turma_disciplinas_professores tdp WHERE tdp.escola_id=p_escola AND tdp.turma_id=t.id AND tdp.disciplina_id=cm.disciplina_id AND tdp.professor_id=pr.id))
 ));
$$;
REVOKE ALL ON FUNCTION public.provas_por_professor(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.provas_por_professor(uuid,uuid) TO authenticated;
COMMIT;
