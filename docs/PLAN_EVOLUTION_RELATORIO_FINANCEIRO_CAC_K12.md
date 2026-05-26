# Plano Técnico — Evolução do Relatório Financeiro CAC / Mensal Escolar

Data: 2026-05-26  
Escopo: K12 / Secretaria / Financeiro  
Base funcional: `RELATÓRIO FINANCEIRO CAC 2024-2025.xlsx`  
Base comparativa: [docs/RELATORIO_COMPARATIVO_CAC_VS_MENSAL_ESCOLAR_2026-05-26.md](/Users/gundja/moxi-edtech/docs/RELATORIO_COMPARATIVO_CAC_VS_MENSAL_ESCOLAR_2026-05-26.md)

## Objetivo

Transformar o atual `/secretaria/relatorios/mensal-escolar` de um relatório de mensalidades com extensões em um relatório financeiro escolar consolidado, com base técnica clara para:

- MVs e wrappers públicos
- APIs de leitura
- backlog de UI
- critérios de aceite
- sequência de implementação

## Veredito técnico

O produto atual não deve ser descartado. Ele já tem base boa em:

- `public.vw_financeiro_propinas_mensal_escola`
- `public.vw_financeiro_propinas_por_turma`
- `public.vw_financeiro_escola_dia`
- `public.vw_radar_inadimplencia`
- `public.vw_mensalidades_operacional_status_ano_ativo`

Mas essa base está incompleta para substituir a planilha CAC, porque faltam read models e contratos próprios para:

- entradas por tipo
- fechamento mensal por ano letivo
- propinas em atraso por classe
- saldo anterior e saldo acumulado
- consolidado executivo de entradas, saídas e resultado

## Estado atual do produto

### Superfície atual

Páginas:

- [apps/web/src/app/escola/[id]/(portal)/secretaria/(portal-secretaria)/relatorios/mensal-escolar/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/escola/[id]/(portal)/secretaria/(portal-secretaria)/relatorios/mensal-escolar/page.tsx)
- [apps/web/src/app/escola/[id]/(portal)/financeiro/relatorios/mensal-escolar/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/escola/[id]/(portal)/financeiro/relatorios/mensal-escolar/page.tsx)

Cliente compartilhado:

- [apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx](/Users/gundja/moxi-edtech/apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx)

APIs atuais:

- [apps/web/src/app/api/financeiro/relatorios/resumo/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/resumo/route.ts)
- [apps/web/src/app/api/financeiro/relatorios/propinas/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/propinas/route.ts)
- [apps/web/src/app/api/financeiro/relatorios/captacao/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/captacao/route.ts)
- [apps/web/src/app/api/financeiro/relatorios/despesas/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/despesas/route.ts)
- [apps/web/src/app/api/secretaria/school-sessions/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/secretaria/school-sessions/route.ts)

Helper compartilhado de recorte temporal:

- [apps/web/src/lib/financeiro/resolveAnoLetivoScope.ts](/Users/gundja/moxi-edtech/apps/web/src/lib/financeiro/resolveAnoLetivoScope.ts)

### Cobertura atual

Já existe:

- resumo de propinas
- série mensal
- ranking por turma
- captação por classe
- inscritos e bolsistas
- despesas do ledger
- exportação `CSV`, `XLSX` e `PDF`

Ainda não existe de forma correta:

- fechamento mensal por sessão
- `saldo anterior -> entradas -> saídas -> diferença -> saldo acumulado`
- visão de entradas por tipo
- propinas não pagas por classe em formato executivo
- previsão de arrecadação vs realizado

### Estado da Fase 1

Implementado em 2026-05-26:

- `propinas`, `captação` e `despesas` agora aceitam `ano_letivo_id`
- `despesas` passou a respeitar `data_inicio` e `data_fim` do ano letivo
- novo endpoint de resumo consolidado criado em `/api/financeiro/relatorios/resumo`
- o client da página já usa `selectedSession` como `ano_letivo_id`
- os cards principais da UI passaram a consumir o resumo consolidado quando disponível

## Problema de dados identificado

No banco remoto do CAC:

- o ano letivo ativo encontrado é `2025`, com recorte `2025-09-01 -> 2026-07-31`
- o histórico da planilha `2024-2025` não está preservado no modelo atual
- as MVs de propinas têm dados só para `2025`
- `mensalidades` e `financeiro_ledger` já têm massa operacional relevante, mas do ciclo posterior

