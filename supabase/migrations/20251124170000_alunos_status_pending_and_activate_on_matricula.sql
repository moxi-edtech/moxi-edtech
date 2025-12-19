-- Ajuste de regra de ativação de alunos
-- 1) Aluno criado a partir de escola_usuarios fica como 'pendente'
-- 2) Aluno passa a 'ativo' apenas após matrícula concluída com número de estudante atribuído

-- 0) Garantir que o status suporta 'pendente'

ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS status text;

-- Opcional: normalizar algum valor estranho antes (exemplo: 'active' antigo)
UPDATE public.alunos
   SET status = 'ativo'
 WHERE status = 'active';

-- Remove o check antigo
ALTER TABLE public.alunos
  DROP CONSTRAINT IF EXISTS alunos_status_check;

-- Cria o check novo, incluindo 'pendente'
ALTER TABLE public.alunos
  ADD CONSTRAINT alunos_status_check
  CHECK (
    status IS NULL
    OR status IN ('ativo', 'inativo', 'suspenso', 'pendente')
  );

-- (Opcional) se quiser que o default passe a ser 'pendente' em vez de 'ativo':
-- ALTER TABLE public.alunos ALTER COLUMN status SET DEFAULT 'pendente';


-- 1) Atualiza a função ensure_aluno_from_escola_usuario para não ativar imediatamente
CREATE OR REPLACE FUNCTION public.ensure_aluno_from_escola_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nome      text;
  v_telefone  text;
BEGIN
  IF NEW.papel IS DISTINCT FROM 'aluno' THEN
    RETURN NEW;
  END IF;

  SELECT p.nome, p.telefone
  INTO v_nome, v_telefone
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.alunos (
    profile_id,
    escola_id,
    nome,
    telefone_responsavel,
    status,
    created_at
  )
  VALUES (
    NEW.user_id,
    NEW.escola_id,
    COALESCE(v_nome, 'Aluno sem nome'),
    v_telefone,
    'pendente',
    NOW()
  )
  ON CONFLICT (profile_id, escola_id)
  DO UPDATE SET
    nome                 = EXCLUDED.nome,
    telefone_responsavel = EXCLUDED.telefone_responsavel;

  RETURN NEW;
END;
$$;

-- 2) Função/trigger para ativar aluno após matrícula com número
CREATE OR REPLACE FUNCTION public.activate_aluno_after_matricula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_numero text;
  v_status text;
BEGIN
  v_numero := NEW.numero_matricula;
  v_status := NEW.status;

  -- precisa ter número de matrícula e estar ativa
  IF v_numero IS NOT NULL
     AND btrim(v_numero) <> ''
     AND (v_status = 'ativo' OR v_status = 'ativa') THEN
    UPDATE public.alunos
       SET status = 'ativo'
     WHERE id = NEW.aluno_id
       AND status IS DISTINCT FROM 'ativo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_aluno_after_matricula ON public.matriculas;

CREATE TRIGGER trg_activate_aluno_after_matricula
AFTER INSERT OR UPDATE OF numero_matricula, status ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.activate_aluno_after_matricula();

-- 3) Backfill: alunos marcados 'ativo' sem matrícula válida voltam para 'pendente'
UPDATE public.alunos a
   SET status = 'pendente'
 WHERE status = 'ativo'
   AND NOT EXISTS (
     SELECT 1
       FROM public.matriculas m
      WHERE m.aluno_id = a.id
        AND (m.status = 'ativo' OR m.status = 'ativa')
        AND COALESCE(btrim(m.numero_matricula), '') <> ''
   );