-- SAFE-EXEC RLS SCRIPT (idempotent, faseado)
-- 1) Helper: current_tenant_escola_id()
CREATE OR REPLACE FUNCTION public.current_tenant_escola_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'escola_id')::uuid
$$;

-- Segurança: revoga execução pública e concede apenas a quem convém
REVOKE EXECUTE ON FUNCTION public.current_tenant_escola_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_escola_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_escola_id() TO service_role;


-- 2) Add coluna escola_id em notas_avaliacoes (não forçar NOT NULL aqui)
ALTER TABLE public.notas_avaliacoes
  ADD COLUMN IF NOT EXISTS escola_id uuid;

-- 3) Índices recomendados (idempotentes)
-- Índice para chamadas frequentes por turma+status
CREATE INDEX IF NOT EXISTS idx_matriculas_turma_status ON public.matriculas (turma_id, status);

-- Índice para notas_avaliacoes para joins/consultas por escola/matricula
CREATE INDEX IF NOT EXISTS idx_notas_avaliacoes_escola_matricula ON public.notas_avaliacoes (escola_id, matricula_id);

-- Índice para historico_anos usado na policy de historico_disciplinas
CREATE INDEX IF NOT EXISTS idx_historico_anos_escola_id_id ON public.historico_anos (escola_id, id);

-- Índice para aulas por turma_disciplina_id+data
CREATE INDEX IF NOT EXISTS idx_aulas_turma_disciplina_data ON public.aulas (turma_disciplina_id, data);


-- 4) Criar policies RLS por tabela (nomes únicos por tabela)
-- TURMA_DISCIPLINAS
DROP POLICY IF EXISTS tenant_select_turma_disciplinas ON public.turma_disciplinas;
CREATE POLICY tenant_select_turma_disciplinas ON public.turma_disciplinas
FOR SELECT TO authenticated
USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_insert_turma_disciplinas ON public.turma_disciplinas;
DROP POLICY IF EXISTS tenant_update_turma_disciplinas ON public.turma_disciplinas;
DROP POLICY IF EXISTS tenant_delete_turma_disciplinas ON public.turma_disciplinas;
CREATE POLICY tenant_insert_turma_disciplinas ON public.turma_disciplinas
FOR INSERT TO authenticated
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_update_turma_disciplinas ON public.turma_disciplinas
FOR UPDATE TO authenticated
USING (escola_id = public.current_tenant_escola_id())
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_delete_turma_disciplinas ON public.turma_disciplinas
FOR DELETE TO authenticated
USING (escola_id = public.current_tenant_escola_id());


-- AULAS
DROP POLICY IF EXISTS tenant_select_aulas ON public.aulas;
CREATE POLICY tenant_select_aulas ON public.aulas
FOR SELECT TO authenticated
USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_insert_aulas ON public.aulas;
DROP POLICY IF EXISTS tenant_update_aulas ON public.aulas;
DROP POLICY IF EXISTS tenant_delete_aulas ON public.aulas;
CREATE POLICY tenant_insert_aulas ON public.aulas
FOR INSERT TO authenticated
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_update_aulas ON public.aulas
FOR UPDATE TO authenticated
USING (escola_id = public.current_tenant_escola_id())
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_delete_aulas ON public.aulas
FOR DELETE TO authenticated
USING (escola_id = public.current_tenant_escola_id());


-- NOTAS_AVALIACOES
DROP POLICY IF EXISTS tenant_select_notas_avaliacoes ON public.notas_avaliacoes;
CREATE POLICY tenant_select_notas_avaliacoes ON public.notas_avaliacoes
FOR SELECT TO authenticated
USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_insert_notas_avaliacoes ON public.notas_avaliacoes;
DROP POLICY IF EXISTS tenant_update_notas_avaliacoes ON public.notas_avaliacoes;
DROP POLICY IF EXISTS tenant_delete_notas_avaliacoes ON public.notas_avaliacoes;
CREATE POLICY tenant_insert_notas_avaliacoes ON public.notas_avaliacoes
FOR INSERT TO authenticated
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_update_notas_avaliacoes ON public.notas_avaliacoes
FOR UPDATE TO authenticated
USING (escola_id = public.current_tenant_escola_id())
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_delete_notas_avaliacoes ON public.notas_avaliacoes
FOR DELETE TO authenticated
USING (escola_id = public.current_tenant_escola_id());


