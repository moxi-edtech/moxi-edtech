-- ======================================================================
--  TRIGGER: Garantir existência de aluno ao inserir em escola_usuarios
--  Objetivo: sempre que NEW.papel = 'aluno', garantir linha correspondente
--            em public.alunos (consistência entre módulos)
-- ======================================================================

BEGIN;

SET check_function_bodies = OFF;

-- 1) Função ensure_aluno_from_escola_usuario()
CREATE OR REPLACE FUNCTION public.ensure_aluno_from_escola_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se já existe aluno com esse profile_id + escola_id → apenas atualiza updated_at
  IF EXISTS (
    SELECT 1 FROM public.alunos a
    WHERE a.profile_id = NEW.user_id
      AND a.escola_id = NEW.escola_id
  ) THEN
    UPDATE public.alunos
      SET updated_at = NOW()
    WHERE profile_id = NEW.user_id
      AND escola_id = NEW.escola_id;

    RETURN NEW;
  END IF;

  -- Caso contrário, insere novo aluno baseado em public.profiles
  INSERT INTO public.alunos (
    nome,
    profile_id,
    telefone_responsavel,
    escola_id,
    status,
    created_at
  )
  VALUES (
    (SELECT nome FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1),
    NEW.user_id,
    (SELECT telefone FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1),
    NEW.escola_id,
    'ativo',
    NOW()
  );

  RETURN NEW;
END;
$$;

-- 2) Trigger vinculado à tabela escola_usuarios
DROP TRIGGER IF EXISTS trg_ensure_aluno_from_escola_usuario ON public.escola_usuarios;

CREATE TRIGGER trg_ensure_aluno_from_escola_usuario
AFTER INSERT ON public.escola_usuarios
FOR EACH ROW
WHEN (NEW.papel = 'aluno')
EXECUTE FUNCTION public.ensure_aluno_from_escola_usuario();

COMMIT;
