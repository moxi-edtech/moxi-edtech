-- Versão “evoluída” com UPSERT + validação

-- Garantir unicidade lógica de aluno por escola:

-- Único aluno por (profile_id, escola_id)
ALTER TABLE public.alunos
  ADD CONSTRAINT alunos_profile_escola_uniq
  UNIQUE (profile_id, escola_id);


-- Função com UPSERT + validação defensiva

CREATE OR REPLACE FUNCTION public.ensure_aluno_from_escola_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nome      text;
  v_telefone  text;
BEGIN
  -- Só nos interessa quando o papel é aluno (extra segurança)
  IF NEW.papel IS DISTINCT FROM 'aluno' THEN
    RETURN NEW;
  END IF;

  -- Busca dados mínimos no profile
  SELECT p.nome, p.telefone
  INTO v_nome, v_telefone
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
  LIMIT 1;

  -- Se não houver profile, não inventa aluno fantasma
  IF NOT FOUND THEN
    -- opcional: gravar em tabela de log de inconsistências
    RETURN NEW;
  END IF;

  -- UPSERT atômico: se já existir, só atualiza; se não, cria
  INSERT INTO public.alunos (
    profile_id,
    escola_id,
    nome,
    telefone_responsavel,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.escola_id,
    COALESCE(v_nome, 'Aluno sem nome'),
    v_telefone,
    'ativo',
    NOW(),
    NOW()
  )
  ON CONFLICT (profile_id, escola_id)
  DO UPDATE SET
    nome                = EXCLUDED.nome,
    telefone_responsavel = EXCLUDED.telefone_responsavel,
    updated_at          = NOW();

  RETURN NEW;
END;
$$;


-- Trigger em escola_usuarios

DROP TRIGGER IF EXISTS trg_ensure_aluno_from_escola_usuario ON public.escola_usuarios;

CREATE TRIGGER trg_ensure_aluno_from_escola_usuario
AFTER INSERT ON public.escola_usuarios
FOR EACH ROW
WHEN (NEW.papel = 'aluno')
EXECUTE FUNCTION public.ensure_aluno_from_escola_usuario();
