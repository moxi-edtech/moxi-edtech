-- Migration: map common course siglas to curriculum presets in importar_alunos

CREATE OR REPLACE FUNCTION public.importar_alunos(
  p_import_id uuid,
  p_escola_id uuid,
  p_ano_letivo int
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_curso_id uuid;
  
  v_total_imported int := 0;
  v_total_errors int := 0;
  v_turmas_created int := 0;
  v_cursos_created int := 0;
  
  v_clean_nome text;
  v_clean_telefone text;
  v_clean_aluno_telefone text;
  v_clean_turma_codigo text;
  v_clean_curso_codigo text;
  v_curso_codigo_mapeado text;
  v_clean_responsavel text;
  v_clean_nif text;
  v_clean_email text;
  v_clean_data_nascimento date;
  v_clean_sexo text;

  v_user_role text;
  v_new_curso_status text;
BEGIN
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role' INTO v_user_role;
  IF v_user_role = 'admin' OR v_user_role = 'super_admin' THEN
    v_new_curso_status := 'aprovado';
  ELSE
    v_new_curso_status := 'pendente';
  END IF;

  FOR r IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    BEGIN
      v_clean_nome := public.initcap_angola(r.nome);
      v_clean_responsavel := public.initcap_angola(r.encarregado_nome);
      v_clean_telefone := regexp_replace(r.encarregado_telefone, '[^0-9+]', '', 'g');
      v_clean_aluno_telefone := regexp_replace(r.telefone, '[^0-9+]', '', 'g');
      v_clean_turma_codigo := upper(regexp_replace(r.turma_codigo, '[^a-zA-Z0-9]', '', 'g'));
      v_clean_curso_codigo := upper(regexp_replace(r.curso_codigo, '[^a-zA-Z0-9]', '', 'g'));

      -- Map common Excel siglas to official curriculum presets
      v_curso_codigo_mapeado := coalesce(v_clean_curso_codigo, '');
      IF v_curso_codigo_mapeado <> '' THEN
        v_curso_codigo_mapeado := CASE v_curso_codigo_mapeado
          WHEN 'TI' THEN 'tecnico_informatica'
          WHEN 'INF' THEN 'tecnico_informatica'
          WHEN 'INFORMATICA' THEN 'tecnico_informatica'
          WHEN 'TINF' THEN 'tecnico_informatica'
          WHEN 'TG' THEN 'tecnico_gestao'
          WHEN 'GESTAO' THEN 'tecnico_gestao'
          WHEN 'TECGEST' THEN 'tecnico_gestao'
          WHEN 'EP' THEN 'primario_base'
          WHEN 'EPB' THEN 'primario_base'
          WHEN 'EPU' THEN 'primario_base'
          WHEN 'EB' THEN 'primario_base'
          WHEN 'CFB' THEN 'puniv'
          WHEN 'PUNIV' THEN 'puniv'
          ELSE v_curso_codigo_mapeado
        END;
      END IF;

      v_clean_nif := NULLIF(upper(trim(r.nif)), '');
      v_clean_email := lower(NULLIF(trim(r.email), ''));
      v_clean_data_nascimento := NULLIF(r.data_nascimento, '')::date;
      v_clean_sexo := UPPER(NULLIF(trim(r.sexo), ''));

      IF v_clean_telefone IS NULL OR v_clean_telefone = '' THEN 
         RAISE EXCEPTION 'Telefone do encarregado é inválido ou vazio.'; 
      END IF;
      
      IF v_clean_turma_codigo IS NULL OR v_clean_turma_codigo = '' THEN
        RAISE EXCEPTION 'O código da turma é obrigatório.';
      END IF;

      INSERT INTO public.alunos (
        escola_id, numero_processo, nome, nome_completo, data_nascimento, sexo,
        telefone, bi_numero, nif, email,
        encarregado_nome, encarregado_telefone, encarregado_email,
        responsavel, responsavel_nome, responsavel_contato, telefone_responsavel,
        status, import_id
      )
      VALUES (
        p_escola_id, r.numero_processo, v_clean_nome, v_clean_nome, v_clean_data_nascimento, v_clean_sexo,
        NULLIF(v_clean_aluno_telefone, ''), upper(trim(r.bi_numero)), v_clean_nif, v_clean_email,
        v_clean_responsavel,
        v_clean_telefone,
        lower(trim(r.encarregado_email)),
        v_clean_responsavel, v_clean_responsavel, v_clean_telefone, v_clean_telefone,
        'ativo', p_import_id
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome = EXCLUDED.nome,
        nome_completo = EXCLUDED.nome_completo,
        data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.alunos.data_nascimento),
        sexo = COALESCE(EXCLUDED.sexo, public.alunos.sexo),
        telefone = COALESCE(EXCLUDED.telefone, public.alunos.telefone),
        bi_numero = EXCLUDED.bi_numero,
        nif = COALESCE(EXCLUDED.nif, public.alunos.nif),
        email = COALESCE(EXCLUDED.email, public.alunos.email),
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = COALESCE(EXCLUDED.encarregado_telefone, public.alunos.encarregado_telefone),
        encarregado_email = COALESCE(EXCLUDED.encarregado_email, public.alunos.encarregado_email),
        responsavel = COALESCE(EXCLUDED.responsavel, public.alunos.responsavel),
        responsavel_nome = COALESCE(EXCLUDED.responsavel_nome, public.alunos.responsavel_nome),
        responsavel_contato = COALESCE(EXCLUDED.responsavel_contato, public.alunos.responsavel_contato),
        telefone_responsavel = COALESCE(EXCLUDED.telefone_responsavel, public.alunos.telefone_responsavel),
        status = COALESCE(EXCLUDED.status, public.alunos.status),
        import_id = COALESCE(EXCLUDED.import_id, public.alunos.import_id),
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      v_curso_id := NULL;
      IF v_curso_codigo_mapeado IS NOT NULL AND v_curso_codigo_mapeado <> '' THEN
        SELECT id INTO v_curso_id FROM public.cursos
        WHERE escola_id = p_escola_id
          AND upper(regexp_replace(codigo, '[^a-zA-Z0-9]', '', 'g')) = v_curso_codigo_mapeado;

        IF v_curso_id IS NULL THEN
          INSERT INTO public.cursos (escola_id, nome, codigo, status_aprovacao, import_id)
          VALUES (
            p_escola_id,
            'Curso ' || v_curso_codigo_mapeado,
            v_curso_codigo_mapeado,
            v_new_curso_status,
            p_import_id
          )
          RETURNING id INTO v_curso_id;
          v_cursos_created := v_cursos_created + 1;
        END IF;
      END IF;

      v_turma_id := NULL;
      SELECT id INTO v_turma_id FROM public.turmas 
      WHERE escola_id = p_escola_id 
        AND ano_letivo = p_ano_letivo
        AND upper(regexp_replace(turma_codigo, '[^a-zA-Z0-9]', '', 'g')) = v_clean_turma_codigo;

      IF v_turma_id IS NULL THEN
        INSERT INTO public.turmas (
          escola_id, ano_letivo, turma_codigo, nome, 
          status_validacao, curso_id, import_id
        )
        VALUES (
          p_escola_id, p_ano_letivo, r.turma_codigo, 
          r.turma_codigo || ' (Imp. Auto)', 'rascunho', 
          v_curso_id,
          p_import_id
        )
        RETURNING id INTO v_turma_id;
        
        v_turmas_created := v_turmas_created + 1;
      END IF;

      INSERT INTO public.matriculas (
        escola_id, aluno_id, turma_id, ano_letivo, status, ativo, 
        numero_matricula, data_matricula
      )
      VALUES (
        p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, 'ativo', true,
        (SELECT numero_processo FROM public.alunos WHERE id = v_aluno_id) || '/' || p_ano_letivo, now()
      )
      ON CONFLICT (escola_id, aluno_id, ano_letivo) DO NOTHING;

      v_total_imported := v_total_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_errors (import_id, row_number, message, raw_value)
      VALUES (p_import_id, r.row_number, SQLERRM, r.nome);
      v_total_errors := v_total_errors + 1;
    END;
  END LOOP;

  RETURN json_build_object(
    'imported', v_total_imported, 
    'errors', v_total_errors, 
    'turmas_created', v_turmas_created,
    'cursos_created', v_cursos_created
  );
END;
$$;

