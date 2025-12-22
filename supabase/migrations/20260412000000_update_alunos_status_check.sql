ALTER TABLE public.alunos
  DROP CONSTRAINT IF EXISTS alunos_status_check;

ALTER TABLE public.alunos
  ADD CONSTRAINT alunos_status_check
  CHECK (
    status IS NULL
    OR status IN (
      'ativo',
      'inativo',
      'suspenso',
      'pendente',
      'trancado',
      'concluido',
      'transferido',
      'desistente'
    )
  );
