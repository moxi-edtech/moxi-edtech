-- KLASSE | Student lifecycle: inventário de conciliação (somente leitura).
-- Executar por operador autorizado no banco; NÃO expor como endpoint público ou vista sem RLS.
-- Abrange TODAS as escolas e anos; devolve IDs, regras e ações, nunca nomes/BI.
-- NÃO altera matrícula, resultado RAA, notas, financeiro ou histórico legal.
-- O resultado académico só pode ser decidido pelo SSOT RAA/fechamento oficial.
WITH
anos AS (
  SELECT escola_id, ano, max(data_fim) AS data_fim
  FROM public.anos_letivos
  GROUP BY escola_id, ano
),
matriculas_ativas AS (
  SELECT escola_id, aluno_id, ano_letivo,
    count(*) FILTER (WHERE ativo IS TRUE) AS quantidade
  FROM public.matriculas
  WHERE aluno_id IS NOT NULL
  GROUP BY escola_id, aluno_id, ano_letivo
),
destinos AS (
  SELECT origem_transicao_matricula_id AS origem_id,
    count(*) FILTER (
      WHERE ativo IS TRUE AND lower(coalesce(status, '')) IN ('ativo','ativa','active')
    ) AS ativos_confirmados
  FROM public.matriculas
  WHERE origem_transicao_matricula_id IS NOT NULL
  GROUP BY origem_transicao_matricula_id
),
historicos AS (
  SELECT matricula_id,
    count(*) AS total,
    count(*) FILTER (WHERE snapshot_status = 'aberto') AS abertos
  FROM public.historico_anos
  WHERE matricula_id IS NOT NULL
  GROUP BY matricula_id
),
base AS (
  SELECT m.id AS matricula_id, m.escola_id, m.aluno_id, m.ano_letivo,
    m.status, lower(trim(coalesce(m.status, ''))) AS status_normalizado,
    m.ativo, m.turma_id, m.origem_transicao_matricula_id,
    a.escola_id AS escola_aluno, t.id AS turma_encontrada,
    t.escola_id AS escola_turma, t.ano_letivo AS ano_turma,
    o.id AS origem_encontrada, o.escola_id AS escola_origem,
    o.aluno_id AS aluno_origem, o.ano_letivo AS ano_origem,
    al.data_fim AS fim_ano_letivo,
    coalesce(ma.quantidade, 0) AS ativas_ano,
    coalesce(d.ativos_confirmados, 0) AS destinos_ativos,
    coalesce(h.total, 0) AS historicos,
    coalesce(h.abertos, 0) AS historicos_abertos
  FROM public.matriculas m
  LEFT JOIN public.alunos a ON a.id = m.aluno_id
  LEFT JOIN public.turmas t ON t.id = m.turma_id
  LEFT JOIN public.matriculas o ON o.id = m.origem_transicao_matricula_id
  LEFT JOIN anos al ON al.escola_id = m.escola_id AND al.ano = m.ano_letivo
  LEFT JOIN matriculas_ativas ma ON ma.escola_id = m.escola_id AND ma.aluno_id = m.aluno_id
    AND ma.ano_letivo IS NOT DISTINCT FROM m.ano_letivo
  LEFT JOIN destinos d ON d.origem_id = m.id
  LEFT JOIN historicos h ON h.matricula_id = m.id
),
issues_matricula AS (
  SELECT b.escola_id, b.aluno_id, b.matricula_id, b.ano_letivo,
    'matricula'::text AS entidade, r.codigo, r.severidade, r.proximo_passo
  FROM base b
  CROSS JOIN LATERAL (VALUES
    ('FLAG_ATIVA_DIVERGENTE', 'CRITICO',
      (b.status_normalizado IN ('ativo','ativa','active')) IS DISTINCT FROM (b.ativo IS TRUE),
      'Rever status/ativo e a trilha de auditoria; não corrigir automaticamente.'),
    ('DUPLA_MATRICULA_ATIVA', 'CRITICO',
      b.ativo IS TRUE AND b.aluno_id IS NOT NULL AND b.ativas_ano > 1,
      'Conciliar a matrícula oficial do aluno/escola/ano antes de alterar vínculos.'),
    ('MATRICULA_ATIVA_SEM_TURMA', 'CRITICO',
      b.ativo IS TRUE AND (b.turma_id IS NULL OR b.turma_encontrada IS NULL),
      'Recuperar turma e ano letivo com confirmação da secretaria.'),
    ('VINCULO_DE_OUTRA_ESCOLA', 'CRITICO',
      (b.escola_aluno IS NOT NULL AND b.escola_aluno <> b.escola_id)
        OR (b.escola_turma IS NOT NULL AND b.escola_turma <> b.escola_id),
      'Rever isolamento multi-tenant e o vínculo, sem transferência automática.'),
    ('ANO_DA_TURMA_DIVERGENTE', 'REVISAR',
      b.ano_turma IS NOT NULL AND b.ano_letivo IS NOT NULL AND b.ano_turma <> b.ano_letivo,
      'Conferir ano da matrícula, turma e calendário oficial antes da retificação.'),
    ('DESTINO_SEM_ORIGEM', 'CRITICO',
      b.origem_transicao_matricula_id IS NOT NULL AND b.origem_encontrada IS NULL,
      'Identificar a matrícula histórica antes de concluir a transição.'),
    ('DESTINO_ORIGEM_INCOERENTE', 'CRITICO',
      b.origem_encontrada IS NOT NULL AND (
        b.escola_origem IS DISTINCT FROM b.escola_id
        OR b.aluno_origem IS DISTINCT FROM b.aluno_id
        OR b.ano_origem IS NULL OR b.ano_letivo IS NULL
        OR b.ano_origem >= b.ano_letivo
      ),
      'Bloquear conciliação automática: verificar escola, aluno e cronologia de origem/destino.'),
    ('ORIGEM_PENDENTE_COM_DESTINO_ATIVO', 'REVISAR',
      b.status_normalizado = 'pendente' AND b.ativo IS NOT TRUE AND b.destinos_ativos > 0,
      'Reconstituir decisão RAA/proveniência antes de encerrar a matrícula de origem.'),
    ('ANO_ENCERRADO_COM_MATRICULA_PENDENTE', 'REVISAR',
      b.status_normalizado = 'pendente' AND b.destinos_ativos = 0
        AND b.fim_ano_letivo IS NOT NULL AND b.fim_ano_letivo < current_date,
      'Determinar se é reserva, importação histórica ou fecho académico ainda não realizado.'),
    ('CONCLUSAO_SEM_HISTORICO_VINCULADO', 'REVISAR',
      b.status_normalizado IN ('concluido','reprovado') AND b.historicos = 0
        AND b.fim_ano_letivo IS NOT NULL AND b.fim_ano_letivo < current_date,
      'Verificar histórico existente sem matricula_id e decisão académica antes de gerar snapshot.'),
    ('HISTORICO_ABERTO_APOS_ANO', 'REVISAR',
      b.historicos_abertos > 0
        AND b.fim_ano_letivo IS NOT NULL AND b.fim_ano_letivo < current_date,
      'Conferir pauta, RAA e execução oficial de fecho; não congelar automaticamente.'),
    ('STATUS_LEGADO_OU_DESCONHECIDO', 'REVISAR',
      b.status_normalizado NOT IN (
        'pendente','ativo','concluido','transferido','cancelado','anulado',
        'ativa','active','reprovado','encerrada','encerrado'
      ) OR b.status_normalizado IN ('ativa','active','reprovado','encerrada','encerrado'),
      'Classificar legado no contrato canónico; preservar o valor bruto e o motivo.'),
    ('MATRICULA_SEM_ANO', 'REVISAR',
      b.ano_letivo IS NULL,
      'Resolver sessão real via calendário escolar sem inferir ano civil pela data atual.')
  ) AS r(codigo,severidade,aplica,proximo_passo)
  WHERE r.aplica
),
issues_candidatura AS (
  SELECT c.escola_id, c.aluno_id, c.matricula_id, c.ano_letivo,
    'candidatura'::text AS entidade,
    'CANDIDATURA_MATRICULADA_SEM_VINCULO'::text AS codigo,
    'CRITICO'::text AS severidade,
    'Conferir conversão e ligação da candidatura à matrícula; não criar outra matrícula.'::text AS proximo_passo
  FROM public.candidaturas c
  LEFT JOIN public.matriculas m ON m.id = c.matricula_id
  WHERE c.status = 'matriculado'
    AND (c.matricula_id IS NULL OR m.id IS NULL
      OR m.escola_id IS DISTINCT FROM c.escola_id
      OR (c.aluno_id IS NOT NULL AND m.aluno_id IS DISTINCT FROM c.aluno_id))
),
issues_historico AS (
  SELECT h.escola_id, h.aluno_id, h.matricula_id, h.ano_letivo,
    'historico'::text AS entidade, r.codigo, r.severidade, r.proximo_passo
  FROM public.historico_anos h
  LEFT JOIN public.matriculas m ON m.id = h.matricula_id
  CROSS JOIN LATERAL (VALUES
    ('HISTORICO_SEM_MATRICULA_VINCULADA', 'REVISAR',
      h.matricula_id IS NULL OR (h.matricula_id IS NOT NULL AND m.id IS NULL),
      'Verificar se existe matrícula histórica única e compatível; nunca associar por nome.'),
    ('HISTORICO_VINCULO_INCOERENTE', 'CRITICO',
      m.id IS NOT NULL AND (
        h.escola_id IS DISTINCT FROM m.escola_id
        OR h.aluno_id IS DISTINCT FROM m.aluno_id
        OR h.ano_letivo IS DISTINCT FROM m.ano_letivo
      ),
      'Bloquear conciliação automática e rever escola, aluno e ano do histórico.')
  ) AS r(codigo,severidade,aplica,proximo_passo)
  WHERE r.aplica
),
issues AS (
  SELECT * FROM issues_matricula
  UNION ALL
  SELECT * FROM issues_candidatura
  UNION ALL
  SELECT * FROM issues_historico
)
SELECT escola_id, aluno_id, matricula_id, ano_letivo, entidade, codigo,
  severidade, proximo_passo
FROM issues
ORDER BY escola_id, ano_letivo DESC NULLS LAST, aluno_id, codigo;
