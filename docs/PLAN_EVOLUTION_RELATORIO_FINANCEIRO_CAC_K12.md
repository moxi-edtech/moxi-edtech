# Plano — Evolução do Relatório Financeiro Escolar no KLASSE

Data: 2026-05-19
Escopo: K12 / Financeiro / Secretaria
Objetivo: absorver o que há de útil no ficheiro `RELATÓRIO FINANCEIRO CAC 2024-2025.xlsx` sem duplicar lógica, relatórios, views ou materialized views já existentes no KLASSE.

## 1. Validação do que já existe

Antes de propor qualquer evolução, foi validado o estado actual do produto e das fontes de dados.

### 1.1 Superfícies já existentes no portal

Em [apps/web/src/app/escola/[id]/(portal)/financeiro/relatorios/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/escola/[id]/(portal)/financeiro/relatorios/page.tsx) já existem:

- `Propinas`
- `Fluxo de Caixa`
- `Pagamentos por Status`
- `Extratos de Alunos`
- `Relatórios Detalhados`

Conclusão:
- não faz sentido criar um relatório novo que replique `Propinas` ou `Fluxo de Caixa`
- o caminho correcto é criar uma camada consolidada acima deles

### 1.2 Lógica já existente que deve ser reaproveitada

#### A. Propinas por período e por turma

Já existe uma API específica em [apps/web/src/app/api/financeiro/relatorios/propinas/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/propinas/route.ts), consumindo:

- `public.vw_financeiro_propinas_mensal_escola`
- `public.vw_financeiro_propinas_por_turma`

Essa API já entrega:

- série mensal
- previsto
- pago
- pago adiantado
- parciais
- saldo parcial
- atraso
- inadimplência %
- ranking por turma

Conclusão:
- o futuro relatório escolar consolidado não deve recalcular propinas do zero
- deve reutilizar esta mesma base como secção de `Previsto x Realizado`

#### B. Fluxo de caixa diário

Já existe uma API em [apps/web/src/app/api/financeiro/relatorios/fluxo-caixa/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/financeiro/relatorios/fluxo-caixa/route.ts), consumindo:

- `public.vw_financeiro_escola_dia`

Ela já entrega:

- dia
- quantidade total
- quantidade paga
- percentagem paga

Conclusão:
- não deve ser refeito como nova lógica paralela
- deve ser evoluído para um nível mais executivo, adicionando valores financeiros quando necessário

#### C. Radar de inadimplência

Já existe um fluxo robusto de inadimplência em:

- [apps/web/src/app/financeiro/_components/RadarInadimplenciaActive.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/financeiro/_components/RadarInadimplenciaActive.tsx)
- `public.vw_radar_inadimplencia`
- refresh function `refresh_mv_radar_inadimplencia`

Conclusão:
- o novo relatório não deve criar uma visão paralela de cobrança
- deve só resumir ou deep-linkar para esse radar quando o corte for `inadimplência`

#### D. Financeiro por turma

Já existe um recorte administrativo por turma em [apps/web/src/app/api/escolas/[id]/admin/turmas/financeiro/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/escolas/[id]/admin/turmas/financeiro/route.ts), também baseado em:

- `public.vw_financeiro_propinas_por_turma`

Conclusão:
- o corte por classe/turma do relatório novo deve reutilizar esse read model
- não deve nascer uma terceira agregação para os mesmos indicadores

### 1.3 Read models / MVs já presentes e relevantes

O inventário confirmou pelo menos estas fontes já disponíveis e aderentes ao problema:

- `public.vw_financeiro_propinas_mensal_escola`
- `public.vw_financeiro_propinas_por_turma`
- `public.vw_financeiro_escola_dia`
- `public.vw_radar_inadimplencia`
- `public.vw_mensalidades_operacional_status_ano_ativo`

Também existem MVs e funções de refresh ligadas a:

- radar de inadimplência
- dashboard de secretaria
- status de matrículas

Conclusão:
- já existe base suficiente para uma primeira versão sem abrir uma nova floresta de MVs

## 2. O que o Excel traz de útil

O ficheiro `RELATÓRIO FINANCEIRO CAC 2024-2025.xlsx` tem valor como modelo de gestão escolar, não como template literal de produto.

### 2.1 Sinais úteis encontrados

#### A. Previsão de arrecadação mensal por classe

Na aba `Total Geral de pagamentos`, aparece o racional:

- número de alunos por classe
- valor da propina
- total previsto

Exemplo:

