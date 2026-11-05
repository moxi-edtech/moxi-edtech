-- Disposable fixture, extending the existing integration fixture with actual
-- numeric resolver code and real appeal/disciplinary policies.
\ir fixture.sql
CREATE SCHEMA internal;
CREATE TABLE internal.fixture_notas(escola_id uuid,matricula_id uuid,disciplina_id uuid,nota_final numeric);
INSERT INTO internal.fixture_notas VALUES('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',7);
CREATE MATERIALIZED VIEW internal.mv_boletim_por_matricula AS SELECT * FROM internal.fixture_notas;
CREATE VIEW public.vw_boletim_por_matricula AS SELECT v.*,d.nome AS disciplina_nome FROM internal.mv_boletim_por_matricula v LEFT JOIN public.disciplinas_catalogo d ON d.id=v.disciplina_id;
GRANT USAGE ON SCHEMA internal TO authenticated;
GRANT SELECT ON public.vw_boletim_por_matricula,internal.mv_boletim_por_matricula TO authenticated;
CREATE FUNCTION public.user_has_role_in_school(p_escola_id uuid,p_roles text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$SELECT EXISTS(SELECT 1 FROM public.escola_users WHERE escola_id=p_escola_id AND user_id=auth.uid() AND papel=ANY(p_roles))$$;
\ir numeric_resolver.sql
\ir ../../../migrations/20260815190000_raa_reapreciacao_pedidos.sql
\ir ../../../migrations/20260816013000_raa_reapreciacao_publication_source.sql
ALTER TABLE public.raa_indisciplina_eventos
 ADD COLUMN id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 ADD COLUMN turma_id uuid, ADD COLUMN aluno_id uuid, ADD COLUMN categoria text,
 ADD COLUMN descricao text, ADD COLUMN gravidade text, ADD COLUMN medida_aplicada text,
 ADD COLUMN registado_por uuid, ADD COLUMN decisao_motivo text,
 ADD COLUMN resolvido_por uuid, ADD COLUMN resolvido_em timestamptz, ADD COLUMN updated_at timestamptz;
ALTER TABLE public.raa_indisciplina_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY raa_indisciplina_read ON public.raa_indisciplina_eventos FOR SELECT TO authenticated USING(public.user_can_access_raa_school(escola_id));
CREATE POLICY raa_indisciplina_school_insert_v2 ON public.raa_indisciplina_eventos FOR INSERT TO authenticated WITH CHECK(public.user_can_access_raa_school(escola_id));
GRANT INSERT ON public.raa_indisciplina_eventos TO authenticated;
\ir ../../../migrations/20271031002000_raa_reapreciacao_decision_permission_fix.sql
\ir exam_policies.sql
\ir discipline_guard.sql
CREATE TABLE public.aluno_falta_justificacoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,matricula_id uuid,frequencia_id uuid,aluno_id uuid,status text,decision_reason text,reviewed_by uuid,reviewed_at timestamptz);
ALTER TABLE public.aluno_falta_justificacoes ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$SELECT escola_id FROM public.escola_users WHERE user_id=auth.uid() LIMIT 1$$;
CREATE FUNCTION public.portal_user_can_access_aluno(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
CREATE POLICY aluno_falta_justificacoes_read ON public.aluno_falta_justificacoes FOR SELECT TO authenticated USING(public.user_can_access_raa_school(escola_id));
CREATE POLICY aluno_falta_justificacoes_staff_decide ON public.aluno_falta_justificacoes FOR UPDATE TO authenticated USING(public.user_can_access_raa_school(escola_id)) WITH CHECK(public.user_can_access_raa_school(escola_id));
GRANT SELECT,UPDATE ON public.aluno_falta_justificacoes TO authenticated;

-- Metadata consumed by the real TypeScript RAA adapter (empty attendance is
-- intentional for the numerical exam pathway; EJA uses official summaries).
ALTER TABLE public.turma_disciplinas ADD COLUMN carga_horaria_semanal numeric DEFAULT 2;
ALTER TABLE public.disciplinas_catalogo ADD COLUMN carga_horaria_semana numeric DEFAULT 2;
CREATE TABLE public.aulas(id uuid,escola_id uuid,turma_disciplina_id uuid);
CREATE TABLE public.frequencias(id uuid,escola_id uuid,matricula_id uuid,aula_id uuid,periodo_letivo_id uuid,status text);
GRANT SELECT ON public.turma_disciplinas,public.disciplinas_catalogo,public.aulas,public.frequencias,public.exame_sessoes,public.exame_componentes,public.periodos_letivos TO authenticated;

-- Exact existing production column grant required by SELECT FOR SHARE in guard.
GRANT UPDATE(estado,updated_at) ON public.exame_sessoes TO authenticated;

ALTER TABLE public.exame_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exame_componentes ENABLE ROW LEVEL SECURITY;
\ir session_policies.sql
