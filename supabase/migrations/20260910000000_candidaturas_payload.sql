-- Permitir candidaturas sem criar registro imediato em alunos
ALTER TABLE public.candidaturas ALTER COLUMN aluno_id DROP NOT NULL;

-- Guardar os dados enviados no formulário e facilitar listagens
ALTER TABLE public.candidaturas
  ADD COLUMN IF NOT EXISTS dados_candidato jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS nome_candidato text,
  ADD COLUMN IF NOT EXISTS classe_id uuid REFERENCES public.classes(id),
  ADD COLUMN IF NOT EXISTS turno text;

-- Preencher colunas novas com informações já existentes
UPDATE public.candidaturas c
SET
  nome_candidato = COALESCE(c.nome_candidato, a.nome_completo, a.nome),
  dados_candidato = CASE
    WHEN c.dados_candidato IS NULL OR c.dados_candidato = '{}'::jsonb THEN
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', a.id,
          'nome', a.nome,
          'nome_completo', a.nome_completo,
          'bi_numero', a.bi_numero,
          'nif', a.nif,
          'email', a.email,
          'telefone', a.telefone_responsavel,
          'responsavel_nome', a.responsavel_nome,
          'responsavel_contato', a.responsavel_contato,
          'encarregado_email', a.encarregado_email,
          'numero_processo', a.numero_processo
        )
      )
    ELSE c.dados_candidato
  END
FROM public.alunos a
WHERE c.aluno_id = a.id;