- `1ª`: `50 x 1200 = 60000`
- `7ª`: `105 x 2100 = 220500`

Valor para o KLASSE:
- isso deve virar um painel automático de `base prevista de arrecadação`

#### B. Matrículas por classe no mês

Nas abas mensais (`AGOSTO-2024`, `SETEMBRO-2024`, etc.) aparece:

- `Classe`
- `QTD`
- `Matrícula`
- `TOTAL`

Valor para o KLASSE:
- faz sentido como recorte de `captação/entrada`

#### C. Confirmações por classe no mês

Nas mesmas abas há um bloco paralelo de `ALUNOS CONFIRMAÇÃO POR CLASSES`.

Valor para o KLASSE:
- isso é um bom indicador de conversão operacional
- conversa diretamente com secretaria/admissões

#### D. Inscritos e bolsistas

Na aba `resumo` há:

- `QTD`
- `BOLSEIROS`
- `TOTAL`

Valor para o KLASSE:
- excelente como leitura institucional por classe

#### E. Entradas, saídas e diferença por mês

Na aba `resumo` há:

- `Entrada`
- `Saída`
- `Diferença`

Valor para o KLASSE:
- isso deve existir como resumo executivo mensal

## 3. O que não deve ser copiado do Excel

Não vale transformar o KLASSE numa reprodução do ficheiro manual.

### Não copiar

- uma aba por mês
- campos textuais manuais como `Luanda aos...`
- assinaturas fixas no núcleo do relatório
- blocos repetidos de mesmo indicador
- cálculo manual de totais
- saldo bancário digitado sem reconciliação/ledger

### Princípio de produto

No KLASSE:

- filtro por sessão e período substitui abas manuais
- read models substituem consolidação artesanal
- PDF executivo é uma saída, não a fonte de verdade

## 4. Lacuna real entre o Excel e o KLASSE

Hoje o sistema já cobre bem:

- propinas
- inadimplência
- fluxo diário
- extratos

Mas ainda não há um `Relatório Financeiro Escolar Consolidado` que una, numa só experiência:

- previsto de arrecadação
- arrecadação realizada
- matrículas do mês
- confirmações do mês
- bolsas/descontos
- entradas
- saídas
- saldo / resultado do período

Essa é a lacuna legítima.

## 5. Direção recomendada

### Nome do novo artefacto

`Relatório Financeiro Mensal Escolar`

### Papel do relatório

Ser a visão executiva da escola por mês/sessão, consolidando:

- captação
- conversão
- cobrança
- arrecadação
- resultado do período

Sem substituir:

- `Relatório de Propinas`
- `Fluxo de Caixa`
- `Radar de Inadimplência`

Esses continuam como relatórios especializados.

## 6. Proposta funcional sem duplicar lógica

### Bloco 1 — Resumo executivo

Reaproveitar / derivar de fontes existentes:

- `Previsto de propinas`
  - fonte: `vw_financeiro_propinas_mensal_escola`
- `Pago no período`
  - fonte: `vw_financeiro_propinas_mensal_escola`
- `Em atraso`
  - fonte: `vw_financeiro_propinas_mensal_escola`
- `Saldo parcial`
  - fonte: `vw_financeiro_propinas_mensal_escola`
- `Taxa de inadimplência`
  - fonte: `vw_financeiro_propinas_mensal_escola`

### Bloco 2 — Captação académica do mês

Novo bloco, mas sem recalcular financeiro.

Indicadores:

- matrículas efectivadas por classe
- confirmações por classe
- total arrecadado em matrícula/confirmação

Fonte recomendada:

- primeiro tentar reaproveitar tabelas/fluxos de admissões + matrículas + pagamentos já existentes
- se a query ficar pesada e recorrente, criar uma `vw_` ou MV própria para este bloco

Observação:
- este é o bloco mais próximo do Excel
- hoje ele ainda não está pronto como read model único

### Bloco 3 — Inscritos e bolsistas por classe

Indicadores:

- inscritos activos por classe
- bolsistas por classe
- total por classe

Fonte recomendada:

- alunos/matrículas/classes
- regras de bolsa ou desconto se já existirem no financeiro

Observação:
- se `bolseiro` ainda não estiver modelado de forma estável, este bloco deve entrar depois

### Bloco 4 — Resultado financeiro mensal

Indicadores:

- entradas
- saídas
- diferença do mês
- saldo acumulado

Reaproveitar:

- `Fluxo de Caixa`
- `financeiro_ledger` / fecho / lançamentos, onde já houver fonte confiável