-- FINANCEIRO_CONTRATOS
DROP POLICY IF EXISTS tenant_select_financeiro_contratos ON public.financeiro_contratos;
CREATE POLICY tenant_select_financeiro_contratos ON public.financeiro_contratos
FOR SELECT TO authenticated
USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_insert_financeiro_contratos ON public.financeiro_contratos;
DROP POLICY IF EXISTS tenant_update_financeiro_contratos ON public.financeiro_contratos;
DROP POLICY IF EXISTS tenant_delete_financeiro_contratos ON public.financeiro_contratos;
CREATE POLICY tenant_insert_financeiro_contratos ON public.financeiro_contratos
FOR INSERT TO authenticated
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_update_financeiro_contratos ON public.financeiro_contratos
FOR UPDATE TO authenticated
USING (escola_id = public.current_tenant_escola_id())
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_delete_financeiro_contratos ON public.financeiro_contratos
FOR DELETE TO authenticated
USING (escola_id = public.current_tenant_escola_id());


-- FINANCEIRO_TITULOS
DROP POLICY IF EXISTS tenant_select_financeiro_titulos ON public.financeiro_titulos;
CREATE POLICY tenant_select_financeiro_titulos ON public.financeiro_titulos
FOR SELECT TO authenticated
USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_insert_financeiro_titulos ON public.financeiro_titulos;
DROP POLICY IF EXISTS tenant_update_financeiro_titulos ON public.financeiro_titulos;
DROP POLICY IF EXISTS tenant_delete_financeiro_titulos ON public.financeiro_titulos;
CREATE POLICY tenant_insert_financeiro_titulos ON public.financeiro_titulos
FOR INSERT TO authenticated
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_update_financeiro_titulos ON public.financeiro_titulos
FOR UPDATE TO authenticated
USING (escola_id = public.current_tenant_escola_id())
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_delete_financeiro_titulos ON public.financeiro_titulos
FOR DELETE TO authenticated
USING (escola_id = public.current_tenant_escola_id());


-- HISTORICO_ANOS
DROP POLICY IF EXISTS tenant_select_historico_anos ON public.historico_anos;
CREATE POLICY tenant_select_historico_anos ON public.historico_anos
FOR SELECT TO authenticated
USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_insert_historico_anos ON public.historico_anos;
DROP POLICY IF EXISTS tenant_update_historico_anos ON public.historico_anos;
DROP POLICY IF EXISTS tenant_delete_historico_anos ON public.historico_anos;
CREATE POLICY tenant_insert_historico_anos ON public.historico_anos
FOR INSERT TO authenticated
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_update_historico_anos ON public.historico_anos
FOR UPDATE TO authenticated
USING (escola_id = public.current_tenant_escola_id())
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY tenant_delete_historico_anos ON public.historico_anos
FOR DELETE TO authenticated
USING (escola_id = public.current_tenant_escola_id());


-- HISTORICO_DISCIPLINAS (via parent)
DROP POLICY IF EXISTS tenant_select_historico_disciplinas ON public.historico_disciplinas;
CREATE POLICY tenant_select_historico_disciplinas ON public.historico_disciplinas
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.historico_anos ha
    WHERE ha.id = historico_ano_id
      AND ha.escola_id = public.current_tenant_escola_id()
  )
);

DROP POLICY IF EXISTS tenant_insert_historico_disciplinas ON public.historico_disciplinas;
DROP POLICY IF EXISTS tenant_update_historico_disciplinas ON public.historico_disciplinas;
DROP POLICY IF EXISTS tenant_delete_historico_disciplinas ON public.historico_disciplinas;
CREATE POLICY tenant_insert_historico_disciplinas ON public.historico_disciplinas
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.historico_anos ha
    WHERE ha.id = historico_ano_id
      AND ha.escola_id = public.current_tenant_escola_id()
  )
);

CREATE POLICY tenant_update_historico_disciplinas ON public.historico_disciplinas
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.historico_anos ha
    WHERE ha.id = historico_ano_id
      AND ha.escola_id = public.current_tenant_escola_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.historico_anos ha
    WHERE ha.id = historico_ano_id
      AND ha.escola_id = public.current_tenant_escola_id()
  )
);

