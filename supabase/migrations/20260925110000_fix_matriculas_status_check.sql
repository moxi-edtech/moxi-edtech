BEGIN;

-- Atualiza os status permitidos para alinhar com o funil atual
ALTER TABLE public.matriculas
  DROP CONSTRAINT IF EXISTS matriculas_status_check;

ALTER TABLE public.matriculas
  ADD CONSTRAINT matriculas_status_check
  CHECK (status = ANY (
    ARRAY[
      'pendente',
      'ativa', 'ativo',
      'inativo',
      'concluido',
      'transferido',
      'trancado',
      'desistente',
      'indefinido',
      'rascunho'
    ]
  ));

-- Normaliza valores existentes para evitar violações na aplicação do constraint
UPDATE public.matriculas
SET status = public.canonicalize_matricula_status_text(status);

COMMIT;

NOTIFY pgrst, 'reload schema';