Conclusão:

- a evolução do produto deve mirar o modelo futuro oficial
- a reprodução exata da planilha histórica depende de backfill/importação

## Princípios técnicos

1. Não recalcular no endpoint o que já existe em `vw_financeiro_propinas_*`.
2. Não filtrar despesas por ano civil quando o relatório for por ano letivo.
3. Todo bloco executivo deve respeitar `data_inicio` e `data_fim` de `anos_letivos`.
4. Leitura operacional consolidada deve vir de read models, não de queries grandes ad hoc.
5. Drill-down continua nos relatórios especialistas já existentes.

## Arquitetura alvo

O artefato final passa a ser um relatório consolidado com cinco blocos:

1. Resumo Executivo
2. Captação
3. Propinas
4. Despesas e Resultado
5. Fechamento Mensal

### Responsabilidade dos blocos

#### Bloco 1 — Resumo Executivo

Indicadores:

- previsto de propinas
- recebido de propinas
- recebido total de entradas
- saídas do período
- saldo do período
- saldo acumulado
- inadimplência

#### Bloco 2 — Captação

Indicadores:

- matrículas por classe
- confirmações por classe
- cartão/inscrição
- bolsistas
- total de entradas de captação

#### Bloco 3 — Propinas

Indicadores:

- previsto vs pago
- atraso por mês
- atraso por classe
- parciais
- adiantamentos
- ranking por turma

#### Bloco 4 — Despesas e Resultado

Indicadores:

- saídas por categoria
- total de saídas
- diferença do mês
- saldo acumulado

#### Bloco 5 — Fechamento Mensal

Indicadores:

- saldo anterior
- entradas
- saídas
- diferença
- saldo final

## Proposta de read models

### Reaproveitamento obrigatório

Manter como fontes oficiais:

- `public.vw_financeiro_propinas_mensal_escola`
- `public.vw_financeiro_propinas_por_turma`
- `public.vw_financeiro_escola_dia`
- `public.vw_radar_inadimplencia`
- `public.vw_mensalidades_operacional_status_ano_ativo`

### Novos read models

Criar apenas o que falta para o consolidado.

#### 1. `internal.mv_relatorio_financeiro_escolar_resumo`

Responsabilidade:

- uma linha por `escola_id + ano_letivo`
- consolidar entradas, saídas, saldo, previsto e inadimplência

Colunas sugeridas:

```sql
escola_id uuid
ano_letivo_id uuid
ano_letivo integer
data_inicio date
data_fim date
saldo_anterior numeric(14,2)
entradas_total numeric(14,2)
entradas_propinas numeric(14,2)
entradas_matriculas numeric(14,2)
entradas_confirmacoes numeric(14,2)
entradas_cartao numeric(14,2)
saidas_total numeric(14,2)
previsto_propinas numeric(14,2)
recebido_propinas numeric(14,2)
atraso_propinas numeric(14,2)
inadimplencia_pct numeric(8,2)
saldo_periodo numeric(14,2)
saldo_acumulado numeric(14,2)
updated_at timestamptz
```

Wrapper:

- `public.vw_relatorio_financeiro_escolar_resumo`

#### 2. `internal.mv_relatorio_financeiro_escolar_capitacao_mensal`

Responsabilidade:

- uma linha por `escola_id + ano_letivo + mes_ref + classe_id`
- captação mensal em formato executivo

Colunas sugeridas:

```sql
escola_id uuid
ano_letivo_id uuid
ano_letivo integer
mes_ref date
classe_id uuid
classe_label text
matriculas_qtd integer
matriculas_total numeric(14,2)
confirmacoes_qtd integer
confirmacoes_total numeric(14,2)
cartao_qtd integer
cartao_total numeric(14,2)
bolsistas_qtd integer
inscritos_total integer
updated_at timestamptz
```

Wrapper:

- `public.vw_relatorio_financeiro_escolar_capitacao_mensal`

#### 3. `internal.mv_relatorio_financeiro_escolar_inadimplencia_classe`

Responsabilidade:

- uma linha por `escola_id + ano_letivo + mes_ref + classe_id`
- espelhar o bloco da planilha de propinas não pagas

Colunas sugeridas:

```sql
escola_id uuid
ano_letivo_id uuid
ano_letivo integer
mes_ref date
classe_id uuid
classe_label text
qtd_em_atraso integer
valor_unitario_medio numeric(14,2)
total_em_atraso numeric(14,2)
qtd_parciais integer
total_parcial_em_aberto numeric(14,2)
updated_at timestamptz
```

