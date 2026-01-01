BEGIN;

-- Alinha staging com Template v2.0 (gênero) e adiciona função de importação direta via JSON

ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS sexo text;

-- Nova função: recebe alunos em JSON, injeta ano_letivo (contexto) e cria alunos + matrículas
CREATE OR REPLACE FUNCTION public.importar_alunos_v2(
  p_escola_id uuid,
  p_ano_letivo int,
  p_alunos jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
  v_turma_id uuid;
  v_aluno_id uuid;
  v_total_sucesso int := 0;
  v_total_erros int := 0;
  v_erros text[] := ARRAY[]::text[];
  v_clean_turma text;
  v_clean_sexo text;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'escola_id é obrigatório' USING ERRCODE = '22023';
  END IF;
  IF p_ano_letivo IS NULL THEN
    RAISE EXCEPTION 'ano_letivo é obrigatório' USING ERRCODE = '22023';
  END IF;

  FOR r IN SELECT * FROM jsonb_to_recordset(COALESCE(p_alunos, '[]'::jsonb)) AS x(
    nome text,
    numero_processo text,
    data_nascimento date,
    genero text,
    bi_numero text,
    nif text,
    encarregado_nome text,
    encarregado_telefone text,
    encarregado_email text,
    turma_codigo text
  ) LOOP
    BEGIN
      v_turma_id := NULL;
      v_clean_turma := NULL;
      v_clean_sexo := NULL;

      IF r.turma_codigo IS NOT NULL AND trim(r.turma_codigo) <> '' THEN
        v_clean_turma := upper(regexp_replace(trim(r.turma_codigo), '\\s+', '', 'g'));
        v_turma_id := (SELECT id FROM public.create_or_get_turma_by_code(p_escola_id, p_ano_letivo, v_clean_turma));
      END IF;

      IF r.genero IS NOT NULL THEN
        v_clean_sexo := upper(trim(r.genero));
        IF v_clean_sexo NOT IN ('M','F') THEN
          v_clean_sexo := NULL;
        END IF;
      END IF;

      INSERT INTO public.alunos (
        escola_id, numero_processo, nome, data_nascimento, sexo,
        bi_numero, nif, encarregado_nome, encarregado_telefone, encarregado_email
      ) VALUES (
        p_escola_id,
        NULLIF(trim(r.numero_processo), ''),
        r.nome,
        r.data_nascimento,
        v_clean_sexo,
        NULLIF(upper(trim(r.bi_numero)), ''),
        NULLIF(upper(trim(COALESCE(r.nif, r.bi_numero))), ''),
        r.encarregado_nome,
        regexp_replace(COALESCE(r.encarregado_telefone, ''), '[^0-9+]', '', 'g'),
        lower(trim(r.encarregado_email))
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome = EXCLUDED.nome,
        data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.alunos.data_nascimento),
        sexo = COALESCE(EXCLUDED.sexo, public.alunos.sexo),
        bi_numero = COALESCE(EXCLUDED.bi_numero, public.alunos.bi_numero),
        nif = COALESCE(EXCLUDED.nif, public.alunos.nif),
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = COALESCE(EXCLUDED.encarregado_telefone, public.alunos.encarregado_telefone),
        encarregado_email = COALESCE(EXCLUDED.encarregado_email, public.alunos.encarregado_email),
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      IF v_turma_id IS NOT NULL THEN
        INSERT INTO public.matriculas (
          escola_id, aluno_id, turma_id, ano_letivo, status, ativo,
          numero_matricula, data_matricula
        ) VALUES (
          p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, 'ativo', true,
          COALESCE(NULLIF(r.numero_processo, ''), v_aluno_id::text) || '/' || p_ano_letivo,
          now()
        )
        ON CONFLICT (escola_id, aluno_id, ano_letivo) DO UPDATE SET turma_id = EXCLUDED.turma_id;
      END IF;

      v_total_sucesso := v_total_sucesso + 1;
    EXCEPTION WHEN OTHERS THEN
      v_total_erros := v_total_erros + 1;
      v_erros := array_append(v_erros, format('Erro em %s: %s', COALESCE(r.nome, 'aluno'), SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', v_total_sucesso,
    'erros_count', v_total_erros,
    'mensagens_erro', v_erros
  );
END;
$$;

COMMIT;