CREATE POLICY tenant_delete_historico_disciplinas ON public.historico_disciplinas
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.historico_anos ha
    WHERE ha.id = historico_ano_id
      AND ha.escola_id = public.current_tenant_escola_id()
  )
);


CREATE TABLE IF NOT EXISTS public.matricula_counters (
    escola_id uuid PRIMARY KEY REFERENCES public.escolas(id),
    last_value bigint NOT NULL DEFAULT 0,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.matricula_counters ENABLE ROW LEVEL SECURITY;


-- MATRICULA_COUNTERS: negar acesso ao cliente (usar service role)
DROP POLICY IF EXISTS deny_all_matricula_counters ON public.matricula_counters;
CREATE POLICY deny_all_matricula_counters ON public.matricula_counters
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);


-- PROFILES_ARCHIVE (leitura apenas para self / roles específicos)
DROP POLICY IF EXISTS profiles_archive_read ON public.profiles_archive;
CREATE POLICY profiles_archive_read ON public.profiles_archive
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND (auth.jwt() ->> 'role') IN ('admin_escola','secretaria','financeiro','super_admin')
  )
);

DROP POLICY IF EXISTS profiles_archive_insert ON public.profiles_archive;
DROP POLICY IF EXISTS profiles_archive_update ON public.profiles_archive;
DROP POLICY IF EXISTS profiles_archive_delete ON public.profiles_archive;
CREATE POLICY profiles_archive_insert ON public.profiles_archive
FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY profiles_archive_update ON public.profiles_archive
FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY profiles_archive_delete ON public.profiles_archive
FOR DELETE TO authenticated
USING (false);


-- 5) Backfill controlado para notas_avaliacoes.escola_id
DO $$
DECLARE 
  rows_updated int;
BEGIN
  LOOP
    WITH cte AS (
      SELECT n.id, m.escola_id
      FROM public.notas_avaliacoes n
      JOIN public.matriculas m ON m.id = n.matricula_id
      WHERE n.escola_id IS NULL
      LIMIT 1000 -- Batch size
      FOR UPDATE SKIP LOCKED -- Evita travar a tabela para outros users
    )
    UPDATE public.notas_avaliacoes na
    SET escola_id = cte.escola_id
    FROM cte
    WHERE na.id = cte.id;

    -- Verifica quantas linhas foram afetadas
    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    -- Se não atualizou nada, acabou
    IF rows_updated = 0 THEN
      EXIT;
    END IF;

    -- Opcional: commit parcial se estiveres a rodar fora de uma transação única, 
    -- mas dentro de um bloco DO o Postgres gere isso. 
    -- pg_sleep(0.01) para aliviar CPU se necessário.
  END LOOP;
END $$;


-- 6) Verifica se ainda há NULLs; se não houver, seta NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.notas_avaliacoes WHERE escola_id IS NULL) THEN
    RAISE NOTICE 'Backfill incompleto: notas_avaliacoes.escola_id ainda tem NULL. Resolve manualmente antes de setar NOT NULL.';
  ELSE
    ALTER TABLE public.notas_avaliacoes ALTER COLUMN escola_id SET NOT NULL;
    RAISE NOTICE 'Coluna notas_avaliacoes.escola_id agora definida como NOT NULL.';
  END IF;
END $$;


-- 7) Habilitar RLS nas tabelas (sem FORCE). Aplicar FORCE manualmente após validações.
ALTER TABLE IF EXISTS public.turma_disciplinas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notas_avaliacoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.aulas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financeiro_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financeiro_titulos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.historico_anos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.historico_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles_archive     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.matricula_counters   ENABLE ROW LEVEL SECURITY;

-- NOTA: se quiseres aplicar FORCE ROW LEVEL SECURITY, faço via comando separado após testes:
-- ALTER TABLE public.turma_disciplinas FORCE ROW LEVEL SECURITY;


-- 8) Ajuste de views (idempotente)
ALTER VIEW IF EXISTS public.vw_cursos_reais          SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vw_turmas_para_matricula SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vw_medias_por_disciplina SET (security_invoker = true);
