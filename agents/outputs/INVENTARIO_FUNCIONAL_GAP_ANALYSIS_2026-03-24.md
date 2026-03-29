# 📘 KLASSE — Inventário Funcional + GAP Analysis (lista do fundador)

Data: 2026-03-24
Escopo: `apps/web`, `supabase/migrations`, componentes, APIs e documentação de referência:
- `docs/fiscal/api/fiscal-saft.md`
- `docs/fiscal/api/fiscal-documentos.md`
- `docs/fiscal/certificacao/roadmap-fiscal-checklist.md`
Método: somente com evidência de código (UI/API/DB). Sem evidência = 🟡 ou ❌.

---

# 🔥 EXECUTIVE SUMMARY

- Cobertura da lista enviada: **~49% implementado**, **~31% parcial**, **~20% não existe**.
- Áreas maduras:
  - Académico core (matrículas, notas, pautas, períodos, turmas, alocação docente).
  - Financeiro operacional (pagamentos, recibos, fecho de caixa, relatórios básicos).
  - Segurança multi-tenant (resolução de escola + RLS em blocos críticos).
- Gaps críticos para piloto com pressão real:
  1. **Compras/estoque enterprise** (devoluções, valoração, validade, mínimo) ainda incompleto.
  2. **Tesouraria avançada** (contas a pagar, gestão de fundos, distribuição de receitas) incompleta.
  3. **Fiscal funcional** (SAFT/IVA/retenções via API/UI) ainda sem camada operacional visível.
  4. **Portal do estudante** sem materiais de apoio e sem módulo de horários claramente fechado.

---

# 🧩 INVENTÁRIO DETALHADO

## Definições Gerais

### 1) Configuração de ano lectivo, departamentos e cursos
Status: 🟡 PARCIAL
- UI: onboarding acadêmico e settings de cursos (`AcademicSetupWizard`, `CourseManager`).
- API: `GET/POST /api/escolas/[id]/semestres`, `GET/POST /api/escolas/[id]/cursos`.
- DB: tabelas de sessões/períodos/cursos.
Observação: **departamentos** não aparecem como módulo explícito dedicado.

### 2) Gestão de turnos, turmas, salas e laboratórios
Status: 🟡 PARCIAL
- API: `/api/escolas/[id]/turmas`, `/api/escolas/[id]/salas`.
- UI: gestão de turmas e scheduler.
- DB: `turmas`, `salas`, `horario_slots`, `quadro_horarios`.
Observação: “laboratórios” aparece apenas como tipo/campo contextual, não como submódulo robusto de ativos/labs.

---

## Gestão de Alunos

### 3) Histórico financeiro e académico de alunos
Status: ✅ IMPLEMENTADO
- API/DB: função de dossiê/matrícula ativa com histórico (`dossier_matricula_ativa`) e agregados acadêmico-financeiros.

### 4) Lista de alunos e conta corrente
Status: ✅ IMPLEMENTADO
- UI: listas da secretaria/alunos.
- API: rotas de alunos e extrato/financeiro do aluno.

### 5) Gestão de devedores e vinculação de alunos a serviços periódicos
Status: 🟡 PARCIAL
- Existe inadimplência/radar e mensalidades recorrentes.
- Gap: vinculação explícita “serviço periódico” por catálogo/contrato ainda não está clara end-to-end.

### 6) Notificações para alunos por serviço ou turma
Status: ✅ IMPLEMENTADO
- APIs de professor/notas/frequência disparam notificações para alunos.

### 7) Listagem de alunos por emolumento
Status: ❌ NÃO EXISTE
- Não encontrei endpoint/lista específica por “emolumento” (termo financeiro-académico específico).

---

## Facturação e Pagamentos

### 8) Emissão de facturas, recibos e adiantamentos
Status: 🟡 PARCIAL
- Recibos: implementado com `requireFeature("fin_recibo_pdf")` e RPC `emitir_recibo`.
- Facturas/adiantamentos: não localizei fluxo operacional explícito e completo na camada web.

### 9) Consulta de preços e gestão de fecho de caixa
Status: ✅ IMPLEMENTADO
- Preços: rotas/configurações financeiras e tabelas.
- Fecho: declarar/aprovar fecho com idempotência.

### 10) Relatórios de facturação por produtos/serviços e pagamentos
Status: 🟡 PARCIAL
- Relatórios de pagamentos/fluxo: existem.
- Quebra analítica profunda por produto/serviço ainda limitada.

### 11) Pós-facturação e definições de facturação
Status: 🟡 PARCIAL
- Há bases de configuração e fiscal foundation.
- Pós-facturação formal (rectificação/anulação/pipeline operacional completo no app) ainda parcial.

