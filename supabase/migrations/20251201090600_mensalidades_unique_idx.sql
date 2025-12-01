-- Evita duplicidade de mensalidades por aluno/mês/ano na mesma escola
-- Usa índice único (idempotente) em vez de constraint direta para tolerar reexecuções

CREATE UNIQUE INDEX IF NOT EXISTS ux_mensalidades_aluno_mes
  ON public.mensalidades (escola_id, aluno_id, ano_referencia, mes_referencia);