Wrapper:

- `public.vw_relatorio_financeiro_escolar_inadimplencia_classe`

#### 4. `internal.mv_relatorio_financeiro_escolar_fluxo_mensal`

Responsabilidade:

- uma linha por `escola_id + ano_letivo + mes_ref`
- fechamento mensal do período

Colunas sugeridas:

```sql
escola_id uuid
ano_letivo_id uuid
ano_letivo integer
mes_ref date
saldo_anterior numeric(14,2)
entradas_total numeric(14,2)
saidas_total numeric(14,2)
diferenca numeric(14,2)
saldo_final numeric(14,2)
updated_at timestamptz
```

Wrapper:

- `public.vw_relatorio_financeiro_escolar_fluxo_mensal`

## Fontes de verdade por domínio

### Propinas

Fonte:

- `public.vw_financeiro_propinas_mensal_escola`
- `public.vw_financeiro_propinas_por_turma`

### Inadimplência operacional

Fonte:

- `public.vw_mensalidades_operacional_status_ano_ativo`
- complementarmente `public.vw_radar_inadimplencia`

### Saídas

Fonte:

- `public.financeiro_ledger`
- filtro por `tipo = 'debito'`
- recorte por intervalo da sessão

### Entradas

Fonte:

- `public.financeiro_ledger`
- filtro por `tipo = 'credito'`
- classificação por `origem`, `referencia_tabela`, `tipo_evento`, `metadata`

### Captação

Fonte inicial:

- `public.matriculas`
- `public.classes`
- `public.turmas`
- descontos em `matriculas.percentagem_desconto` e `motivo_desconto`

Observação:

- se `cartão` não estiver modelado de forma explícita, o produto deve assumir a limitação e mapeá-lo via ledger/origem antes de expor o KPI.

## Regras de recorte temporal

Toda API nova do relatório deve receber `ano_letivo_id` ou `session_id`, nunca apenas `ano`.

Resolução:

1. obter `anos_letivos.id`, `data_inicio`, `data_fim`
2. aplicar o intervalo em todas as leituras
3. se o bloco depender de `ano_letivo` inteiro, derivar do mesmo `ano_letivo_id`

### Regra obrigatória

`despesas?ano=2025` deixa de ser válido para o consolidado.  
O correto passa a ser:

```text
despesas?ano_letivo_id=<uuid>
```

ou

```text
despesas?from=YYYY-MM-DD&to=YYYY-MM-DD
```

com `from/to` derivados do ano letivo.

### Implementação atual do recorte

Na Fase 1 foi introduzido um resolvedor único:

- `resolveAnoLetivoScope(supabase, escolaId, { anoLetivoId, ano })`

Esse helper:

- resolve `anos_letivos.id`
- devolve `ano`, `data_inicio`, `data_fim`
- permite fallback controlado para ano civil quando ainda não existir `ano_letivo_id`

Uso atual:

- `propinas/route.ts`
- `captacao/route.ts`
- `despesas/route.ts`
- `resumo/route.ts`

## Contrato das APIs

## Contratos já implementados

### 1. `GET /api/financeiro/relatorios/resumo`

Uso:

- KPIs do topo

Parâmetros:

- `escolaId`
- `ano_letivo_id`

Resposta:

```json
{
  "ok": true,
  "anoLetivo": 2025,
  "anoLetivoId": "uuid",
  "periodo": {
    "inicio": "2025-09-01",
    "fim": "2026-07-31"
  },
  "resumo": {
    "mensalidades": 0,
    "emAtraso": 0,
    "pagasAdiantadas": 0,
    "parciais": 0,
    "previsto": 0,
    "pago": 0,
    "pagoAdiantado": 0,
    "parcialEmAberto": 0,
    "atraso": 0,
    "despesasTotal": 0,
    "entradasTotal": 0,
    "saldoAnterior": 0,
    "saldoPeriodo": 0,
    "saldoAcumulado": 0,
    "taxaAtrasoPct": 0
  }
}
```

### 2. `GET /api/financeiro/relatorios/propinas`

Parâmetros implementados:

- `escolaId`
- `ano_letivo_id`
- fallback legado `ano`

Resposta adicional introduzida na Fase 1:

- `anoLetivoId`
- `periodo`

### 3. `GET /api/financeiro/relatorios/captacao`

Uso:

