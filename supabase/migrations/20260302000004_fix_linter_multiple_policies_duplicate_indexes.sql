BEGIN;

-- =========================================================
-- RLS: unificar políticas permissivas em uma única policy
-- =========================================================

ALTER TABLE public.aluno_processo_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.aluno_processo_counters;
DROP POLICY IF EXISTS super_admin_select ON public.aluno_processo_counters;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.aluno_processo_counters;
CREATE POLICY tenant_or_super_admin_select ON public.aluno_processo_counters
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.alunos;
DROP POLICY IF EXISTS super_admin_select ON public.alunos;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.alunos;
CREATE POLICY tenant_or_super_admin_select ON public.alunos
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.aulas;
DROP POLICY IF EXISTS super_admin_select ON public.aulas;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.aulas;
CREATE POLICY tenant_or_super_admin_select ON public.aulas
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.avaliacoes;
DROP POLICY IF EXISTS super_admin_select ON public.avaliacoes;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.avaliacoes;
CREATE POLICY tenant_or_super_admin_select ON public.avaliacoes
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.cursos;
DROP POLICY IF EXISTS super_admin_select ON public.cursos;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.cursos;
CREATE POLICY tenant_or_super_admin_select ON public.cursos
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.financeiro_contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.financeiro_contratos;
DROP POLICY IF EXISTS super_admin_select ON public.financeiro_contratos;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.financeiro_contratos;
CREATE POLICY tenant_or_super_admin_select ON public.financeiro_contratos
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS super_admin_select ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.financeiro_lancamentos;
CREATE POLICY tenant_or_super_admin_select ON public.financeiro_lancamentos
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.frequencias_default ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.frequencias_default;
DROP POLICY IF EXISTS super_admin_select ON public.frequencias_default;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.frequencias_default;
CREATE POLICY tenant_or_super_admin_select ON public.frequencias_default
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.historico_anos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.historico_anos;
DROP POLICY IF EXISTS super_admin_select ON public.historico_anos;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.historico_anos;
CREATE POLICY tenant_or_super_admin_select ON public.historico_anos
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.historico_disciplinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.historico_disciplinas;
DROP POLICY IF EXISTS super_admin_select ON public.historico_disciplinas;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.historico_disciplinas;
CREATE POLICY tenant_or_super_admin_select ON public.historico_disciplinas
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.historico_anos ha
      WHERE ha.id = historico_ano_id
        AND ha.escola_id = public.current_tenant_escola_id()
    )
  );

ALTER TABLE public.matricula_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.matricula_counters;
DROP POLICY IF EXISTS super_admin_select ON public.matricula_counters;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.matricula_counters;
CREATE POLICY tenant_or_super_admin_select ON public.matricula_counters
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.matriculas;
DROP POLICY IF EXISTS super_admin_select ON public.matriculas;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.matriculas;
CREATE POLICY tenant_or_super_admin_select ON public.matriculas
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.mensalidades;
DROP POLICY IF EXISTS super_admin_select ON public.mensalidades;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.mensalidades;
CREATE POLICY tenant_or_super_admin_select ON public.mensalidades
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.notas;
DROP POLICY IF EXISTS super_admin_select ON public.notas;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.notas;
CREATE POLICY tenant_or_super_admin_select ON public.notas
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.notas_avaliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.notas_avaliacoes;
DROP POLICY IF EXISTS super_admin_select ON public.notas_avaliacoes;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.notas_avaliacoes;
CREATE POLICY tenant_or_super_admin_select ON public.notas_avaliacoes
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.avaliacoes a
      WHERE a.id = avaliacao_id
        AND a.escola_id = public.current_tenant_escola_id()
    )
  );

ALTER TABLE public.outbox_notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.outbox_notificacoes;
DROP POLICY IF EXISTS super_admin_select ON public.outbox_notificacoes;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.outbox_notificacoes;
CREATE POLICY tenant_or_super_admin_select ON public.outbox_notificacoes
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.profiles_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.profiles_archive;
DROP POLICY IF EXISTS super_admin_select ON public.profiles_archive;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.profiles_archive;
CREATE POLICY tenant_or_super_admin_select ON public.profiles_archive
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.turmas;
DROP POLICY IF EXISTS super_admin_select ON public.turmas;
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.turmas;
CREATE POLICY tenant_or_super_admin_select ON public.turmas
  FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

-- =========================================================
-- Índices duplicados
-- =========================================================

DROP INDEX IF EXISTS public.idx_avaliacoes_escola_turma_disciplina;
DROP INDEX IF EXISTS public.ux_frequencias_2025_09_escola_matricula_data_aula;
DROP INDEX IF EXISTS public.ux_frequencias_2025_10_escola_matricula_data_aula;
DROP INDEX IF EXISTS public.ux_frequencias_2025_11_escola_matricula_data_aula;
DROP INDEX IF EXISTS public.ux_frequencias_2025_12_escola_matricula_data_aula;
DROP INDEX IF EXISTS public.ux_frequencias_2026_01_escola_matricula_data_aula;
DROP INDEX IF EXISTS public.ux_frequencias_2026_02_escola_matricula_data_aula;
DROP INDEX IF EXISTS public.ux_frequencias_default_escola_matricula_data_aula;

COMMIT;