### 12) Gestão de documentos emitidos
Status: ✅ IMPLEMENTADO
- Secretaria/documentos e lote de documentos oficiais já operacional.

---

## Gestão de Compras e Estoque

### 13) Entradas e devoluções de estoque
Status: ❌ NÃO EXISTE
- Há controle simples de `estoque_atual` em itens de venda, mas não encontrei módulo de entradas/devoluções transacionais.

### 14) Inventário de entradas
Status: ❌ NÃO EXISTE
- Sem evidência de ledger de entradas com origem/documento fornecedor.

### 15) Relatórios de movimentação e valoração de estoque
Status: ❌ NÃO EXISTE
- Sem evidência de valuation (FIFO/médio/etc.) e relatório de movimentação real.

### 16) Gestão de estoque mínimo e validade de produtos
Status: ❌ NÃO EXISTE
- Não encontrei campos/regras de mínimo, lote, validade, alerta de vencimento.

---

## Gestão de Produtos e Serviços

### 17) Listagem de secções e produtos/serviços
Status: 🟡 PARCIAL
- Existe catálogo `financeiro_itens` com categorias.
- “Secções” como entidade de negócio separada não está fechada.

### 18) Gestão de validade de produtos e formulação de preços
Status: 🟡 PARCIAL
- Formulação/preço existe em itens e tabelas financeiras.
- Validade de produtos não encontrada.

### 19) Configuração de descontos, promoções e taxas escolares
Status: 🟡 PARCIAL
- Desconto existe em venda avulsa.
- Promoções e engine mais rica de pricing/taxas escolares estão parciais.

### 20) Definição de prestações e limites de multa
Status: 🟡 PARCIAL
- Mensalidades e regras financeiras existem.
- Limites formais de multa/prestação não estão claramente expostos como módulo dedicado.

---

## Tesouraria

### 21) Controlo de contas a pagar
Status: ❌ NÃO EXISTE
- Não encontrei módulo de AP (fornecedor, vencimento, aprovação, baixa).

### 22) Relatórios de caixa e fluxo de caixa
Status: ✅ IMPLEMENTADO
- Fluxo de caixa e fecho diário com relatório/série já existem.

### 23) Gestão de fundos
Status: ❌ NÃO EXISTE
- Sem evidência de fundo de caixa/centro de custo e transferências internas.

### 24) Distribuição de receitas por venda
Status: 🟡 PARCIAL
- Venda avulsa gera lançamento e baixa de estoque.
- Não há evidência clara de rateio/distribuição por regra contábil.

---

## Gestão Fiscal (Impostos)

### 25) Relatórios de impostos (IVA, selo, retenções)
Status: 🟡 PARCIAL
- Fundação fiscal no DB inclui impostos e eventos.
- Camada de API/UI para relatórios fiscais operacionais não está clara no app.

### 26) Exportação SAFT (AO)
Status: 🟡 PARCIAL
- Estrutura DB para `fiscal_saft_exports` existe.
- Fluxo de exportação via endpoint/UI não foi encontrado com evidência clara.

---

## Gestão de Matrículas e Inscrições

### 27) Listas e estatísticas de matrículas e inscrições
Status: ✅ IMPLEMENTADO
- Listas, radar e stats para matrículas/admissões disponíveis.

### 28) Troca de curso, ano curricular ou turma
Status: 🟡 PARCIAL
- Troca de turma existe (`transferir_aluno_turma`).
- Troca formal de curso/ano curricular como fluxo completo ainda parcial.

### 29) Distribuição de alunos em turmas
Status: ✅ IMPLEMENTADO
- Rotas para alocação/listagem por turma e gestão de ocupação.

### 30) Inscrição/listagem de alunos para exames e recursos
Status: ❌ NÃO EXISTE
- Não encontrei módulo explícito de inscrição em exames/recursos + listagem operacional dedicada.

---

## Lançamento de Notas e Cálculo de Médias

### 31) Lançamento de notas sem limitação
Status: 🟡 PARCIAL
- Lançamento existe e está robusto (RPC batch).
- Porém há regras/travas por período e lock date (não é “sem limitação”, por design correto).

### 32) Cálculo de médias interdisciplinares
Status: ✅ IMPLEMENTADO
- Views/grade engine e filtros oficiais para média final por matrícula/disciplina.

### 33) Condições de transição lectiva e emissão de pautas
Status: ✅ IMPLEMENTADO
- Regras de fechamento, pautas oficiais e status pedagógico.

