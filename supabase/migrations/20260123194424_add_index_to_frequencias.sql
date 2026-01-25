begin;

-- ============================================================
-- P0.2 & P2.1 - Ajustes em frequencias
-- ============================================================

-- Adiciona um índice composto para consultas eficientes, começando com escola_id
CREATE INDEX IF NOT EXISTS idx_frequencias_escola_matricula_data
ON public.frequencias USING btree (escola_id, matricula_id, data);

-- Adiciona uma constraint UNIQUE para garantir que não haja duplicatas
-- no registro de frequência por aluno por dia, conforme P2.1.
-- Usamos 'data' em vez de 'aula_id' porque 'aula_id' é nullable.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_frequencias_escola_matricula_data'
    ) THEN
        ALTER TABLE public.frequencias
            ADD CONSTRAINT uq_frequencias_escola_matricula_data
            UNIQUE (escola_id, matricula_id, data);
    END IF;
END $$;

commit;