Observação:
- esse bloco deve ser baseado em ledger ou fecho, não em planilha manual

### Bloco 5 — Ranking por classe / turma

Reaproveitar:

- `vw_financeiro_propinas_por_turma`

Indicadores:

- mensalidades
- em atraso
- saldo parcial
- total em atraso
- inadimplência %

Observação:
- aqui vale exibir filtros por `classe`, `turno`, `curso`, mas sem recomputar a base

## 7. Estrutura técnica recomendada

### 7.1 O que reaproveitar directamente

- manter `propinas` como fonte oficial do bloco de cobrança
- manter `fluxo-caixa` como base do bloco de entradas/ritmo
- manter `radar` como drill-down de inadimplência
- manter `vw_financeiro_propinas_por_turma` como recorte por turma

### 7.2 O que merece novo read model

Criar apenas se necessário:

- `captação mensal por classe`
  - matrículas do mês
  - confirmações do mês
  - valor de matrícula/confirmação

Possível nome:

- `internal.mv_financeiro_captacao_mensal_classe`
- wrapper: `public.vw_financeiro_captacao_mensal_classe`

Só criar esse novo read model se a query operacional ficar pesada ou se o painel passar a ser recorrente.

### 7.3 O que não fazer

- não criar uma nova MV que replique `vw_financeiro_propinas_mensal_escola`
- não criar uma nova MV que replique `vw_financeiro_propinas_por_turma`
- não calcular `previsto/pago/atraso` diretamente de `mensalidades` numa tela nova se a `vw_` já atende

## 8. Fases de implementação

### P1 — Consolidado sem novo MV (CONCLUÍDO)

Entregar uma nova página `Relatório Financeiro Mensal Escolar` com:

- resumo executivo
- bloco de propinas reaproveitado
- ranking por turma/classe
- links para `Propinas`, `Fluxo de Caixa` e `Radar`

**Evidência Técnica:**
- Página: `apps/web/src/app/escola/[id]/(portal)/financeiro/relatorios/mensal-escolar/page.tsx`
- Link no menu: `apps/web/src/app/escola/[id]/(portal)/financeiro/relatorios/page.tsx`

### P2 — Bloco de captação mensal (CONCLUÍDO)

Adicionar:

- matrículas por classe no mês
- confirmações por classe no mês
- total de arrecadação dessas entradas

**Evidência Técnica:**
- API: `apps/web/src/app/api/financeiro/relatorios/captacao/route.ts`
- Consumo: Integrado na página de relatório mensal.

### P3 — Bolsistas + leitura institucional (CONCLUÍDO)

Adicionar:

- inscritos activos por classe
- bolsistas por classe
- total por classe

**Evidência Técnica:**
- Lógica de detecção de bolsista baseada em `percentagem_desconto > 0` ou `motivo_desconto`.
- Exibição em tabela dedicada "Inscritos e Bolsistas" no relatório mensal.

### P4 — PDF executivo (PARCIAL/PRINT)

Gerar saída em PDF/Excel com:

- branding da escola
- sessão académica
- filtros aplicados
- resumo financeiro
- tabelas principais

**Status:**
- Implementado via `window.print()` com estilos CSS específicos (`@media print`) para garantir formatação executiva.
- Próximo passo (Opcional): Geração via `createInstitutionalPdf` no lado do servidor se necessário envio por e-mail automático.

## 9. Critérios para não duplicar lógica

Toda implementação futura deste plano deve obedecer:

1. Se o dado já existe em `vw_financeiro_propinas_*`, não recalcular em rota nova.
2. Se o dado já existe em `vw_financeiro_escola_dia`, não abrir outra fonte para o mesmo indicador diário.
3. Se o objectivo é drill-down de cobrança, deep-linkar para `Radar`, não recriar o radar.
4. Novo read model só entra para `captação mensal` ou `bolsistas`, se a fonte actual não for suficiente.
5. A nova página deve ser consolidada, não concorrente com os relatórios actuais.

## 10. Recomendação final

O melhor caminho para o KLASSE não é copiar o Excel do CAC.

O melhor caminho é:

- reaproveitar os relatórios e views que já existem
- adicionar uma nova visão consolidada executiva
- criar no máximo um novo read model para `captação mensal por classe`
- deixar `propinas`, `fluxo` e `radar` como especialistas

Resumo:

- copiar o conceito: sim
- copiar o formato da planilha: não
- duplicar lógica existente: não
- consolidar em camada executiva: sim
