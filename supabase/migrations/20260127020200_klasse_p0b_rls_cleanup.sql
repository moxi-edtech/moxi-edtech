BEGIN;

-- =========================================================
-- 1) TORNAR FUNÇÕES USADAS EM POLICIES → STABLE (CRÍTICO)
-- =========================================================

ALTER FUNCTION public.current_tenant_escola_id() STABLE;
ALTER FUNCTION public.is_super_admin() STABLE;
ALTER FUNCTION public.has_access_to_escola(uuid) STABLE;

ALTER FUNCTION public.is_escola_admin(uuid) STABLE;
ALTER FUNCTION public.is_escola_member(uuid) STABLE;

-- Obs: Essas funções NÃO podem ter SELECT interno.
-- Se alguma tiver, te aviso no erro do Codex.

-- =========================================================
-- 2) REMOVER POLICIES REDUNDANTES POR TABELA
-- (Mantemos apenas: SELECT tenant + SELECT super_admin)
-- =========================================================

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname NOT IN (
        'tenant_select',
        'super_admin_select'
      )
      AND tablename IN (
        'alunos','matriculas','turmas','mensalidades',
        'financeiro_lancamentos','frequencias_default',
        'cursos','avaliacoes','notas'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', rec.policyname, rec.tablename);
  END LOOP;
END$$;

-- =========================================================
-- 3) POLICIES OFICIAIS PADRONIZADAS (PERFORMÁTICAS)
-- =========================================================

-- 🔥 Recriar apenas SELECT tenant + super admin

-- Tabelas pesadas
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'alunos','matriculas','turmas','mensalidades',
    'financeiro_lancamentos','frequencias_default',
    'cursos','avaliacoes','notas'
  ])
  LOOP

    EXECUTE format('DROP POLICY IF EXISTS tenant_select ON public.%I;', t);
    EXECUTE format('
      CREATE POLICY tenant_select ON public.%I
      FOR SELECT TO authenticated
      USING (escola_id = public.current_tenant_escola_id());
    ', t);

    EXECUTE format('DROP POLICY IF EXISTS super_admin_select ON public.%I;', t);
    EXECUTE format('
      CREATE POLICY super_admin_select ON public.%I
      FOR SELECT TO authenticated
      USING (public.is_super_admin());
    ', t);

  END LOOP;
END$$;


-- =========================================================
-- 4) CRIAR ÍNDICES ALINHADOS (escola_id sempre primeiro)
-- =========================================================

-- Alunos
CREATE INDEX IF NOT EXISTS idx_alunos_escola_created
  ON public.alunos (escola_id, created_at, id);

-- Matriculas
CREATE INDEX IF NOT EXISTS idx_matriculas_escola_turma
  ON public.matriculas (escola_id, turma_id, id);

-- Turmas
CREATE INDEX IF NOT EXISTS idx_turmas_escola_nome
  ON public.turmas (escola_id, nome, id);

-- Mensalidades
CREATE INDEX IF NOT EXISTS idx_mensalidades_escola_venc
  ON public.mensalidades (escola_id, data_vencimento, id);

-- Lancamentos Financeiros
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_escola_created
  ON public.financeiro_lancamentos (escola_id, created_at, id);

-- Frequencias
CREATE INDEX IF NOT EXISTS idx_frequencias_escola_matricula_data
  ON public.frequencias_default (escola_id, matricula_id, data);

-- Avaliações / Notas
CREATE INDEX IF NOT EXISTS idx_notas_escola_avaliacao
  ON public.notas (escola_id, avaliacao_id);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_escola_turma_disciplina
  ON public.avaliacoes (escola_id, turma_disciplina_id, periodo_letivo_id);


-- =========================================================
-- 5) VALIDATORS (garante que as policies não viraram OR gigante)
-- =========================================================

-- 5.1 Verificar duplicações
DO $$
DECLARE
  checks int;
BEGIN
  SELECT COUNT(*) INTO checks
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN (
      'alunos','matriculas','turmas','mensalidades',
      'financeiro_lancamentos','frequencias_default',
      'cursos','avaliacoes','notas'
    )
    AND policyname NOT IN ('tenant_select','super_admin_select');

  IF checks > 0 THEN
    RAISE EXCEPTION 'Ainda existem policies redundantes (%). Limpeza incompleta.', checks;
  END IF;
END$$;

-- 5.2 Validar STABLE (evita seq scan)
DO $$
BEGIN
  PERFORM prokind
  FROM pg_proc WHERE proname = 'current_tenant_escola_id' AND provolatile <> 's';
  IF FOUND THEN RAISE EXCEPTION 'current_tenant_escola_id não STABLE. Corrija.'; END IF;
END$$;

COMMIT;
