-- Torna profile_id opcional na importação de alunos
CREATE OR REPLACE FUNCTION public.importar_alunos(p_import_id uuid, p_escola_id uuid)
RETURNS TABLE(imported integer, skipped integer, errors integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_imported integer := 0;
  v_skipped  integer := 0;
  v_errors   integer := 0;
  v_rec      public.staging_alunos%ROWTYPE;
BEGIN
  -- Garante que a import existe e pertence à escola
  PERFORM 1
  FROM public.import_migrations m
  WHERE m.id = p_import_id
    AND m.escola_id = p_escola_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import % para escola % não encontrada', p_import_id, p_escola_id;
  END IF;

  -- Limpa erros anteriores (permite reprocessar)
  DELETE FROM public.import_errors e
   WHERE e.import_id = p_import_id;

  FOR v_rec IN
    SELECT *
      FROM public.staging_alunos
     WHERE import_id = p_import_id
  LOOP
    -- Regra mínima: precisa ter pelo menos NOME e BI
    IF v_rec.nome IS NULL OR v_rec.bi IS NULL THEN
      v_errors := v_errors + 1;
      INSERT INTO public.import_errors(import_id, row_number, column_name, message, raw_value)
      VALUES (
        p_import_id,
        v_rec.id::int,
        'nome/bi',
        'Nome e BI são obrigatórios para importar aluno sem profile_id',
        row_to_json(v_rec)::text
      );
      CONTINUE;
    END IF;

    BEGIN
      -- Usa BI como chave natural (já temos UNIQUE INDEX em alunos(bi_numero))
      INSERT INTO public.alunos (
        id,
        escola_id,
        profile_id,         -- pode ser NULL
        data_nascimento,
        nome,
        bi_numero,
        email,
        telefone,
        import_id
      )
      VALUES (
        gen_random_uuid(),
        p_escola_id,
        v_rec.profile_id,   -- geralmente NULL na importação de alunos
        v_rec.data_nascimento,
        v_rec.nome,
        v_rec.bi,
        v_rec.email,
        v_rec.telefone,
        p_import_id
      )
      ON CONFLICT (bi_numero) DO UPDATE
        SET nome           = EXCLUDED.nome,
            data_nascimento= COALESCE(EXCLUDED.data_nascimento, public.alunos.data_nascimento),
            email          = COALESCE(EXCLUDED.email, public.alunos.email),
            telefone       = COALESCE(EXCLUDED.telefone, public.alunos.telefone),
            import_id      = EXCLUDED.import_id;

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

  v_skipped := (SELECT COUNT(*) FROM public.staging_alunos WHERE import_id = p_import_id)
               - v_imported - v_errors;

  UPDATE public.import_migrations
     SET status       = 'imported',
         processed_at = now(),
         imported_rows= v_imported,
         error_rows   = v_errors
   WHERE id = p_import_id;

  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$;