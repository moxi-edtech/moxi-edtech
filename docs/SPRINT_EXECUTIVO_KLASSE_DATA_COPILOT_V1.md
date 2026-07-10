# SPRINT EXECUTIVO — KLASSE Data Copilot V1

Data de validação: 2026-07-04  
Base validada: código do monorepo + schema PostgreSQL remoto de produção

## Objetivo

Evoluir o KLASSE AI de assistente de ajuda contextual para assistente de consulta operacional com dados reais, sempre dentro do tenant da escola, sem SQL livre e sem acesso direto do modelo ao banco.

Pergunta alvo inicial:

- `Quantos alunos inadimplentes existem na turma 10ª A?`

Princípio:

1. O usuário pergunta.
2. O backend resolve `schoolId`, `role` e contexto real.
3. O backend classifica a intenção.
4. O backend escolhe uma ferramenta fechada e autorizada.
5. A ferramenta consulta views/RPCs/tabelas canônicas já existentes.
6. A IA apenas explica o JSON retornado.

## Decisão executiva

Implementar o V1 em cima da infraestrutura já existente do KLASSE AI:

- widget real: `apps/web/src/components/ai/AiChatWidget.tsx`
- endpoint atual do assistente: `apps/web/src/app/api/admin/ai/assistant/route.ts`
- guardas reais de IA: `apps/web/src/lib/server/ai/ai-guards.ts`
- vínculo escola/usuário: `resolveEscolaIdForUser`
- controle de quotas e feature: `public.ai_school_settings`, `public.ai_usage_logs`, `public.claim_ai_usage_slot`

Decisão de escopo:

- V1 entra com ferramentas financeiras, acadêmicas e de secretaria que já têm fonte canônica real.
- Ferramentas sem fonte canônica clara não entram no V1.
- Não criar chat genérico.
- Não permitir SQL gerado pelo modelo.

## Inventário validado

### Rotas reais já existentes

- `POST /api/admin/ai/assistant`
- `GET /api/admin/ai/access`
- `POST /api/admin/ai/summary`
- `GET /api/financeiro/radar`
- `GET /api/financeiro/inadimplencia/top`
- `GET /api/financeiro/dashboard/resumo`
- `GET /api/financeiro/relatorios/inadimplencia-classe`
- `GET /api/financeiro/relatorios/escolar/full`
- `GET /api/secretaria/dashboard/summary`
- `GET /api/secretaria/alunos`
- `POST /api/secretaria/notas`
- `GET /api/secretaria/turmas/[id]/detalhes`
- `GET|POST /api/secretaria/atendimentos`
- `POST /api/secretaria/documentos/emitir`
- `POST /api/professor/presencas`

### Views, tabelas e RPCs reais confirmadas no banco

#### IA e autorização

- `public.ai_school_settings`
- `public.ai_usage_logs`
- `public.claim_ai_usage_slot`
- `public.escola_users`

#### Financeiro

- `public.vw_radar_inadimplencia`
- `public.vw_financeiro_inadimplencia_top`
- `public.vw_financeiro_dashboard`
- `public.vw_financeiro_kpis_mes`
- `public.vw_financeiro_propinas_por_turma`
- `public.vw_financeiro_propinas_mensal_escola`
- `public.vw_pagamentos_status`
- `public.vw_relatorio_financeiro_escolar_inadimplencia_classe`
- `public.vw_relatorio_financeiro_escolar_fluxo_mensal`
- `public.vw_relatorio_financeiro_escolar_capitacao_mensal`
- `public.mensalidades`
- `public.financeiro_lancamentos`

#### Acadêmico

- `public.vw_boletim_por_matricula`
- `public.frequencia_status_periodo`
- `public.frequencias`
- `public.notas`
- `public.lancar_notas_batch`
- `public.upsert_frequencias_batch`

#### Secretaria

- `public.vw_secretaria_dashboard_counts`
- `public.vw_secretaria_dashboard_kpis`
- `public.vw_secretaria_alunos_resumo`
- `public.vw_turmas_para_matricula`
- `public.matriculas`
- `public.alunos`
- `public.turmas`
- `public.classes`
- `public.candidaturas`
- `public.documentos_emitidos`
- `public.atendimentos_balcao`
- `public.preview_matricula_number`
- `public.get_turma_disciplinas_pedagogico`

