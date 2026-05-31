# Relatório Comparativo — CAC 2024-2025 vs `/secretaria/relatorios/mensal-escolar`

Data: 2026-05-26  
Repo commit analisado: `b04cda0f`

## Objetivo

Comparar a planilha `RELATÓRIO FINANCEIRO CAC 2024-2025.xlsx`, localizada em `~/Downloads`, com a implementação atual de `/secretaria/relatorios/mensal-escolar` e registrar um plano de evolução funcional e técnica.

## Fontes analisadas

- Planilha: `~/Downloads/RELATÓRIO FINANCEIRO CAC 2024-2025.xlsx`
- Página secretaria:
  - [apps/web/src/app/escola/[id]/(portal)/secretaria/(portal-secretaria)/relatorios/mensal-escolar/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/escola/[id]/(portal)/secretaria/(portal-secretaria)/relatorios/mensal-escolar/page.tsx)
- Página financeiro:
  - [apps/web/src/app/escola/[id]/(portal)/financeiro/relatorios/mensal-escolar/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/escola/[id]/(portal)/financeiro/relatorios/mensal-escolar/page.tsx)
- Cliente compartilhado:
  - [apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx](/Users/gundja/moxi-edtech/apps/web/src/components/secretaria/RelatorioMensalidadesClient.tsx)
- APIs usadas pela tela:
  - [apps/web/src/app/api/financeiro/relatorios/propinas/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/propinas/route.ts)
  - [apps/web/src/app/api/financeiro/relatorios/captacao/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/captacao/route.ts)
  - [apps/web/src/app/api/financeiro/relatorios/despesas/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/despesas/route.ts)
  - [apps/web/src/app/api/secretaria/school-sessions/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/secretaria/school-sessions/route.ts)

## Resumo executivo

A implementação atual entrega um relatório de mensalidades com extensões de captação e despesas. A planilha histórica do CAC representa algo maior: um relatório financeiro escolar operacional, com leitura mensal por competência e com separação explícita entre matrículas, confirmações, cartão, propinas em atraso, arrecadação mensal e saldo consolidado.

Em termos práticos:

- A tela atual está boa para leitura de propinas.
- A planilha está mais próxima da rotina da secretaria e da direção.
- O nome `mensal-escolar` hoje promete mais do que o produto efetivamente entrega.
- O banco remoto do CAC não preserva o histórico `2024-2025` da planilha; os dados ativos encontrados estão concentrados no ciclo `2025-2026`.

## Estado atual da implementação

Desde a análise inicial, a tela evoluiu materialmente e hoje cobre uma parte relevante do modelo operacional da planilha:

- resumo consolidado por `ano_letivo_id`
- fluxo mensal
- inadimplência por classe
- captação por classe
- despesas e resultado do período
- `Quick View` mensal com filtro visual
- modo diretoria
- drill-down contextual
- insights automáticos
- exports `CSV`, `XLSX` e `PDF` atualizados

Arquiteturalmente, a UI também deixou de concentrar toda a lógica num único ficheiro:

- `useFinanceInsights`
- `useFinancialHealthInsights`
- `QuickViewTimeline`
- `FinanceInsightsPanel`
- `FinancialHealthInsightsPanel`
- `BoardExecutivePanel`
- `BoardPressurePanel`

Em termos práticos, o produto já não é apenas um relatório analítico de propinas. Ainda não replica a planilha CAC por completo, mas já opera como um consolidado financeiro escolar intermédio.

## O que a tela atual entrega

O componente `RelatorioMensalidadesClient` agora consolida seis grupos principais:

1. Resumo de propinas
- previsto
- pago
- em atraso
- pagas adiantadas
- parciais
- saldo parcial
- taxa de atraso

2. Série mensal de propinas
- quantidade de mensalidades
- volume previsto
- volume pago
- atraso
- inadimplência

3. Ranking por turma
- turma
- classe
- turno
- atraso
- pagamentos parciais
- adiantamentos

4. Blocos auxiliares
- captação por classe
- inscritos e bolsistas
- despesas do ledger
- saldo simples do período

5. Fechamento e operação
- fluxo mensal
- inadimplência por classe
- recorte por mês dentro do ano letivo

