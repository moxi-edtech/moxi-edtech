BEGIN;

-- Refatora a função de importação para usar a nova RPC `setup_active_ano_letivo`,
-- garantindo uma operação atômica e auditada para a gestão do ano letivo.

DROP FUNCTION IF EXISTS public.importar_alunos_v2(uuid, integer, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.importar_alunos_v2(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_import_id uuid,
  p_alunos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_id uuid;
  v_total int := 0;
  v_sucesso int := 0;
  v_erros int := 0;
  v_detail jsonb := '[]'::jsonb;
  rec jsonb;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_turma_nome text;
  v_curso_id uuid;
  v_classe_id uuid;
  v_bi text;
  v_nome text;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'p_escola_id é obrigatório';
  END IF;
  IF p_ano_letivo IS NULL THEN
    RAISE EXCEPTION 'p_ano_letivo é obrigatório';
  END IF;

  -- =========================================================
  -- LÓGICA ANTIGA (REMOVIDA)
  -- insert into anos_letivos ...
  -- update anos_letivos set ativo = false ...
  -- =========================================================
  
  -- NOVA LÓGICA: Usa a RPC para garantir atomicidade e auditoria
  SELECT (
    public.setup_active_ano_letivo(
      p_escola_id,
      jsonb_build_object(
        'ano', p_ano_letivo,
        'data_inicio', to_date(p_ano_letivo::text || '-01-01', 'YYYY-MM-DD'),
        'data_fim', to_date(p_ano_letivo::text || '-12-31', 'YYYY-MM-DD'), -- Ajustado para fim do mesmo ano
        'ativo', true
      )
    ) ->> 'id'
  )::uuid INTO v_ano_id;

  -- Loop alunos
  FOR rec IN SELECT * FROM jsonb_array_elements(p_alunos) LOOP
    v_total := v_total + 1;
    v_aluno_id := COALESCE((rec->>'aluno_id')::uuid, gen_random_uuid());
    v_turma_id := (rec->>'turma_id')::uuid;
    v_turma_nome := nullif(rec->>'turma_nome','');
    v_curso_id := (rec->>'curso_id')::uuid;
    v_classe_id := (rec->>'classe_id')::uuid;
    v_bi := nullif(rec->>'bi','');
    v_nome := nullif(rec->>'nome','');

    BEGIN
      IF v_nome IS NULL THEN
        RAISE EXCEPTION 'Nome do aluno ausente';
      END IF;

      -- Upsert aluno
      INSERT INTO alunos(id, escola_id, nome, bi_numero, import_id)
      VALUES (v_aluno_id, p_escola_id, v_nome, v_bi, p_import_id)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, bi_numero = EXCLUDED.bi_numero;

      -- Resolver turma se não enviada
      IF v_turma_id IS NULL THEN
        IF v_curso_id IS NOT NULL AND v_classe_id IS NOT NULL THEN
          SELECT id INTO v_turma_id
          FROM turmas
          WHERE escola_id = p_escola_id
            AND curso_id = v_curso_id
            AND classe_id = v_classe_id
            AND ano_letivo = p_ano_letivo
          LIMIT 1;
        END IF;

        IF v_turma_id IS NULL AND v_turma_nome IS NOT NULL THEN
          SELECT id INTO v_turma_id
          FROM turmas
          WHERE escola_id = p_escola_id
            AND nome = v_turma_nome
            AND ano_letivo = p_ano_letivo
          LIMIT 1;
        END IF;
      END IF;

      -- Cria turma mínima se necessário (turno M padrão)
      IF v_turma_id IS NULL THEN
        IF v_curso_id IS NULL OR v_classe_id IS NULL THEN
          RAISE EXCEPTION 'Sem turma e sem curso/classe para criar';
        END IF;
        INSERT INTO turmas (escola_id, nome, curso_id, classe_id, turno, ano_letivo)
        VALUES (p_escola_id, COALESCE(v_turma_nome, 'Turma '||v_classe_id||' '||p_ano_letivo), v_curso_id, v_classe_id, 'M', p_ano_letivo)
        RETURNING id INTO v_turma_id;
      END IF;

      -- Matricula
      INSERT INTO matriculas (id, escola_id, aluno_id, turma_id, ano_letivo, ano_letivo_id, status, import_id)
      VALUES (gen_random_uuid(), p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, v_ano_id, 'ativa', p_import_id)
      ON CONFLICT (aluno_id, turma_id) DO NOTHING;

      v_sucesso := v_sucesso + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('aluno', v_nome, 'status', 'ok'));
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('aluno', v_nome, 'status', 'erro', 'msg', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'sucesso', v_sucesso,
    'erros', v_erros,
    'detail', v_detail
  );
END;
$$;

COMMIT;
