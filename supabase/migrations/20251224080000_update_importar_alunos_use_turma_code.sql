BEGIN;

-- Atualiza a função importar_alunos para usar create_or_get_turma_by_code

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
      v_clean_turma_codigo := upper(regexp_replace(COALESCE(r.turma_codigo, ''), '\\s+', '', 'g'));
      v_had_turma := (r.turma_codigo IS NOT NULL AND r.turma_codigo <> '');

      IF v_clean_telefone = '' OR v_clean_telefone IS NULL THEN
        RAISE EXCEPTION 'Telefone inválido';
      END IF;

      -- Upsert Aluno
      INSERT INTO public.alunos (
        escola_id, numero_processo, nome, nome_completo, bi_numero, nif,
        encarregado_nome, encarregado_telefone, encarregado_email
      )
      VALUES (
        p_escola_id, r.numero_processo, v_clean_nome, v_clean_nome,
        upper(trim(r.bi_numero)), upper(trim(COALESCE(r.nif, r.bi_numero))),
        public.initcap_angola(r.encarregado_nome), v_clean_telefone, lower(trim(r.encarregado_email))
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome = EXCLUDED.nome,
        nome_completo = EXCLUDED.nome_completo,
        bi_numero = EXCLUDED.bi_numero,
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = EXCLUDED.encarregado_telefone,
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      IF v_had_turma THEN
        -- Detecta se já existia turma
        SELECT true INTO v_turma_exists
        FROM public.turmas
        WHERE escola_id = p_escola_id
          AND ano_letivo = p_ano_letivo
          AND turma_code = v_clean_turma_codigo
        LIMIT 1;

        -- Cria ou obtém turma via código (usa course_code da escola)
        PERFORM 1;
        SELECT id INTO v_turma_id FROM public.create_or_get_turma_by_code(p_escola_id, p_ano_letivo, r.turma_codigo);

        IF NOT v_turma_exists THEN
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