- tabela mensal por classe

Parâmetros:

- `escolaId`
- `ano_letivo_id`
- `mes_ref` opcional

Resposta:

```json
{
  "ok": true,
  "items": [
    {
      "mesRef": "2025-09-01",
      "classeId": "uuid",
      "classeLabel": "7ª Classe",
      "matriculasQtd": 10,
      "matriculasTotal": 12000,
      "confirmacoesQtd": 8,
      "confirmacoesTotal": 9600,
      "cartaoQtd": 18,
      "cartaoTotal": 9000,
      "bolsistasQtd": 2,
      "inscritosTotal": 40
    }
  ]
}
```

Parâmetros implementados:

- `escolaId`
- `ano_letivo_id`
- fallback legado `ano`

Resposta adicional introduzida na Fase 1:

- `anoLetivoId`
- `periodo`

### 4. `GET /api/financeiro/relatorios/despesas`

Parâmetros implementados:

- `escolaId`
- `ano_letivo_id`
- fallback legado `ano`

Resposta adicional introduzida na Fase 1:

- `anoLetivo`
- `anoLetivoId`
- `periodo`

Comportamento novo:

- quando `ano_letivo_id` é fornecido, o filtro usa `data_inicio` e `data_fim` do ano letivo

## Contratos previstos para próximas fases

### 5. `GET /api/financeiro/relatorios/escolar/inadimplencia-classe`

Uso:

- bloco “propinas não pagas”

Parâmetros:

- `escolaId`
- `ano_letivo_id`
- `mes_ref` opcional

### 6. `GET /api/financeiro/relatorios/escolar/fluxo-mensal`

Uso:

- fechamento mensal

Parâmetros:

- `escolaId`
- `ano_letivo_id`

### 7. `GET /api/financeiro/relatorios/escolar/full`

Uso:

- carregar a página com um request orquestrado

Resposta:

- `resumo`
- `captacao`
- `propinas`
- `inadimplenciaClasse`
- `despesas`
- `fluxoMensal`

Observação:

- internamente, este endpoint pode chamar os read models diretamente
- não deve recomputar o que já existe em `propinas/route.ts`

## Backlog SQL

### Fase SQL-1

- criar `mv_relatorio_financeiro_escolar_resumo`
- criar `mv_relatorio_financeiro_escolar_capitacao_mensal`
- criar `mv_relatorio_financeiro_escolar_inadimplencia_classe`
- criar `mv_relatorio_financeiro_escolar_fluxo_mensal`

### Fase SQL-2

- criar `UNIQUE INDEX` em todas as MVs
- criar funções `refresh_mv_*`
- criar `cron.schedule(...)`
- criar wrappers `vw_*` públicos com `security_invoker = true`

### Fase SQL-3

- validar filtros por escola
- validar dependência de `anos_letivos`
- documentar estratégia de backfill `2024-2025`

## Backlog API

### Fase API-1 [CONCLUÍDA]

- criar helper de recorte temporal por ano letivo
- adaptar `propinas` para aceitar `ano_letivo_id`
- adaptar `captacao` para aceitar `ano_letivo_id`
- adaptar `despesas` para cortar pelo intervalo real da sessão
- criar `/api/financeiro/relatorios/resumo`

Evidência técnica:

- [apps/web/src/lib/financeiro/resolveAnoLetivoScope.ts](/Users/gundja/moxi-edtech/apps/web/src/lib/financeiro/resolveAnoLetivoScope.ts)
- [apps/web/src/app/api/financeiro/relatorios/resumo/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/resumo/route.ts)
- [apps/web/src/app/api/financeiro/relatorios/propinas/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/propinas/route.ts)
- [apps/web/src/app/api/financeiro/relatorios/captacao/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/captacao/route.ts)
- [apps/web/src/app/api/financeiro/relatorios/despesas/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/despesas/route.ts)

### Fase API-2

Status: concluída no código local

- criar `/api/financeiro/relatorios/inadimplencia-classe`
- criar `/api/financeiro/relatorios/fluxo-mensal`
- integrar ambos os blocos na página consolidada
- adaptar exportadores `CSV/XLSX` para incluir `fluxo mensal` e `inadimplência por classe`

Evidência técnica:

