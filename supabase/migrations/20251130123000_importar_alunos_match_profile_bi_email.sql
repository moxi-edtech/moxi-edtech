-- Re-implementa importar_alunos com matching por profile_id -> BI -> email
-- Sem depender de UNIQUE(email); faz SELECT/UPDATE/INSERT procedural

CREATE OR REPLACE FUNCTION public.importar_alunos(p_import_id uuid, p_escola_id uuid)
RETURNS TABLE(imported integer, skipped integer, errors integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_imported integer := 0;
  v_skipped  integer := 0;
  v_errors   integer := 0;
  v_rec      public.staging_alunos%ROWTYPE;
  v_aluno_id uuid;
  v_target_profile_id uuid;
BEGIN
  -- Confere existência do registro de importação
  PERFORM 1 FROM public.import_migrations m WHERE m.id = p_import_id AND m.escola_id = p_escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import % para escola % não encontrada', p_import_id, p_escola_id;
  END IF;

  -- Permite reprocessar o mesmo import limpando erros anteriores
  DELETE FROM public.import_errors WHERE import_id = p_import_id;

  FOR v_rec IN
    SELECT * FROM public.staging_alunos WHERE import_id = p_import_id
  LOOP
    -- Regras mínimas: precisa ao menos nome OU bi/email para criar
    IF v_rec.nome IS NULL AND v_rec.bi IS NULL AND v_rec.email IS NULL THEN
      v_errors := v_errors + 1;
      INSERT INTO public.import_errors(import_id, row_number, column_name, message, raw_value)
      VALUES (
        p_import_id,
        v_rec.id::int,
        'nome/bi/email',
        'Não há dados suficientes para criar/atualizar aluno (informe ao menos nome e BI ou email)',
        row_to_json(v_rec)::text
      );
      CONTINUE;
    END IF;

    BEGIN
      v_aluno_id := NULL;
      v_target_profile_id := NULL;

      -- 1) Tenta por profile_id
      IF v_rec.profile_id IS NOT NULL THEN
        SELECT a.id INTO v_aluno_id
        FROM public.alunos a
        WHERE a.escola_id = p_escola_id AND a.profile_id = v_rec.profile_id
        LIMIT 1;
      END IF;

      -- 2) Senão, por BI
      IF v_aluno_id IS NULL AND v_rec.bi IS NOT NULL THEN
        SELECT a.id INTO v_aluno_id
        FROM public.alunos a
        WHERE a.escola_id = p_escola_id AND a.bi_numero = v_rec.bi
        LIMIT 1;
      END IF;

      -- 3) Senão, por email
      IF v_aluno_id IS NULL AND v_rec.email IS NOT NULL THEN
        SELECT a.id INTO v_aluno_id
        FROM public.alunos a
        WHERE a.escola_id = p_escola_id AND a.email = v_rec.email
        LIMIT 1;
      END IF;

      IF v_aluno_id IS NULL THEN
        -- Inserir novo
        INSERT INTO public.alunos (
          id, escola_id, profile_id, data_nascimento, nome, bi_numero, email, telefone, import_id
        ) VALUES (
          gen_random_uuid(),
          p_escola_id,
          v_rec.profile_id,
          v_rec.data_nascimento,
          v_rec.nome,
          v_rec.bi,
          v_rec.email,
          v_rec.telefone,
          p_import_id
        );
        v_target_profile_id := v_rec.profile_id; -- pode ser NULL
      ELSE
        -- Atualizar existente (preenche apenas se vier valor; não sobrescreve com NULL)
        UPDATE public.alunos a SET
          nome            = COALESCE(v_rec.nome, a.nome),
          data_nascimento = COALESCE(v_rec.data_nascimento, a.data_nascimento),
          bi_numero       = COALESCE(v_rec.bi, a.bi_numero),
          email           = COALESCE(v_rec.email, a.email),
          telefone        = COALESCE(v_rec.telefone, a.telefone),
          profile_id      = COALESCE(a.profile_id, v_rec.profile_id),  -- só preenche se estava NULL
          import_id       = p_import_id
        WHERE a.id = v_aluno_id;
        SELECT a.profile_id INTO v_target_profile_id FROM public.alunos a WHERE a.id = v_aluno_id;
      END IF;

      -- Sincroniza email para profiles quando houver profile_id e email no staging
      IF v_rec.email IS NOT NULL AND v_target_profile_id IS NOT NULL THEN
        UPDATE public.profiles p
           SET email = v_rec.email
         WHERE p.user_id = v_target_profile_id
           AND COALESCE(btrim(p.email), '') = '';
      END IF;

      v_imported := v_imported + 1;

    EXCEPTION
      WHEN others THEN
        v_errors := v_errors + 1;
        INSERT INTO public.import_errors(import_id, row_number, column_name, message, raw_value)
        VALUES (
          p_import_id,
          v_rec.id::int,
          'alunos',
          SQLERRM,
          row_to_json(v_rec)::text
        );
    END;
  END LOOP;

  v_skipped := (SELECT COUNT(*) FROM public.staging_alunos WHERE import_id = p_import_id) - v_imported - v_errors;

  UPDATE public.import_migrations
     SET status       = 'imported',
         processed_at = now(),
         imported_rows= v_imported,
         error_rows   = v_errors
   WHERE id = p_import_id;

  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$;
