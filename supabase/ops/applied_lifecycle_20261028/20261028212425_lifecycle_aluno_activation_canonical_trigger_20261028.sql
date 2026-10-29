-- Applied to KLASSE Supabase as 20261028212425.
CREATE OR REPLACE FUNCTION public.activate_aluno_after_matricula()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','extensions'
AS $activate$
BEGIN
  -- Status é normalizado para 'ativo' pelo trigger canónico ANTES deste AFTER.
  -- Não inferir aprovação; atualizar apenas o estado administrativo do aluno.
  IF NEW.status='ativo' AND NEW.ativo IS TRUE
     AND NEW.numero_matricula IS NOT NULL
     AND btrim(NEW.numero_matricula) <> '' THEN
    UPDATE public.alunos
       SET status='ativo'
     WHERE id=NEW.aluno_id
       AND escola_id=NEW.escola_id
       AND status IS DISTINCT FROM 'ativo';
  END IF;
  RETURN NEW;
END;
$activate$;
