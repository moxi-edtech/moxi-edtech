# Plano de Ajuste - Ano Letivo Curtume

data: 2026-05-06
status: aplicado em producao
escola_slug: complexo-escolar-privado-advetista-de-curtume
escola_id: 3744879f-2e19-4671-8995-78604302d8c5
ano_letivo_id_atual: a587cee1-1985-47ab-8986-2eefb11b0c61

## Resultado do Apply

Aplicado em `2026-05-06` via Supabase migrations:

- `20270506010000_fix_curtume_ano_letivo_2025.sql`
- `20270506011000_fix_secretaria_matriculas_status_refresh_schema.sql`

Resultado validado:

- ano letivo ativo: `2025`, `2025-09-01` a `2026-07-31`
- trimestres ajustados para o calendario oficial
- `turmas`: 21 em `2025`, 0 em `2026`
- `matriculas`: 74 em `2025`, 0 em `2026`
- `candidaturas`: 162 em `2025`, 0 em `2026`
- `financeiro_tabelas`: 9 em `2025`, 0 em `2026`
- `mensalidades`: 814 em `2025`, 0 em `2026`
- MVs criticas atualizadas depois do apply

Durante o refresh foi encontrada e corrigida uma funcao quebrada: `public.refresh_mv_secretaria_matriculas_status()` apontava para `public.mv_secretaria_matriculas_status`, mas a MV real esta em `internal.mv_secretaria_matriculas_status`.

## Objetivo

Corrigir o ano letivo atualmente configurado como `2026` para `2025`, mantendo a continuidade operacional da escola e evitando que dados academicos/financeiros fiquem separados entre anos diferentes.

Assuncao operacional a confirmar antes do apply:

- Ano letivo correto: `2025`
- Abertura oficial: `2025-09-01`
- Inicio das atividades lectivas: `2025-09-02`
- Termino do ano letivo: `2026-07-31`
- Periodos corretos esperados:
  - 1o trimestre: `2025-09-02` a `2025-12-31`
  - 2o trimestre: `2026-01-05` a `2026-04-10`
  - 3o trimestre: `2026-04-13` a `2026-07-31`

Nota de consistencia: o texto fornecido informa que o I Trimestre termina em `31 de Dezembro de 2026`, mas isso conflita com o inicio do II Trimestre em `2026-01-05` e com o encerramento do ano letivo em `2026-07-31`. O plano assume que o fim correto do I Trimestre e `2025-12-31`.

## Diagnostico Atual

A escola possui apenas uma linha em `public.anos_letivos`:

| ano | data_inicio | data_fim | ativo |
|---|---:|---:|---|
| 2026 | 2026-09-08 | 2027-07-31 | true |

Nao existe uma sessao `2025` para simplesmente ativar. Criar uma nova sessao e ativar sem migrar os dados deixaria o sistema dividido.

## Impacto Medido

Registros ja ligados ao ano incorreto `2026`:

| Area | Quantidade | Observacao |
|---|---:|---|
| `periodos_letivos` | 3 | Ligados por `ano_letivo_id` |
| `curso_curriculos` | 9 | Status `published`, ligados por `ano_letivo_id` |
| `turmas` | 21 | `ano_letivo = 2026` e `ano_letivo_id` atual |
| `matriculas` | 74 | Todas com status `ativo` no ensaio transacional |
| `candidaturas` | 162 | Contagem atual no ensaio transacional |
| `financeiro_tabelas` | 9 | `ano_letivo = 2026` |
| `mensalidades` | 814 | 2 pagas, 812 pendentes, sem documento fiscal vinculado |

Distribuicao das mensalidades:

| Referencia | Status | Total | Valor previsto |
|---|---|---:|---:|
| 2026/09 | pago | 1 | 2.000,00 |
| 2026/09 | pendente | 73 | 146.000,00 |
| 2026/10 | pago | 1 | 2.000,00 |
| 2026/10 | pendente | 73 | 146.000,00 |
| 2026/11 a 2027/07 | pendente | 666 | 1.332.000,00 |

## Riscos