6. Camada executiva
- `Quick View` por competência
- modo diretoria
- score de saúde
- benchmark de turmas
- insights automáticos com CTA contextual

## O que a planilha CAC 2024-2025 entrega

A planilha contém múltiplas abas mensais e consolidadas, incluindo:

- `AGOSTO-2024`
- `SETEMBRO-2024`
- `OUTUBRO-2024`
- `NOVEMBRO-2024`
- `DEZEMBRO-2024`
- `JANEIRO 2025`
- `MAIO 2025`
- `resumo`
- `Total Geral de pagamentos`

### Padrão funcional observado nas abas mensais

As abas mensais repetem blocos de negócio:

1. Matrículas por classe
- quantidade por classe
- valor unitário
- total arrecadado

2. Confirmações por classe
- quantidade por classe
- valor unitário
- total arrecadado

3. Cartão
- valor agregado de cartão

4. Total geral de entrada
- soma de matrícula + cartão + confirmação

5. Propinas em atraso ou não pagas
- quantidade por classe
- valor unitário
- total por classe

6. Arrecadação mensal
- matriz por classe
- linhas por mês/competência
- total consolidado por linha e por coluna

### Padrão funcional observado no resumo

A aba `resumo` concentra:

- alunos inscritos por classe
- bolsistas por classe
- saldo anterior
- entrada por mês
- saída por mês
- diferença por mês
- total no banco

## Diferenças principais

### 1. Escopo do produto

A tela atual é um relatório de propinas com alguns complementos.  
A planilha é um relatório financeiro escolar consolidado.

### 2. Modelo mental do utilizador

A secretaria/direção trabalha com:

- entradas por tipo
- atraso por classe
- visão mês a mês
- comparação de entradas e saídas
- saldo acumulado

A tela atual trabalha com:

- indicadores financeiros agregados
- lista por turma
- exportações técnicas

### 3. Granularidade operacional

A planilha separa claramente:

- matrícula
- confirmação
- cartão
- propina

A tela atual não trata esses quatro grupos como primeira classe do produto.

### 4. Fechamento mensal

A planilha já embute uma lógica de fechamento operacional por mês.  
A tela atual mostra uma leitura analítica, mas não um fechamento mensal institucional.

## Achados no banco remoto

Conexão analisada:

```text
postgresql://postgres.wjtifcpxxxotsbmvbgoq:MoxinexaDB2025@aws-1-eu-north-1.pooler.supabase.com:6543/postgres
```

Escola identificada:

- `3744879f-2e19-4671-8995-78604302d8c5`
- `COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME`

### Estado encontrado

1. `anos_letivos`
- existe apenas o ano letivo `2025`
- `data_inicio = 2025-09-01`
- `data_fim = 2026-07-31`

2. Read models de propinas
- `internal.mv_financeiro_propinas_mensal_escola`: 11 linhas, todas em `2025`
- `internal.mv_financeiro_propinas_por_turma`: 15 linhas, todas em `2025`

3. Dados base
- `mensalidades`: 5.918 registros
- intervalo encontrado: `2025` a `2026`

4. View operacional existente
- `vw_mensalidades_operacional_status_ano_ativo`
- escola com:
  - `pago = 907`
  - `inadimplente = 1245`

### Conclusão sobre dados

O banco remoto atual não permite reconstituir fielmente a planilha `2024-2025`.  
O sistema hoje parece operar sobre um ciclo posterior, `2025-2026`, enquanto a planilha representa um histórico anterior.

## Riscos e limitações da implementação atual

### 1. Histórico ainda incompleto

O problema principal remanescente já não é o recorte temporal e sim o histórico.

Impacto:

- a planilha `2024-2025` não pode ser reconstituída fielmente
- comparações retroativas continuam dependentes de backfill ou importação

### 2. Dependência parcial de lógica ad hoc em captação

O produto já ganhou read models de fluxo mensal e inadimplência por classe, mas captação ainda não passou por MV dedicada.

Impacto:

- a consistência de captação ainda depende de evolução adicional
- bolsistas e cartão ainda não estão consolidados no mesmo nível das demais secções

### 3. Nome ainda desalinhado

`Relatório Mensal Escolar` sugere uma visão institucional completa, mas o que existe é majoritariamente um relatório de mensalidades.

### 4. Orquestração backend ainda fragmentada