#### Configuração institucional real

- `public.escolas`
- `public.configuracoes_escola`
- `public.configuracoes_financeiro`
- `public.modelos_avaliacao`

## O que não existe como coluna de primeira classe

Os seguintes nomes do rascunho original não existem hoje como colunas diretas em `public.escolas`:

- `school_sector`
- `finance_model`
- `regulatory_profile`
- `assessment_policy`

Mapeamento real disponível hoje:

- tipo institucional: `escolas.tenant_type`
- plano: `escolas.plano_atual`
- política de avaliação: `configuracoes_escola.modelo_avaliacao` + `configuracoes_escola.avaliacao_config`
- política de frequência: `configuracoes_escola.frequencia_modelo` + `configuracoes_escola.frequencia_min_percent`
- configuração financeira: `configuracoes_financeiro.*`
- dados bancários/recebimento: `escolas.dados_pagamento`

Decisão:

- No V1, usar esses campos reais.
- Se `finance_model` for requisito obrigatório de produto, criar coluna explícita em migration própria antes de ligar bloqueios por “budget” vs “recorrente”.
- Não inferir `finance_model` silenciosamente.

## Definições canônicas do V1

Criar:

- `apps/web/src/lib/assistant/data-copilot/business-definitions.ts`

Definições obrigatórias do V1:

### Aluno inadimplente

Fonte canônica principal:

- `public.vw_radar_inadimplencia`
- complemento por turma agregada: `public.vw_financeiro_propinas_por_turma`

Regra do V1:

- existe linha vencida em `vw_radar_inadimplencia`
- `valor_em_atraso > 0`
- `status_mensalidade` não liquidado
- agrupamento por aluno e turma corrente

### Turma ativa

Fonte:

- `public.turmas`
- `public.vw_turmas_para_matricula`

Regra do V1:

- turma da escola atual
- com `id` válido
- para consultas de matrícula/ocupação, preferir `vw_turmas_para_matricula`

### Aluno abaixo da média

Fonte:

- `public.vw_boletim_por_matricula`
- `public.configuracoes_escola`

Regra do V1:

- considerar apenas linhas com `conta_para_media_med = true`
- usar `nota_final`
- limiar operacional inicial: `< 10`
- ignorar linhas com `needs_config = true`

### Risco de frequência

Fonte:

- `public.frequencia_status_periodo`
- `public.configuracoes_escola.frequencia_min_percent`

Regra do V1:

- `abaixo_minimo = true` é a regra canônica
- para resposta textual, pode expor `faltas`, `presencas`, `percentual_presenca`

### Matrícula pendente

Fonte:

- `public.candidaturas`
- `public.matriculas`
- `public.vw_secretaria_dashboard_kpis.resumo_status`

Regra do V1:

- para pipeline de admissão: contar `candidaturas.status` ainda não convertidas
- para panorama da secretaria: usar `vw_secretaria_dashboard_kpis` e `resumo_status`

### Pagamento recebido

Fonte:

- `public.vw_financeiro_kpis_mes`
- `public.vw_pagamentos_status`

Regra do V1:

- valor recebido agregado por mês: `realizado_total`
- quando a pergunta falar em competência, usar `pago_competencia_total`

## Ferramentas do V1

### 1. Financeiro

#### `finance.delinquency_by_class`

Status: entra no V1  
Fonte:

- `public.vw_financeiro_propinas_por_turma`
- complemento de aging buckets: `public.vw_radar_inadimplencia`

Parâmetros:

- `turmaId`
- `referenceDate`
- `anoLetivo`

Retorno:

- `turma_nome`
- `qtd_em_atraso`
- `qtd_mensalidades`
- `total_em_atraso`
- `inadimplencia_pct`
- `over30Days`
- `over60Days`

Observação:

- `vw_financeiro_propinas_por_turma` já entrega os agregados por turma.
- `over30Days` e `over60Days` precisam ser computados a partir de `vw_radar_inadimplencia.dias_em_atraso`.

#### `finance.school_delinquency_summary`

Status: entra no V1  
Fonte:

- `public.vw_financeiro_dashboard`
- `public.vw_financeiro_kpis_mes`

Retorno:

- alunos inadimplentes
- alunos em dia
- total previsto
- total realizado
- total em atraso