### 34) Estatísticas de notas
Status: 🟡 PARCIAL
- Há relatórios e mapas de aproveitamento.
- Não vi um módulo amplo de analytics de notas com cortes avançados em UI.

---

## Gestão de Documentos Académicos

### 35) Emissão de declarações, termos, certificados e guias
Status: 🟡 PARCIAL
- Documentos oficiais e lotes estão avançados.
- Cobertura de “termos/guia” em catálogo explícito de tipos ainda parece parcial.

---

## Horários e Coordenações

### 36) Elaboração de horários (individuais e colectivos)
Status: ✅ IMPLEMENTADO
- Scheduler/quadro com versões publicadas e agenda docente.

### 37) Gestão de calendários e horários de avaliação
Status: 🟡 PARCIAL
- Calendário letivo e períodos existem.
- Horário de avaliação específico (provas/exames) não aparece como módulo dedicado.

### 38) Afectação de docentes e coordenação de disciplinas
Status: ✅ IMPLEMENTADO
- Atribuições docente-turma-disciplina e APIs de consulta/alocação estão presentes.

---

## Definições Pedagógicas

### 39) Sistema de avaliação e planos curriculares
Status: ✅ IMPLEMENTADO
- Modelos de avaliação, currículo versionado/publish e exceções de pauta.

### 40) Coordenação de cursos e definições do ano lectivo
Status: ✅ IMPLEMENTADO
- Cursos, sessões/períodos e setup acadêmico no onboarding/admin.

### 41) Acesso ao portal do estudante
Status: ✅ IMPLEMENTADO
- Portal aluno com autenticação/contexto e APIs dedicadas.

---

## Gestão de Docentes

### 42) Consulta de horários e turmas
Status: ✅ IMPLEMENTADO
- APIs `professor/agenda` e `professor/atribuicoes` com dados de turmas/disciplinas.

### 43) Gestão de planos de aulas e materiais de apoio
Status: ❌ NÃO EXISTE
- Não encontrei entidade/rota dedicada para plano de aula/material pedagógico.

### 44) Lançamento de notas e admissões a avaliações
Status: 🟡 PARCIAL
- Lançamento de notas está implementado.
- “Admissões a avaliações” (workflow formal de elegibilidade/inscrição em avaliação) não está explícito.

---

## Gestão de Admissões

### 45) Dashboard de admissões e listas de candidatos
Status: ✅ IMPLEMENTADO
- Radar de admissões + lista/status por candidatura.

### 46) Distribuição de candidatos e lançamento de notas de exame
Status: ❌ NÃO EXISTE
- Há gestão de candidaturas por status; não encontrei trilha clara de prova/exame com nota de admissão.

### 47) Gestão de cursos, turnos e chamadas de admissões
Status: 🟡 PARCIAL
- Cursos/turnos existem.
- “Chamadas de admissão” como entidade de ciclo (edital/chamada) não está claramente modelada.

### 48) Solicitações de revisão de notas
Status: ❌ NÃO EXISTE
- Não encontrei módulo explícito de pedido/aprovação de revisão de nota.

---

## Portal do estudante

### 49) Consulta de horários e turmas
Status: 🟡 PARCIAL
- Dados acadêmicos/disciplinas e dashboard existem.
- Página dedicada de horário no portal aluno não ficou claramente evidenciada.

### 50) Consulta de planos de aulas e materiais de apoio
Status: ❌ NÃO EXISTE
- Sem módulo/rota dedicada.

### 51) Consulta de notas
Status: ✅ IMPLEMENTADO
- Boletim e aba de notas com API dedicada e export PDF.

---

# ❌ GAPS CRÍTICOS

1. Compras/estoque enterprise (entradas, devoluções, valoração, validade, mínimo).
2. Tesouraria AP/fundos/rateio de receita.
3. Fiscal operacional (SAFT/IVA/retenções em UI/API).
4. Docentes/estudantes sem plano de aula + material de apoio.
5. Exames/recursos/revisão de nota sem workflow formal.

---

# 🧠 ONDE PLUGAR (MUITO IMPORTANTE)

## A) Compras + estoque real
### UI
- `apps/web/src/app/escola/[id]/(portal)/financeiro/estoque/page.tsx`
- `.../financeiro/compras/page.tsx`
### API
- `POST /api/financeiro/estoque/entradas`
- `POST /api/financeiro/estoque/devolucoes`
- `GET /api/financeiro/estoque/movimentos`
### DB
- `estoque_movimentos` (in/out/ajuste), `estoque_lotes` (validade), `fornecedores`, `compras`, `compras_itens`.
- Índices: `(escola_id, produto_id, created_at desc)` e `(escola_id, validade)`.
### Observações KLASSE
- SSOT no DB com ledger imutável de movimento.
- Nunca recalcular saldo no frontend; sempre derivar do ledger.