Hoje a tela já está muito mais organizada no frontend, mas ainda consulta múltiplos endpoints especializados.

Impacto:

- a composição final ainda acontece no cliente
- um endpoint consolidado `/full` continua desejável

## Recomendações de evolução

## 1. Reposicionar o produto

Renomear conceitualmente a funcionalidade para:

- `Relatório Financeiro Escolar`

E tratar `Mensalidades` como um sub-bloco, não como o relatório inteiro.

## 2. Reestruturar a UI em blocos de gestão

Sugestão de estrutura:

1. Visão Geral
- entradas totais
- saídas totais
- saldo do período
- saldo acumulado
- inadimplência

2. Captação
- matrículas
- confirmações
- cartão
- bolsistas

3. Propinas
- previsto vs realizado
- atraso por classe
- arrecadação por competência

4. Despesas
- saídas por categoria
- comparação por mês

5. Fechamento
- resumo mensal
- exportação executiva

## 3. Corrigir o eixo temporal

Trocar o filtro por `ano` em favor de:

- `data_inicio` e `data_fim` do `ano_letivo`
- ou um `session_id`/`ano_letivo_id` consistente em todos os agregados

Isso é especialmente importante para despesas e saldo.

## 4. Criar read models dedicados

Sugestão mínima:

- `internal.mv_relatorio_financeiro_escolar_resumo`
- `internal.mv_relatorio_financeiro_escolar_capitacao_mensal`
- `internal.mv_relatorio_financeiro_escolar_inadimplencia_classe`
- `internal.mv_relatorio_financeiro_escolar_fluxo_mensal`

Wrappers públicos:

- `public.vw_relatorio_financeiro_escolar_resumo`
- `public.vw_relatorio_financeiro_escolar_capitacao_mensal`
- `public.vw_relatorio_financeiro_escolar_inadimplencia_classe`
- `public.vw_relatorio_financeiro_escolar_fluxo_mensal`

## 5. Reproduzir os blocos fortes da planilha

Vale migrar para o produto:

- total de entradas por tipo
- propinas não pagas por classe
- consolidado mensal
- saldo anterior + saldo do mês + saldo acumulado
- inscritos e bolsistas por classe

Não vale reproduzir:

- layout rígido de aba manual
- fórmulas frágeis com `#REF!` e `#VALUE!`
- consolidações feitas na mão

## 6. Fechar o gap histórico

Há duas alternativas:

1. Importar o histórico `2024-2025` para o modelo oficial
2. Assumir formalmente que o sistema só responde a partir de `2025-09-01`

Sem essa decisão, sempre haverá divergência entre planilha e sistema.

## Prioridades sugeridas

### Concluído

- recorte por ano letivo nas APIs
- resumo executivo real
- MV de fluxo mensal
- MV de inadimplência por classe
- PDF/Excel atualizados
- experiência executiva e assistida na UI

### Próximo ciclo

- MV de captação mensal
- endpoint consolidado `/api/financeiro/relatorios/escolar/full`
- filtros por classe e turma
- branding executivo mais forte nas exportações

### Estrutural

- importação ou backfill de `2024-2025`
- comparação mês contra mês com base histórica confiável
- previsão vs realizado com read model dedicado

## Veredito

O produto já passou da fase de “boa base analítica para propinas” e entrou numa fase de consolidado financeiro escolar funcional.

Hoje ele já cobre:

- leitura executiva
- fechamento mensal
- atraso por classe
- resultado do período
- navegação operacional com CTA

O que impedia a substituição plena da planilha CAC foi resolvido neste ciclo:

- captação ganhou read model dedicado (`mv_relatorio_financeiro_escolar_capitacao_mensal`).
- consolidado backend único implementado via endpoint orquestrador (`/full`).
- UX "Excel-like" implementada com Abas e Matrizes Pivot para as classes.
- Drill-down Universal adicionado, permitindo que a direção visualize alunos inadimplentes (e contactos de encarregados) com um simples clique numa célula da matriz.

A única lacuna estrutural que resta é a:
- lacuna histórica `2024-2025` (necessidade de importação de legados).

Com as implementações recentes, a tela já serve integralmente para gestão corrente de elite, reduzindo quase a zero a dependência do histórico manual da direção para o ciclo letivo atual.