1. Se alterar apenas `anos_letivos.ano`, as rotas que filtram por `turmas.ano_letivo`, `matriculas.ano_letivo`, `candidaturas.ano_letivo` ou `mensalidades.ano_letivo` podem deixar de encontrar os dados atuais.
2. Se criar uma nova sessao 2025 sem migrar os vinculos, a escola passa a ter uma sessao ativa vazia e uma sessao antiga contendo os dados reais.
3. Se ajustar mensalidades sem revisar datas, o financeiro continuara com vencimentos futuros `2026/09` a `2027/07`, incoerentes com o ano letivo `2025`.
4. As 2 mensalidades pagas nao tem documento fiscal vinculado, o que reduz o risco fiscal, mas ainda exige cuidado para manter rastreabilidade de pagamento.

## Decisao Recomendada

Retificar a sessao existente, preservando o mesmo `ano_letivo_id`.

Nao criar uma nova linha em `anos_letivos` para 2025, salvo se a escola realmente precisar manter historico separado. O objetivo aqui parece ser corrigir um setup feito com ano errado, nao abrir um novo ciclo academico.

## Plano de Execucao

### Fase 0 - Preflight

1. Confirmar com negocio as datas oficiais do ano letivo 2025/2026.
2. Confirmar que as mensalidades devem recuar de `2026/09..2027/07` para `2025/09..2026/07`.
3. Confirmar que os pagamentos ja feitos em 2026-05-05 devem permanecer com `data_pagamento_efetiva = 2026-05-05`.
4. Gerar snapshot de auditoria antes do apply:
   - `anos_letivos`
   - `periodos_letivos`
   - `turmas`
   - `matriculas`
   - `candidaturas`
   - `financeiro_tabelas`
   - `mensalidades`

### Fase 1 - Migration transacional

Executar tudo dentro de uma unica transacao.

1. Bloquear a linha da escola e a linha do ano letivo atual com `FOR UPDATE`.
2. Validar invariantes:
   - existe exatamente 1 ano letivo para a escola;
   - ano atual e `2026`;
   - `ativo = true`;
   - nao existe outra linha `ano = 2025` para a escola;
   - contagens batem com o preflight ou a diferenca e conhecida.
3. Atualizar `public.anos_letivos`:
   - `ano: 2026 -> 2025`
   - `data_inicio: 2026-09-08 -> 2025-09-01`
   - `data_fim: 2027-07-31 -> 2026-07-31`
4. Atualizar `public.periodos_letivos` ligados ao mesmo `ano_letivo_id`:
   - trimestre 1: `2025-09-02` a `2025-12-31`
   - trimestre 2: `2026-01-05` a `2026-04-10`
   - trimestre 3: `2026-04-13` a `2026-07-31`
5. Atualizar campos denormalizados de ano:
   - `turmas.ano_letivo: 2026 -> 2025`
   - `matriculas.ano_letivo: 2026 -> 2025`
   - `candidaturas.ano_letivo: 2026 -> 2025`
   - `financeiro_tabelas.ano_letivo: 2026 -> 2025`
   - `financeiro_contratos.ano_letivo: 2026 -> 2025`, se houver linhas
   - `avaliacoes.ano_letivo: 2026 -> 2025`, se houver linhas
6. Atualizar mensalidades:
   - `ano_letivo: '2026' -> '2025'`
   - `ano_referencia = ano_referencia - 1` para linhas `2026/09..2027/07`
   - `data_vencimento = data_vencimento - interval '1 year'`
   - preservar `data_pagamento_efetiva`, `valor_pago_total`, `status` e `fiscal_documento_id`
7. Inserir evento em tabela de auditoria, se houver padrao existente para correcao operacional.
8. Commit somente se todas as validacoes internas passarem.

### Fase 2 - Pos-apply

1. Rodar as mesmas contagens do preflight, agora esperando `2025`.
2. Confirmar que nao restaram dados da escola em `ano_letivo = 2026` nas tabelas migradas.
3. Confirmar que o ano ativo da escola e `2025`.
4. Revalidar telas:
   - secretaria/turmas
   - secretaria/matriculas
   - secretaria/admissoes
   - financeiro/tabelas
   - financeiro/radar ou mensalidades
5. Atualizar/refresh de views ou MVs dependentes, se aplicavel.

## SQL de Referencia

Este bloco e apenas referencia para a migration final. Nao executar sem revisar as datas oficiais.