- [supabase/migrations/20270526120000_relatorio_financeiro_escolar_phase2_mvs.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270526120000_relatorio_financeiro_escolar_phase2_mvs.sql)
- [apps/web/src/app/api/financeiro/relatorios/fluxo-mensal/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/fluxo-mensal/route.ts)
- [apps/web/src/app/api/financeiro/relatorios/inadimplencia-classe/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/inadimplencia-classe/route.ts)
- [apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx](/Users/gundja/moxi-edtech/apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx)

Pendência desta fase:

- criar `/api/financeiro/relatorios/escolar/full`

### Fase API-3

- manter compatibilidade transitória com `/api/financeiro/relatorios/propinas`
- manter `cache: 'no-store'` e `dynamic = 'force-dynamic'`

## Backlog UI

### UI-1 — Reestruturação da página

Substituir a atual experiência por cinco seções:

- Resumo Executivo
- Captação
- Propinas
- Despesas e Resultado
- Fechamento Mensal

### UI-2 — Filtros

Filtros mínimos:

- sessão / ano letivo
- mês
- classe
- turma

### UI-3 — Tabelas novas

Adicionar:

- tabela de captação por classe
- tabela de propinas não pagas por classe
- tabela de fechamento mensal

Status:

- captação por classe: implementada
- propinas não pagas por classe: implementada via bloco `Inadimplência por classe`
- fechamento mensal: implementado via bloco `Fluxo mensal`

### UI-4 — Drill-down

Deep-links:

- `Propinas`
- `Fluxo de Caixa`
- `Radar de Inadimplência`

### UI-5 — Exportação executiva

Novo Excel/PDF com:

- branding
- período
- KPIs principais
- captação
- propinas não pagas
- fluxo mensal

## Sequência recomendada

### Fase 1

Status: concluída

Entregue:

- helper único de `ano letivo -> período`
- recorte por ano letivo nas APIs atuais
- endpoint `resumo`
- adaptação da página para consumir `ano_letivo_id`

Evidência técnica:

- [apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx](/Users/gundja/moxi-edtech/apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx)

### Fase 2

Status: implementada no código local

Entregue:

- MV de fluxo mensal
- MV de inadimplência por classe
- wrappers públicos `vw_*`
- funções `refresh_mv_*`
- cron de refresh
- endpoints de leitura
- integração dos dois blocos na página consolidada

Evidência técnica:

- [supabase/migrations/20270526120000_relatorio_financeiro_escolar_phase2_mvs.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270526120000_relatorio_financeiro_escolar_phase2_mvs.sql)
- [apps/web/src/app/api/financeiro/relatorios/fluxo-mensal/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/fluxo-mensal/route.ts)
- [apps/web/src/app/api/financeiro/relatorios/inadimplencia-classe/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/inadimplencia-classe/route.ts)
- [apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx](/Users/gundja/moxi-edtech/apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx)

Pendências:

- futura orquestração do endpoint `/api/financeiro/relatorios/escolar/full`
- eventual validação visual browser-side após deploy com dados autenticados

### Fase 3

- criar MV de captação mensal
- substituir a lógica ad hoc de captação
- consolidar bolsistas e cartão

### Fase 4

- exportação executiva
- histórico/importação `2024-2025`
- comparação mês contra mês

## Critérios de aceite

### Produto

- a página deixa de parecer “relatório de mensalidades”
- a direção consegue responder entradas, saídas, saldo e atraso sem recorrer à planilha

### Dados

- todas as consultas respeitam o intervalo do ano letivo
- os totais de propinas continuam vindo das views oficiais existentes
- saídas e saldo deixam de depender de ano civil

### Arquitetura

- nenhum endpoint novo recalcula `previsto/pago/atraso` diretamente de `mensalidades` se a `vw_` já cobre
- todos os novos consolidadores operam sobre read models com refresh controlado

### Operação

- exportação gera um artefato reconhecível pela gestão
- ausência de histórico `2024-2025` fica explícita até existir backfill

## Não fazer

- não copiar o layout literal da planilha
- não criar uma aba por mês
- não duplicar `vw_financeiro_propinas_mensal_escola`
- não usar `ano` civil como eixo principal
- não esconder a lacuna histórica do CAC

## Recomendação final

O caminho correto é evoluir `mensal-escolar` para um consolidado executivo, preservando os relatórios especialistas e adicionando só os read models que faltam.

Resumo:

- manter propinas como base oficial de cobrança
- mover o relatório para ano letivo real
- criar MVs de resumo, fluxo mensal, captação e inadimplência por classe
- refazer a UI como relatório financeiro escolar, não como relatório de mensalidades