#### `finance.receipts_summary`

Status: entra no V1  
Fonte:

- `public.vw_financeiro_kpis_mes`

Retorno:

- `mes_ref`
- `realizado_total`
- `pago_competencia_total`
- `previsto_total`

#### `finance.overdue_age_summary`

Status: entra no V1  
Fonte:

- `public.vw_radar_inadimplencia`

Retorno:

- `0_30`
- `31_60`
- `61_plus`
- `total_em_atraso`

#### `finance.top_delinquent_classes`

Status: entra no V1  
Fonte:

- `public.vw_financeiro_propinas_por_turma`

Retorno:

- ranking por `qtd_em_atraso`
- desempate por `total_em_atraso`

### 2. Acadêmico

#### `academic.attendance_by_class`

Status: entra no V1  
Fonte:

- diário: `public.frequencias`
- consolidado por período: `public.frequencia_status_periodo`

Decisão:

- perguntas com “hoje”, “ontem”, “este mês” usam `public.frequencias`
- perguntas de risco/consolidado usam `public.frequencia_status_periodo`

Parâmetros:

- `turmaId`
- `dateFrom`
- `dateTo`
- `periodoLetivoId`

#### `academic.students_at_attendance_risk`

Status: entra no V1  
Fonte:

- `public.frequencia_status_periodo`

Retorno:

- quantidade de alunos `abaixo_minimo = true`
- percentual médio da turma

#### `academic.students_below_average`

Status: entra no V1  
Fonte:

- `public.vw_boletim_por_matricula`
- `public.configuracoes_escola`

Retorno:

- total de alunos abaixo de 10
- disciplina/turma de corte, sem expor nomes no retorno agregado

#### `academic.class_performance_comparison`

Status: entra no V1  
Fonte:

- `public.vw_boletim_por_matricula`

Regra:

- média agregada por `turma_id`
- considerar apenas `nota_final` não nula e `conta_para_media_med = true`

### 3. Secretaria

#### `secretary.enrollment_summary`

Status: entra no V1  
Fonte:

- `public.vw_secretaria_dashboard_counts`
- `public.vw_secretaria_dashboard_kpis`
- `public.candidaturas`

Retorno:

- alunos ativos
- matrículas
- turmas
- pendências

#### `secretary.incomplete_student_records`

Status: fora do V1  
Motivo:

- não foi identificada fonte canônica explícita para “cadastro incompleto” no schema atual.

#### `secretary.pending_document_requests`

Status: fora do V1  
Motivo:

- `documentos_emitidos` registra emissão, não fila pendente.
- não há tabela canônica de “solicitação pendente de documento” validada nesta auditoria.

#### `secretary.enrollment_status_summary`

Status: entra no V1  
Fonte:

- `public.vw_secretaria_dashboard_kpis.resumo_status`
- `public.candidaturas.status`

#### `secretary.active_students_by_class`

Status: entra no V1  
Fonte:

- `public.matriculas`
- `public.turmas`
- `public.classes`
- opcional para ocupação: `public.vw_turmas_para_matricula`

### 4. Direção

#### `management.daily_school_overview`

Status: entra no V1  
Fonte:

- `public.vw_escola_info`
- `public.vw_secretaria_dashboard_counts`
- `public.vw_secretaria_dashboard_kpis`
- `public.vw_pagamentos_status`
- `public.vw_radar_inadimplencia`

#### `management.operational_alerts`

Status: entra no V1  
Fonte:

- `public.vw_secretaria_dashboard_kpis`
- `public.atendimentos_balcao`
- `public.vw_radar_inadimplencia`

#### `management.financial_academic_risks`

Status: entra no V1  
Fonte:

- `public.vw_radar_inadimplencia`
- `public.frequencia_status_periodo`
- `public.vw_boletim_por_matricula`

#### `management.school_monthly_summary`

Status: entra no V1  
Fonte:

- `public.vw_financeiro_kpis_mes`
- `public.vw_pagamentos_status`
- `public.vw_secretaria_dashboard_kpis`

## Ferramentas explicitamente fora do V1

Não implementar nesta sprint:

- `secretary.pending_document_requests`
- `secretary.incomplete_student_records`
- qualquer ferramenta que dependa de `school_sector`, `finance_model` ou `regulatory_profile` sem migration explícita
- qualquer consulta que exija PII individual como resposta padrão

