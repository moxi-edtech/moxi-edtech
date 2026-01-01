BEGIN;

-- 1. Drop view dependent on 'ano_letivo'
DROP VIEW IF EXISTS public.vw_turmas_para_matricula;

-- 2. Normalize 'ano_letivo' type in 'turmas' table to INTEGER
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'turmas'
      AND column_name = 'ano_letivo'
      AND data_type = 'text'
  ) THEN
    -- Clean non-numeric values before conversion
    UPDATE public.turmas
    SET ano_letivo = NULLIF(regexp_replace(ano_letivo, '[^0-9]', '', 'g'), '')
    WHERE ano_letivo IS NOT NULL;

    -- Alter column type to integer
    ALTER TABLE public.turmas
      ALTER COLUMN ano_letivo TYPE integer
      USING NULLIF(regexp_replace(ano_letivo, '[^0-9]', '', 'g'), '')::integer;
  END IF;
END$$;

-- 3. Recreate the view with the corrected column type
CREATE OR REPLACE VIEW public.vw_turmas_para_matricula AS
WITH base AS (
  SELECT
    t.id,
    t.escola_id,
    t.session_id,
    t.nome AS turma_nome,
    t.turno,
    t.capacidade_maxima,
    t.sala,
    t.classe_id,
    t.curso_id AS turma_curso_id,
    t.ano_letivo,
    COALESCE(co.curso_id, cl.curso_id, t.curso_id) AS curso_id_resolved,
    cl.nome AS classe_nome
  FROM turmas t
  LEFT JOIN classes cl ON t.classe_id = cl.id
  LEFT JOIN cursos_oferta co ON co.turma_id = t.id
)
SELECT
  b.id,
  b.escola_id,
  b.session_id,
  b.turma_nome,
  b.turno,
  b.capacidade_maxima,
  b.sala,
  COALESCE(b.classe_nome, 'Classe não definida') AS classe_nome,
  COALESCE(c.nome, 'Ensino Geral') AS curso_nome,
  COALESCE(c.tipo, 'geral') AS curso_tipo,
  COALESCE(c.is_custom, false) AS curso_is_custom,
  cgc.hash AS curso_global_hash,
  b.classe_id,
  b.curso_id_resolved AS curso_id,
  b.ano_letivo,
  (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = b.id AND m.status IN ('ativa','ativo')) AS ocupacao_atual,
  (SELECT MAX(created_at) FROM matriculas m WHERE m.turma_id = b.id) AS ultima_matricula
FROM base b
LEFT JOIN cursos c ON b.curso_id_resolved = c.id
LEFT JOIN cursos_globais_cache cgc ON c.curso_global_id = cgc.hash;

-- 4. Grant permissions on the recreated view
GRANT SELECT ON public.vw_turmas_para_matricula TO anon, authenticated, service_role;

-- 5. Adjust 'importar_alunos' function to avoid type comparison errors
CREATE OR REPLACE FUNCTION public.importar_alunos(
  p_import_id uuid,
  p_escola_id uuid,
  p_ano_letivo int
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_total_imported int := 0;
  v_total_errors int := 0;
  v_turmas_created int := 0;

  v_clean_nome text;
  v_clean_telefone text;
  v_clean_turma_codigo text;
  v_had_turma boolean;
  v_turma_exists boolean;
BEGIN
  FOR r IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    BEGIN
      v_clean_nome := public.initcap_angola(r.nome);
      v_clean_telefone := regexp_replace(r.encarregado_telefone, '[^0-9+]', '', 'g');
      v_clean_turma_codigo := upper(regexp_replace(COALESCE(r.turma_codigo, ''), '\s+', '', 'g'));
      v_had_turma := (r.turma_codigo IS NOT NULL AND r.turma_codigo <> '');

      IF v_clean_telefone = '' OR v_clean_telefone IS NULL THEN
        RAISE EXCEPTION 'Telefone inválido';
      END IF;

      -- Upsert Aluno
      INSERT INTO public.alunos (
        escola_id, numero_processo, nome, bi_numero, nif,
        encarregado_nome, encarregado_telefone, encarregado_email
      )
      VALUES (
        p_escola_id, r.numero_processo, v_clean_nome,
        upper(trim(r.bi_numero)), upper(trim(COALESCE(r.nif, r.bi_numero))),
        public.initcap_angola(r.encarregado_nome), v_clean_telefone, lower(trim(r.encarregado_email))
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome = EXCLUDED.nome,
        bi_numero = EXCLUDED.bi_numero,
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = EXCLUDED.encarregado_telefone,
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      IF v_had_turma THEN
        -- Check if turma existed before creation attempt
        SELECT EXISTS(
          SELECT 1
          FROM public.turmas
          WHERE escola_id = p_escola_id
            AND ano_letivo = p_ano_letivo
            AND turma_code = v_clean_turma_codigo
        ) INTO v_turma_exists;

        -- Create or get turma by code
        SELECT id INTO v_turma_id FROM public.create_or_get_turma_by_code(p_escola_id, p_ano_letivo, r.turma_codigo);

        IF NOT v_turma_exists AND v_turma_id IS NOT NULL THEN
          v_turmas_created := v_turmas_created + 1;
        END IF;

        INSERT INTO public.matriculas (
          escola_id, aluno_id, turma_id, ano_letivo, status, ativo,
          numero_matricula, data_matricula
        ) VALUES (
          p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, 'ativo', true,
          (SELECT numero_processo FROM public.alunos WHERE id = v_aluno_id) || '/' || p_ano_letivo, now()
        ) ON CONFLICT (escola_id, aluno_id, ano_letivo) DO NOTHING;
      END IF;

      v_total_imported := v_total_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_errors (import_id, row_number, message, raw_value)
      VALUES (p_import_id, r.row_number, SQLERRM, COALESCE(r.numero_processo, r.nome));
      v_total_errors := v_total_errors + 1;
    END;
  END LOOP;

  RETURN json_build_object('imported', v_total_imported, 'errors', v_total_errors, 'turmas_created', v_turmas_created);
END;
$$;

COMMIT;