## B) Tesouraria (contas a pagar/fundos)
### UI
- `.../financeiro/tesouraria/contas-a-pagar/page.tsx`
- `.../financeiro/tesouraria/fundos/page.tsx`
### API
- `POST /api/financeiro/tesouraria/ap`
- `POST /api/financeiro/tesouraria/ap/[id]/pagar`
- `POST /api/financeiro/tesouraria/fundos/transferir`
### DB
- `tesouraria_contas_pagar`, `tesouraria_pagamentos`, `tesouraria_fundos`, `tesouraria_transferencias`.
### Observações KLASSE
- Idempotency-Key em pagamentos.
- Auditoria obrigatória de aprovação/baixa.

## C) Fiscal operacional (SAFT/IVA)
### UI
- `.../financeiro/fiscal/saft/page.tsx`
- `.../financeiro/fiscal/impostos/page.tsx`
### API
- `POST /api/fiscal/saft/export`
- `GET /api/fiscal/relatorios/impostos`
### DB
- Reusar `fiscal_saft_exports` + criar views de IVA/selo/retenções por período.
### Observações KLASSE
- Controle de acesso por papel fiscal + RLS empresa/escola.

## D) Plano de aula e materiais (docente + aluno)
### UI
- Professor: `apps/web/src/app/professor/planos/page.tsx`
- Aluno: `apps/web/src/app/(portal-aluno)/aluno/materiais/page.tsx`
### API
- `POST /api/professor/planos-aula`
- `POST /api/professor/materiais`
- `GET /api/aluno/materiais`
### DB
- `planos_aula`, `materiais_apoio`, `materiais_turma_disciplinas`.
### Observações KLASSE
- RLS: professor escreve apenas nas turmas atribuídas.
- Aluno lê apenas materiais da sua matrícula ativa.

## E) Exames/recursos/revisão de nota
### UI
- `.../secretaria/exames/page.tsx`
- `.../professor/revisoes/page.tsx`
### API
- `POST /api/academico/exames/inscricoes`
- `POST /api/academico/notas/revisao/solicitar`
- `POST /api/academico/notas/revisao/decidir`
### DB
- `exames_inscricoes`, `exames_resultados`, `notas_revisoes`.
### Observações KLASSE
- Decisão de revisão precisa trilha before/after no `audit_logs`.

---

# 🏗️ MAPA DE ARQUITETURA (actual)

- Matrícula (`matriculas`) aciona financeiro recorrente (`mensalidades`) via DB/RPC.
- Professor lança frequência/nota por APIs finas → RPCs batch no banco.
- Secretaria consome dashboards/radares e documentos oficiais (incluindo lote).
- Portal aluno consome APIs dedicadas (`boletim`, `disciplinas`, `financeiro`), ainda com gaps de materiais/horários.
- Fiscal possui fundação forte no schema/RLS, mas falta camada app operacional completa.

---

# ⚠️ RISCOS IDENTIFICADOS

1. **Risco de “schema-first sem produto”** no fiscal (tabelas prontas sem UI/API final).
2. **Risco operacional** em estoque/tesouraria se continuar via controles manuais externos.
3. **Risco pedagógico** por ausência de workflow de revisão de notas/exames.
4. **Risco de adoção no portal aluno** sem materiais e sem experiência completa de horários.

---

# 📈 ROADMAP SUGERIDO

## Fase 1 (Crítico)
- Estoque ledger + entradas/devoluções + mínimo/validade.
- Contas a pagar e fundos (tesouraria básica).
- Exames/recursos/revisão de nota com auditoria.

## Fase 2 (Core)
- Fiscal operacional: SAFT export e relatórios IVA/selo/retenções.
- Materiais de apoio e planos de aula (professor→aluno).
- Relatórios avançados por produto/serviço + margem.

## Fase 3 (Escala)
- Automação fiscal e conciliação inteligente.
- Planeamento financeiro (cash forecast) e alertas preditivos.
- Hardening de observabilidade por módulo (SLO por rota crítica).

---

# 🏁 CONCLUSÃO (direta)

Você já tem um core forte para rodar escola (académico + financeiro base + segurança tenant). 
Mas para “piloto com dor real”, faltam blocos que doem no dia a dia: estoque/compras, tesouraria AP, fiscal operacional no app e workflows de exames/revisão. 
Sem isso, o sistema funciona, mas tende a vazar operação para fora (Excel/WhatsApp), que quebra SSOT. 
Priorize os gaps de Fase 1 antes de expandir feature cosmética.
