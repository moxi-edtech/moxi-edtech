begin;

-- ============================================================
-- P1.1 - Ajustes em periodos_letivos
-- ============================================================

-- Adiciona a coluna trava_notas_em se não existir
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS trava_notas_em timestamp with time zone;

-- Drop da constraint UNIQUE antiga (sem escola_id) se existir
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'periodos_letivos_ano_letivo_id_tipo_numero_key') THEN
        ALTER TABLE public.periodos_letivos DROP CONSTRAINT periodos_letivos_ano_letivo_id_tipo_numero_key;
    END IF;
END $$;

-- Adiciona a nova constraint UNIQUE incluindo escola_id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'periodos_letivos_escola_ano_tipo_numero_uk'
    ) THEN
        ALTER TABLE public.periodos_letivos
            ADD CONSTRAINT periodos_letivos_escola_ano_tipo_numero_uk
            UNIQUE (escola_id, ano_letivo_id, tipo, numero);
    END IF;
END $$;


-- ============================================================
-- P2.2 - Ajustes em avaliacoes
-- ============================================================

-- Altera colunas para NOT NULL
ALTER TABLE public.avaliacoes ALTER COLUMN ano_letivo SET NOT NULL;
ALTER TABLE public.avaliacoes ALTER COLUMN trimestre SET NOT NULL;
ALTER TABLE public.avaliacoes ALTER COLUMN tipo SET NOT NULL;

-- Adiciona a constraint UNIQUE necessária
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'avaliacoes_escola_turma_ano_trimestre_tipo_uk'
    ) THEN
        ALTER TABLE public.avaliacoes
            ADD CONSTRAINT avaliacoes_escola_turma_ano_trimestre_tipo_uk
            UNIQUE (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo);
    END IF;
END $$;

-- Atualiza políticas RLS para avaliacoes (adiciona verificação de role)
DROP POLICY IF EXISTS avaliacoes_insert ON public.avaliacoes;
CREATE POLICY avaliacoes_insert
ON public.avaliacoes
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
);

DROP POLICY IF EXISTS avaliacoes_update ON public.avaliacoes;
CREATE POLICY avaliacoes_update
ON public.avaliacoes
FOR UPDATE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
);

DROP POLICY IF EXISTS avaliacoes_delete ON public.avaliacoes;
CREATE POLICY avaliacoes_delete
ON public.avaliacoes
FOR DELETE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
);


-- ============================================================
-- P2.2 - Ajustes em notas
-- ============================================================

-- Drop da constraint UNIQUE antiga (sem escola_id) se existir
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_avaliacao_id_matricula_id_key') THEN
        ALTER TABLE public.notas DROP CONSTRAINT notas_avaliacao_id_matricula_id_key;
    END IF;
END $$;

-- Adiciona a nova constraint UNIQUE incluindo escola_id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'notas_escola_matricula_avaliacao_uk'
    ) THEN
        ALTER TABLE public.notas
            ADD CONSTRAINT notas_escola_matricula_avaliacao_uk
            UNIQUE (escola_id, matricula_id, avaliacao_id);
    END IF;
END $$;

-- Atualiza políticas RLS para notas (adiciona verificação de role)
DROP POLICY IF EXISTS notas_insert ON public.notas;
CREATE POLICY notas_insert
ON public.notas
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
);

DROP POLICY IF EXISTS notas_update ON public.notas;
CREATE POLICY notas_update
ON public.notas
FOR UPDATE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
);

DROP POLICY IF EXISTS notas_delete ON public.notas;
CREATE POLICY notas_delete
ON public.notas
FOR DELETE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
);

commit;