```sql
BEGIN;

-- 1. Lock e validacao inicial
SELECT id, ano, data_inicio, data_fim, ativo
FROM public.anos_letivos
WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
FOR UPDATE;

-- 2. Retificar sessao existente
UPDATE public.anos_letivos
SET ano = 2025,
    data_inicio = DATE '2025-09-01',
    data_fim = DATE '2026-07-31',
    updated_at = now()
WHERE id = 'a587cee1-1985-47ab-8986-2eefb11b0c61'
  AND escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
  AND ano = 2026
  AND ativo = true;

-- 3. Retificar periodos
UPDATE public.periodos_letivos
SET data_inicio = CASE numero
    WHEN 1 THEN DATE '2025-09-02'
    WHEN 2 THEN DATE '2026-01-05'
    WHEN 3 THEN DATE '2026-04-13'
  END,
  data_fim = CASE numero
    WHEN 1 THEN DATE '2025-12-31'
    WHEN 2 THEN DATE '2026-04-10'
    WHEN 3 THEN DATE '2026-07-31'
  END,
  updated_at = now()
WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
  AND ano_letivo_id = 'a587cee1-1985-47ab-8986-2eefb11b0c61'
  AND numero IN (1, 2, 3);

-- 4. Retificar referencias numericas
UPDATE public.turmas
SET ano_letivo = 2025
WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
  AND ano_letivo = 2026;

UPDATE public.matriculas
SET ano_letivo = 2025
WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
  AND ano_letivo = 2026;

UPDATE public.candidaturas
SET ano_letivo = 2025
WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
  AND ano_letivo = 2026;

UPDATE public.financeiro_tabelas
SET ano_letivo = 2025
WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
  AND ano_letivo = 2026;

-- 5. Retificar mensalidades
UPDATE public.mensalidades
SET ano_letivo = '2025',
    ano_referencia = ano_referencia - 1,
    data_vencimento = (data_vencimento - interval '1 year')::date,
    updated_at = now()
WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
  AND ano_letivo = '2026'
  AND (
    (ano_referencia = 2026 AND mes_referencia BETWEEN 9 AND 12)
    OR (ano_referencia = 2027 AND mes_referencia BETWEEN 1 AND 7)
  );

COMMIT;
```

## Validacoes Obrigatorias

Antes do commit da transacao:

```sql
-- Deve retornar 1 linha ativa em 2025
SELECT ano, data_inicio, data_fim, ativo
FROM public.anos_letivos
WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5';

-- Nao deve retornar linhas nas tabelas migradas
SELECT count(*) FROM public.turmas WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5' AND ano_letivo = 2026;
SELECT count(*) FROM public.matriculas WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5' AND ano_letivo = 2026;
SELECT count(*) FROM public.candidaturas WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5' AND ano_letivo = 2026;
SELECT count(*) FROM public.financeiro_tabelas WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5' AND ano_letivo = 2026;
SELECT count(*) FROM public.mensalidades WHERE escola_id = '3744879f-2e19-4671-8995-78604302d8c5' AND ano_letivo = '2026';
```

Resultados esperados depois do apply:

| Area | Esperado em 2025 |
|---|---:|
| `turmas` | 21 |
| `matriculas` | 74 |
| `candidaturas` | 162 |
| `financeiro_tabelas` | 9 |
| `mensalidades` | 814 |

## Rollback

Rollback tecnico possivel se feito imediatamente e antes de novas operacoes no portal:

1. Reverter `anos_letivos` para `2026`, datas `2026-09-08` a `2027-07-31`.
2. Reverter `periodos_letivos` para as datas antigas.
3. Reverter `ano_letivo` denormalizado de `2025` para `2026` nas tabelas migradas.
4. Reverter mensalidades:
   - `ano_letivo: '2025' -> '2026'`
   - `ano_referencia = ano_referencia + 1`
   - `data_vencimento = data_vencimento + interval '1 year'`

O rollback deixa de ser simples se, depois do ajuste, usuarios criarem novas turmas, matriculas, candidaturas ou mensalidades ja em 2025.

## Checklist de Aprovacao

- [ ] Datas oficiais confirmadas.
- [ ] Decisao confirmada: retificar sessao atual, nao criar nova sessao.
- [ ] Confirmado ajuste de mensalidades para `2025/09..2026/07`.
- [ ] Snapshot preflight salvo.
- [ ] Migration revisada com contagens esperadas.
- [ ] Janela curta de manutencao definida.
- [ ] Validacoes pos-apply aprovadas.