## Arquitetura final proposta

### Endpoint novo

Criar:

- `apps/web/src/app/api/admin/ai/data-query/route.ts`

Não criar:

- `/api/admin/ai/chat`

### Pasta nova

Criar:

- `apps/web/src/lib/assistant/data-copilot/types.ts`
- `apps/web/src/lib/assistant/data-copilot/tool-registry.ts`
- `apps/web/src/lib/assistant/data-copilot/intent-classifier.ts`
- `apps/web/src/lib/assistant/data-copilot/entity-resolver.ts`
- `apps/web/src/lib/assistant/data-copilot/tool-authorizer.ts`
- `apps/web/src/lib/assistant/data-copilot/tool-executor.ts`
- `apps/web/src/lib/assistant/data-copilot/answer-composer.ts`
- `apps/web/src/lib/assistant/data-copilot/data-copilot-service.ts`
- `apps/web/src/lib/assistant/data-copilot/business-definitions.ts`
- `apps/web/src/lib/assistant/data-copilot/cache.ts`
- `apps/web/src/lib/assistant/data-copilot/audit.ts`

## Integração com o KLASSE AI atual

Não substituir o fluxo atual de ajuda.

Estratégia:

1. `AiChatWidget` continua chamando `POST /api/admin/ai/assistant`.
2. `assistant/route.ts` ganha uma decisão inicial:
   - pergunta de ajuda/navegação -> fluxo atual
   - pergunta de dados -> delega internamente ao `data-copilot-service`
3. O modo novo no payload do widget passa a incluir `data_query`.

Estados novos no client:

- `data_query_input`
- `data_query_processing`
- `data_query_clarification`
- `data_query_result`
- `data_query_unsupported`

## Resolução de entidades

### Turma

Fonte:

- `public.turmas`
- `public.vw_turmas_para_matricula`

Critério:

- resolver sempre dentro de `escola_id`
- aceitar nome, variante sem ordinal e combinação com turno

Exemplos aceitos:

- `10ª A`
- `10 A`
- `10A`
- `10ª A da manhã`

Se ambíguo:

- devolver esclarecimento

Se inexistente:

- devolver fallback seguro

### Ano letivo e período

Fonte:

- `public.anos_letivos`
- `public.periodos_letivos`
- utilitário já existente: `resolveAnoLetivoScope`

### Aluno

Fonte:

- `public.alunos`
- `public.matriculas`

Regra:

- não retornar nomes no modo agregado
- nomes só servem para resolver contexto interno quando a role permitir e a ferramenta exigir

## Classificação de intenção

Fase 1:

- regras locais primeiro
- modelo leve só quando necessário

Fast paths obrigatórios:

- `quantos inadimplentes` -> `finance.delinquency_by_class`
- `quanto recebemos` -> `finance.receipts_summary`
- `qual turma tem mais faltas` -> `academic.attendance_by_class`
- `abaixo da média` -> `academic.students_below_average`
- `matrículas pendentes` -> `secretary.enrollment_status_summary`

## Autorização

### Guardas reutilizados

- tenant: `resolveEscolaIdForUser`
- role: `escola_users.papel`
- acesso IA e quotas: `validateAiAccess`
- slot de uso: `claim_ai_usage_slot`

### Feature flag nova

Adicionar em `allowed_features`:

- `data_query`

### Roles permitidas no V1

Financeiro:

- `admin`
- `admin_escola`
- `direcao`
- `diretoria`
- `financeiro`
- `admin_financeiro`
- `secretaria_financeiro`

Acadêmico e secretaria:

- `admin`
- `admin_escola`
- `staff_admin`
- `direcao`
- `diretoria`
- `secretaria`
- `admin_financeiro`
- `secretaria_financeiro`

Bloqueados nesta sprint:

- `aluno`
- `professor`
- `encarregado`

## Privacidade

Regras obrigatórias:

- respostas agregadas por padrão
- sem telefone, BI, e-mail, IBAN ou nome completo como resposta automática
- botões de aprofundamento devem apontar para telas reais do sistema

Exemplos de links reais:

- Radar: `/escola/[schoolId]/financeiro`
- Relatório de propinas: `/escola/[schoolId]/financeiro/relatorios/propinas`
- Alunos: `/escola/[schoolId]/secretaria/alunos`
- Turmas: `/escola/[schoolId]/secretaria/turmas`

## Auditoria e logging

Decisão do V1:

- reutilizar `public.ai_usage_logs`

Motivo:

- já existe
- já está integrado com `validateAiAccess`
- já recebe `feature`, `input_preview`, `output_preview`, `provider`, `model`

Ajuste recomendado:

- usar `feature = 'data_query'`
- gravar `input_preview` sanitizado com `toolKey` e resumo dos parâmetros
- gravar `output_preview` sem PII

Gap conhecido:

- `ai_usage_logs` não tem `duration_ms` nem `parameters_sanitized` estruturado

Se isso for requisito duro da sprint, criar `public.ai_data_query_logs` em migration própria. Se o objetivo for velocidade de entrega, V1 pode sair usando `ai_usage_logs`.

## Performance

Meta do V1:

- fast path sem modelo: até 500ms
- ferramenta agregada simples: até 2s
- com modelo: até 5s

Cache:

- chave por `schoolId + toolKey + normalizedParameters`
- TTL de 30s a 60s
- não cachear payload individual sensível

## Testes obrigatórios do V1

### Financeiro

1. `Quantos inadimplentes existem na 10ª A?`
2. `Qual o total vencido da 10ª A?`
3. `Qual turma tem mais inadimplentes?`
4. `Quanto a escola recebeu em junho?`
5. role sem acesso financeiro recebe `403`

### Acadêmico

6. `Qual turma teve mais faltas este mês?`
7. `Quantos alunos estão abaixo da média?`
8. `Qual turma apresenta mais risco de frequência?`

### Secretaria

9. `Quantas matrículas estão pendentes?`
10. `Quantos alunos ativos existem por turma?`

### Segurança

11. escola A não consulta escola B
12. cliente não consegue trocar `schoolId` e burlar tenant
13. cliente não escolhe tabela
14. cliente não envia SQL
15. retorno agregado não contém PII

## Plano de implementação

### Fase 1

- criar `data-copilot-service`
- criar `tool-registry` com 5 ferramentas financeiras
- ligar `assistant/route.ts` ao novo fluxo
- adicionar feature `data_query`
- responder a pergunta alvo de inadimplência por turma

### Fase 2

- adicionar ferramentas acadêmicas de faltas e média
- adicionar ferramentas de secretaria
- adicionar esclarecimento de ambiguidade por turma/período

### Fase 3

- endurecer auditoria
- avaliar necessidade de `ai_data_query_logs`
- introduzir campos institucionais explícitos se produto realmente precisar de `finance_model`

## Arquivos a alterar

### Novos

- `apps/web/src/app/api/admin/ai/data-query/route.ts`
- `apps/web/src/lib/assistant/data-copilot/*`
- opcional: migration para `allowed_features` default com `data_query`

### Alterados

- `apps/web/src/app/api/admin/ai/assistant/route.ts`
- `apps/web/src/components/ai/AiChatWidget.tsx`
- `apps/web/src/lib/assistant/klasse-brain.ts`
- `apps/web/src/lib/server/ai/ai-guards.ts`
- `apps/web/src/lib/assistant/permission-registry.ts`

## Critério de aceite realista para esta sprint

A sprint está pronta para execução se entregar estes pontos:

- pergunta financeira por turma respondida com dados reais
- backend valida tenant e role
- ferramenta usa fonte canônica já existente
- não existe SQL livre gerado pelo modelo
- modelo não acessa o banco
- retorno agregado não expõe PII
- ambiguidades de turma são tratadas
- `typecheck` e `build` passam

## Conclusão

O desenho é viável sem tiro no escuro, mas o V1 precisa ser ancorado nas fontes reais já existentes:

- financeiro: pronto
- acadêmico: pronto com base em `frequencias` e `vw_boletim_por_matricula`
- secretaria: parcialmente pronta

O ponto mais importante de alinhamento é este:

- não usar `school_sector`, `finance_model`, `regulatory_profile` e `assessment_policy` como se já existissem no schema
- usar os campos reais atuais ou criar migration explícita antes

Com isso, a primeira entrega pode responder com confiança:

- `Quantos alunos inadimplentes existem na turma X?`

