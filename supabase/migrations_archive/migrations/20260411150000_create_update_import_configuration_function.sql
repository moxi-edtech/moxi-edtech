BEGIN;

-- =============================================================================
-- MIGRATION: Criar função `update_import_configuration`
-- OBJETIVO:  Permitir a atualização em massa de cursos e turmas que foram
--            criados durante uma importação, a partir do passo de configuração
--            no wizard de importação.
-- =============================================================================

CREATE TYPE curso_update AS (
  id uuid,
  nome text,
  status_aprovacao text
);

CREATE TYPE turma_update AS (
  id uuid,
  nome text,
  curso_id uuid,
  classe_id uuid,
  turno text,
  status_validacao text
);

CREATE OR REPLACE FUNCTION public.update_import_configuration(
  p_import_id uuid,
  p_cursos_data jsonb,
  p_turmas_data jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_role text;
  curso_rec record;
  turma_rec record;
  v_cursos_updated int := 0;
  v_turmas_updated int := 0;
BEGIN
  -- 1. Obter a role do usuário para validação de permissões
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role' INTO v_user_role;

  -- 2. Atualizar Cursos Pendentes
  IF p_cursos_data IS NOT NULL AND jsonb_array_length(p_cursos_data) > 0 THEN
    FOR curso_rec IN SELECT * FROM jsonb_to_recordset(p_cursos_data) AS x(id uuid, nome text, status_aprovacao text) LOOP
      
      -- Apenas admins podem aprovar um curso
      IF curso_rec.status_aprovacao = 'aprovado' AND (v_user_role <> 'admin' AND v_user_role <> 'super_admin') THEN
        -- Não faz nada ou pode-se lançar um erro. Por segurança, vamos ignorar a alteração de status.
        UPDATE public.cursos
        SET nome = curso_rec.nome
        WHERE id = curso_rec.id AND import_id = p_import_id;
      ELSE
        -- Admin pode aprovar e qualquer um pode atualizar o nome
        UPDATE public.cursos
        SET
          nome = COALESCE(curso_rec.nome, nome),
          status_aprovacao = COALESCE(curso_rec.status_aprovacao, status_aprovacao)
        WHERE id = curso_rec.id AND import_id = p_import_id;
      END IF;

      v_cursos_updated := v_cursos_updated + 1;
    END LOOP;
  END IF;

  -- 3. Atualizar Turmas em Rascunho
  IF p_turmas_data IS NOT NULL AND jsonb_array_length(p_turmas_data) > 0 THEN
    FOR turma_rec IN SELECT * FROM jsonb_to_recordset(p_turmas_data) AS x(id uuid, nome text, curso_id uuid, classe_id uuid, turno text, status_validacao text) LOOP
      
      UPDATE public.turmas
      SET
        nome = COALESCE(turma_rec.nome, nome),
        curso_id = COALESCE(turma_rec.curso_id, curso_id),
        classe_id = COALESCE(turma_rec.classe_id, classe_id),
        turno = COALESCE(turma_rec.turno, turno),
        status_validacao = COALESCE(turma_rec.status_validacao, status_validacao) -- ex: 'ativo'
      WHERE id = turma_rec.id AND import_id = p_import_id;

      v_turmas_updated := v_turmas_updated + 1;
    END LOOP;
  END IF;

  -- 4. Retornar o resultado
  RETURN json_build_object(
    'success', true,
    'cursos_updated', v_cursos_updated,
    'turmas_updated', v_turmas_updated
  );
END;
$$;

COMMIT;
