INSERT INTO public.servicos_escola (
  escola_id,
  codigo,
  nome,
  descricao,
  valor_base,
  pode_bloquear_por_debito,
  exige_pagamento_antes_de_liberar,
  aceita_pagamento_pendente,
  exige_aprovacao,
  ativo
)
SELECT
  e.id,
  'SERV_REMATRICULA',
  'Taxa de Rematrícula',
  'Emolumento para confirmação da matrícula no ano letivo corrente.',
  0,
  true,
  true,
  false,
  false,
  true
FROM public.escolas e
ON CONFLICT (escola_id, codigo) DO NOTHING;
