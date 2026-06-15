WITH default_servicos (
  codigo,
  nome,
  descricao,
  valor_base,
  pode_bloquear_por_debito,
  exige_pagamento_antes_de_liberar,
  aceita_pagamento_pendente,
  exige_aprovacao,
  ativo
) AS (
  VALUES
    ('DOC_DECLARACAO_FREQUENCIA', 'Declaracao de Frequencia', 'Documento oficial de frequencia ou matricula do aluno.', 0, false, false, false, true, true),
    ('DOC_DECLARACAO_NOTAS', 'Declaracao com Notas', 'Declaracao com notas e aproveitamento escolar.', 0, false, false, false, true, true),
    ('DOC_BOLETIM_TRIMESTRAL', 'Boletim Trimestral', 'Boletim ou pauta trimestral emitida pela secretaria.', 0, false, false, false, true, true),
    ('DOC_CARTAO_ESTUDANTE', 'Cartao de Estudante', 'Emissao ou renovacao do cartao de estudante.', 0, false, false, false, true, true),
    ('DOC_COMPROVANTE_MATRICULA', 'Comprovante de Matricula', 'Comprovativo oficial de matricula no ano lectivo.', 0, false, false, false, true, true),
    ('DOC_FICHA_INSCRICAO', 'Ficha de Inscricao', 'Ficha com dados basicos para inscricao ou processo interno.', 0, false, false, false, false, true),
    ('DOC_HISTORICO_ESCOLAR', 'Historico Escolar', 'Historico escolar completo do aluno.', 0, false, false, false, true, true),
    ('DOC_CERTIFICADO_HABILITACOES', 'Certificado de Habilitacoes', 'Certificado ou comprovativo final de habilitacoes.', 0, false, false, false, true, true),
    ('SERV_SEGUNDA_VIA_CARTAO', 'Segunda Via de Cartao', 'Emolumento para segunda via de cartao ou documento interno.', 0, false, false, false, false, true),
    ('SERV_DECLARACAO_URGENTE', 'Taxa de Urgencia de Documento', 'Taxa adicional para emissao urgente de documentos.', 0, false, false, false, false, true),
    ('SERV_TRANSFERENCIA_TURMA', 'Transferencia de Turma', 'Servico administrativo para troca de turma.', 0, false, false, false, true, true),
    ('SERV_REABERTURA_PROCESSO', 'Reabertura de Processo', 'Servico administrativo para reabrir ou regularizar processo.', 0, false, false, false, true, true)
)
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
  d.codigo,
  d.nome,
  d.descricao,
  d.valor_base,
  d.pode_bloquear_por_debito,
  d.exige_pagamento_antes_de_liberar,
  d.aceita_pagamento_pendente,
  d.exige_aprovacao,
  d.ativo
FROM public.escolas e
CROSS JOIN default_servicos d
ON CONFLICT (escola_id, codigo) DO NOTHING;
