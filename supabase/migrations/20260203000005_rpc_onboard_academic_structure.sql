BEGIN;

-- =================================================================
-- RPC para Onboarding de Estrutura Acadêmica a partir de Matriz
--
-- Esta função substitui a lógica complexa que estava na API:
-- /api/escolas/[id]/onboarding/curriculum/apply-matrix/route.ts
--
-- Benefícios:
-- 1. ATOMICIDADE: Toda a operação ocorre em uma única transação.
-- 2. AUDITORIA: Registra um log de auditoria detalhado da operação.
-- 3. PERFORMANCE: Reduz múltiplas chamadas de rede a uma única.
-- 4. SEGURANÇA: Centraliza a lógica de negócio no banco de dados.
-- =================================================================

CREATE OR REPLACE FUNCTION public.onboard_academic_structure_from_matrix(
  p_escola_id uuid,
  p_session_id text,
  p_matrix jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Variáveis de controle e resultado
  v_summary jsonb := jsonb_build_object(
    'cursos', jsonb_build_object('created', 0, 'reused', 0),
    'classes', jsonb_build_object('created', 0, 'reused', 0),
    'disciplinas', jsonb_build_object('created', 0, 'reused', 0),
    'curso_matriz', jsonb_build_object('created', 0),
    'turmas', jsonb_build_object('created', 0, 'skipped', 0),
    'turma_disciplinas', jsonb_build_object('created', 0)
  );
  v_actor_id uuid := auth.uid();
  v_ano_letivo_id uuid;
  v_ano_letivo int;

  -- Variáveis de loop
  curso_group record;
  matrix_row jsonb;
  disciplina_blueprint record;
  v_curso_id uuid;
  v_classe_id uuid;
  v_disciplina_id uuid;
  v_turma_id uuid;

  -- Constantes e helpers
  letras text[] := ARRAY['A','B','C','D','E','F','G','H','I','J'];
BEGIN
  -- 1. Validação inicial e setup
  v_ano_letivo := p_session_id::int;
  SELECT id INTO v_ano_letivo_id FROM public.anos_letivos WHERE escola_id = p_escola_id AND ano = v_ano_letivo;
  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'Ano letivo % não encontrado para a escola %.', v_ano_letivo, p_escola_id;
  END IF;

  -- 2. Agrupar matrix por cursoKey para processamento
  FOR curso_group IN
    SELECT
      (arr.item->>'cursoKey') as curso_key,
      (arr.item->>'cursoNome') as curso_nome,
      jsonb_agg(arr.item) as rows
    FROM jsonb_array_elements(p_matrix) WITH ORDINALITY AS arr(item, position)
    GROUP BY curso_key, curso_nome
  LOOP
    -- 3. Criar ou reutilizar o CURSO
    INSERT INTO public.cursos (escola_id, nome, codigo, status_aprovacao)
    VALUES (p_escola_id, curso_group.curso_nome, curso_group.curso_key, 'aprovado')
    ON CONFLICT (escola_id, codigo) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id INTO v_curso_id;

    -- Lógica para incrementar contador de created/reused
    IF (SELECT xmax FROM pg_class WHERE relname = 'cursos') = 0 THEN
      v_summary := jsonb_set(v_summary, '{cursos,created}', (v_summary->'cursos'->>'created')::int + 1);
    ELSE
      v_summary := jsonb_set(v_summary, '{cursos,reused}', (v_summary->'cursos'->>'reused')::int + 1);
    END IF;

    -- 4. Criar o CURRÍCULO DRAFT para este curso/ano
    -- Cada onboarding é uma nova versão em draft. A publicação é um passo separado.
    INSERT INTO public.curso_curriculos (escola_id, curso_id, ano_letivo_id, status, version, created_by)
    VALUES (p_escola_id, v_curso_id, v_ano_letivo_id, 'draft', (
      SELECT COALESCE(MAX(version), 0) + 1 FROM public.curso_curriculos
      WHERE escola_id = p_escola_id AND curso_id = v_curso_id AND ano_letivo_id = v_ano_letivo_id
    ), v_actor_id)
    ON CONFLICT (escola_id, curso_id, ano_letivo_id, version) DO NOTHING;
    
    -- Processar cada linha da matriz (representa uma classe)
    FOR matrix_row IN SELECT * FROM jsonb_array_elements(curso_group.rows) LOOP
      
      -- 5. Criar ou reutilizar a CLASSE
      INSERT INTO public.classes (escola_id, curso_id, nome)
      VALUES (p_escola_id, v_curso_id, matrix_row->>'nome')
      ON CONFLICT (escola_id, curso_id, nome) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id INTO v_classe_id;
      
      IF (SELECT xmax FROM pg_class WHERE relname = 'classes') = 0 THEN
        v_summary := jsonb_set(v_summary, '{classes,created}', (v_summary->'classes'->>'created')::int + 1);
      ELSE
        v_summary := jsonb_set(v_summary, '{classes,reused}', (v_summary->'classes'->>'reused')::int + 1);
      END IF;

      -- 6. Gerar TURMAS
      FOR i IN 1..(matrix_row->>'manha')::int LOOP
        INSERT INTO public.turmas (escola_id, curso_id, classe_id, ano_letivo, ano_letivo_id, nome, turno, status_validacao)
        VALUES (p_escola_id, v_curso_id, v_classe_id, v_ano_letivo, v_ano_letivo_id, letras[i], 'M', 'ativo')
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING;
      END LOOP;
      FOR i IN 1..(matrix_row->>'tarde')::int LOOP
        INSERT INTO public.turmas (escola_id, curso_id, classe_id, ano_letivo, ano_letivo_id, nome, turno, status_validacao)
        VALUES (p_escola_id, v_curso_id, v_classe_id, v_ano_letivo, v_ano_letivo_id, letras[i], 'T', 'ativo')
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING;
      END LOOP;
      FOR i IN 1..(matrix_row->>'noite')::int LOOP
        INSERT INTO public.turmas (escola_id, curso_id, classe_id, ano_letivo, ano_letivo_id, nome, turno, status_validacao)
        VALUES (p_escola_id, v_curso_id, v_classe_id, v_ano_letivo, v_ano_letivo_id, letras[i], 'N', 'ativo')
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 7. AUDITORIA
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'ONBOARDING_ACADEMIC_STRUCTURE',
    'multiple',
    'admin',
    jsonb_build_object(
      'summary', v_summary,
      'ano_letivo', v_ano_letivo
    )
  );

  RETURN v_summary;
END;
$$;

ALTER FUNCTION public.onboard_academic_structure_from_matrix(uuid, text, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.onboard_academic_structure_from_matrix(uuid, text, jsonb) TO authenticated;

COMMIT;
