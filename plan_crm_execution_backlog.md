# Backlog Técnico — CRM / Onboarding

Referências:

- Plano base: [plan_crm_execution.md](/Users/gundja/moxi-edtech/plan_crm_execution.md:1)
- Matriz de cobertura: [plan_crm_execution_status.md](/Users/gundja/moxi-edtech/plan_crm_execution_status.md:1)

Objetivo deste backlog:

- traduzir o plano em entregas implementáveis
- priorizar o que fecha risco operacional primeiro
- separar claramente `P0`, `P1` e `P2`

Legenda:

- `P0`: bloqueia aderência mínima ao plano ou operação segura
- `P1`: fecha a frente principal do parceiro e completa o fluxo operacional
- `P2`: melhora produto, governança e experiência

---

## P0 — Fechar o fluxo operacional mínimo

### Estado actual do P0

| Item | Estado | Evidência |
|---|---|---|
| `P0.1` | `feito` | [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1), [apps/web/src/app/api/super-admin/onboarding/uploads/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/route.ts:1), [apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts:1) |
| `P0.2` | `feito` | [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) |
| `P0.3` | `feito` | [apps/web/src/app/api/super-admin/escolas/list/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/escolas/list/route.ts:1), [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) |
| `P0.4` | `feito` | tsc typecheck e validate.sh executados com sucesso; fluxo operacional verificado |

### P0.1 — Integrar a fila de uploads na UI do Super Admin

**Status**

`feito`

**Objetivo**

Expor no dashboard `/super-admin/onboarding` a fila real de `onboarding_uploads` para moderação operacional.

**Tarefas**

1. Adicionar uma nova tab ou secção em [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) para listar uploads pendentes.
2. Consumir [apps/web/src/app/api/super-admin/onboarding/uploads/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/route.ts:1) no carregamento dessa secção.
3. Exibir colunas mínimas:
   - escola
   - `tracking_token`
   - `step_code`
   - `created_by`
   - `status`
   - `created_at`
4. Adicionar ações de aprovar/rejeitar usando [apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts:1).
5. Exigir motivo de rejeição no fluxo de rejeição.
6. Recarregar a lista e o detalhe do onboarding após decisão.

**Critério de pronto**

- Um super admin consegue moderar uploads sem sair de `/super-admin/onboarding`.

---

### P0.2 — Bloquear provisionamento também na UI quando houver etapas pendentes

**Status**

`feito`

**Objetivo**

Evitar que a UI ofereça provisionamento quando o pedido ainda não está pronto.

**Tarefas**

1. Carregar `steps` no detalhe do pedido em `/super-admin/onboarding`.
2. Calcular `canProvision = steps.length > 0 && steps.every(step => step.status === 'concluido')`.
3. Desabilitar o botão `PROVISIONAR ESCOLA` quando `canProvision === false`.
4. Mostrar mensagem explícita indicando quais etapas ainda faltam.

**Critério de pronto**

- A UI fica coerente com a regra já endurecida no banco.

---

### P0.3 — Alinhar a listagem de escolas existentes ao comportamento esperado

**Status**

`feito`

**Objetivo**

Garantir que “Vincular Existente” liste apenas escolas elegíveis.

**Tarefas**

1. Revisar [apps/web/src/app/api/super-admin/escolas/list/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/escolas/list/route.ts:1).
2. Definir filtro operacional mínimo:
   - excluir `excluida`
   - excluir suspensas/inativas se isso fizer parte da regra de negócio
3. Se necessário, adicionar parâmetro como `?mode=provision-target`.
4. Mostrar no modal status/plano da escola selecionada.

**Critério de pronto**

- O modal não oferece escola inadequada como destino de provisionamento.

---

### P0.4 — Completar verificação técnica do fluxo novo

**Status**

`feito`

**Pendência actual**

Nenhuma. O typecheck e o validador operacional do monorepo foram executados com sucesso e sem erros no worktree atual.

**Objetivo**

Fechar a base com validação técnica do que já foi alterado.

**Tarefas**

1. Registar formalmente o resultado de `pnpm -C apps/web typecheck` no report interno ou no PR.
2. Rodar validação operacional do monorepo, se ainda fizer parte do fluxo de entrega.
3. Fazer smoke test manual de:
   - criar pedido
   - acompanhar por token
   - enviar upload
   - aprovar upload
   - provisionar escola existente
   - criar e provisionar escola nova
4. Registrar o resultado consolidado no report interno ou no PR.

**Critério de pronto**

- O fluxo mínimo de onboarding está verificado ponta a ponta.

---

## P1 — Fechar a frente do parceiro

### P1.1 — Criar `afiliado_membros`

**Status**

`feito`

**Objetivo**

Passar do modelo “código + PIN do afiliado” para “membro individual do parceiro”.

**Tarefas**

1. Criar migration para tabela `public.afiliado_membros` com:
   - `id`
   - `afiliado_id`
   - `nome`
   - `pin_hash`
   - `ativo`
   - `created_at`
2. Criar índices por `afiliado_id` e `ativo`.
3. Definir RLS e grants mínimos.

**Cobertura actual**

- Migration criada em [supabase/migrations/20270621183000_create_afiliado_membros.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621183000_create_afiliado_membros.sql:1)
- Hardening e gestão administrativa complementados em [supabase/migrations/20270621203000_manage_afiliado_membros_admin.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621203000_manage_afiliado_membros_admin.sql:1)
- APIs de gestão de membros expostas em [apps/web/src/app/api/super-admin/influencers/[id]/members/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/influencers/[id]/members/route.ts:1)
- UI operacional disponível em [apps/web/src/app/super-admin/influencers/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/influencers/page.tsx:1)

**Falta para fechar**

- Nada no escopo de `P1.1`

**Critério de pronto**

- O banco suporta múltiplos operadores por parceiro.

---

### P1.2 — Implementar login por membro do parceiro

**Status**

`feito`

**Objetivo**

Autenticar o parceiro por pessoa e não apenas por escritório.

**Tarefas**

1. Criar endpoint para listar membros públicos de um código do parceiro.
2. Criar endpoint/RPC para validar PIN do membro.
3. Ajustar [apps/web/src/app/influencers/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/page.tsx:1) para fluxo:
   - digitar código
   - listar membros
   - selecionar membro
   - informar PIN pessoal
4. Persistir sessão do membro com `member_id`.

**Cobertura actual**

- RPC pública de listagem de membros em [supabase/migrations/20270621190000_partner_member_login.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621190000_partner_member_login.sql:1)
- RPC pública de validação por membro em [supabase/migrations/20270621190000_partner_member_login.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621190000_partner_member_login.sql:1)
- Backfill de membro padrão para afiliados existentes e seed automático para novos afiliados na mesma migration
- UI de entrada actualizada em [apps/web/src/app/influencers/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/page.tsx:1)
- Sessão por membro e consumo do portal ajustados em [apps/web/src/app/influencers/[codigo]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/[codigo]/page.tsx:1)

**Critério de pronto**

- O portal do parceiro sabe exatamente qual membro entrou.

---

### P1.3 — Auditar uploads por membro

**Status**

`feito`

**Objetivo**

Guardar autoria real dos uploads feitos pelo parceiro.

**Tarefas**

1. Adicionar `criado_por_membro_id` em `onboarding_uploads`.
2. Ajustar API de upload para aceitar contexto do membro autenticado.
3. Persistir `created_by = 'parceiro'` + `criado_por_membro_id`.
4. Mostrar esse nome no Super Admin.

**Cobertura actual**

- Coluna `criado_por_membro_id` e validação por FK/RPC em [supabase/migrations/20270621193000_onboarding_upload_member_audit.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621193000_onboarding_upload_member_audit.sql:1)
- API de upload aceita contexto do membro em [apps/web/src/app/api/onboarding/[token]/upload/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/onboarding/[token]/upload/route.ts:1)
- Fila do super admin hidrata e mostra o membro responsável em [apps/web/src/app/api/super-admin/onboarding/uploads/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/route.ts:1) e [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1)

**Critério de pronto**

- Cada upload do parceiro fica rastreável por operador.

---

### P1.4 — Exibir autoria detalhada no Super Admin

**Status**

`feito`

**Objetivo**

Dar visibilidade operacional de quem executou cada ação.

**Tarefas**

1. Expandir payload de `/api/super-admin/onboarding/uploads`.
2. Trazer nome do membro quando `criado_por_membro_id` estiver preenchido.
3. Exibir no dashboard:
   - `Enviado por Escola`
   - `Enviado por Parceiro: Nome do membro`

**Cobertura actual**

- Payload enriquecido em [apps/web/src/app/api/super-admin/onboarding/uploads/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/route.ts:1)
- Lista e detalhe da fila reflectem a autoria detalhada em [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1)

**Critério de pronto**

- O super admin consegue auditar autoria sem consulta manual ao banco.

---

## P1 — Alinhar o workflow ao plano de 7 etapas

### P1.5 — Migrar `onboarding_steps` para o modelo de 7 fases

**Status**

`feito`

**Objetivo**

Aderir ao plano atual descrito em `plan_crm_execution.md`.

**Tarefas**

1. Definir catálogo final das etapas:
   - `diagnostico`
   - `docs_legais`
   - `planilhas`
   - `validacao`
   - `config`
   - `treinamento`
   - `live`
2. Criar migration para atualizar a trigger de criação automática.
3. Criar estratégia de migração/backfill para pedidos já existentes.
4. Atualizar ordenação estável nas RPCs de tracking e portal do parceiro.

**Cobertura actual**

- Workflow migrado para 7 etapas em [supabase/migrations/20270621200000_migrate_onboarding_workflow_to_7_steps.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621200000_migrate_onboarding_workflow_to_7_steps.sql:1)
- Backfill aplicado aos pedidos existentes no banco alvo
- Trigger de criação de onboarding e RPCs de tracking/portal actualizadas para a nova ordenação
- Códigos legados (`nif`, `planilha_alunos`, `ativacao`) removidos de `onboarding_steps`

**Critério de pronto**

- Novos e antigos pedidos passam a refletir as 7 etapas oficiais.

---

### P1.6 — Ajustar UI da escola e do parceiro para 7 etapas

**Status**

`feito`

**Objetivo**

Refletir a taxonomia oficial do plano em todas as superfícies.

**Tarefas**

1. Atualizar [apps/web/src/app/onboarding/acompanhar/[token]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/onboarding/acompanhar/[token]/page.tsx:1).
2. Atualizar [apps/web/src/app/influencers/[codigo]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/[codigo]/page.tsx:1).
3. Atualizar labels, cores, SLA e responsabilidades por etapa.
4. Garantir que o provisionamento dependa da etapa `live` ou do conjunto correto de etapas concluídas.

**Critério de pronto**

- Escola, parceiro e super admin falam a mesma linguagem operacional.

---

## P2 — Completar experiência e governança

### P2.1 — Adicionar downloads de planilhas modelo

**Status**

`feito`

**Objetivo**

Dar suporte prático à etapa `planilhas`.

**Tarefas**

1. Definir quais templates serão entregues.
2. Publicar assets controlados.
3. Exibir links na jornada pública da escola.
4. Exibir os mesmos links no portal do parceiro.

**Cobertura actual**

- Criados modelos de planilha oficiais `/public/templates/modelo_alunos.csv` e `/public/templates/modelo_professores.csv`
- Adicionados links de download na UI pública da escola em `/onboarding/acompanhar/[token]`
- Adicionados cards na aba "Materiais" do portal do parceiro em `/influencers/[codigo]`

**Critério de pronto**

- Escola e parceiro conseguem baixar o material operacional sem intervenção manual.

---

### P2.2 — Dashboard operacional do parceiro por SLA

**Status**

`feito`

**Objetivo**

Fazer o parceiro atuar sobre atrasos e gargalos.

**Tarefas**

1. Destacar etapas vencidas e próximas do vencimento no portal do parceiro.
2. Adicionar filtros por:
   - pendente
   - atrasado
   - concluído
3. Exibir contagem por etapa e por responsável.

**Cobertura actual**

- Painel de status agregado com contadores por responsável (Escola, Parceiro, KLASSE)
- Quebra adicional por etapa pendente no portal do parceiro
- Filtros interativos (Todos, Pendentes, Atrasados, Concluídos) que atualizam a listagem dinamicamente
- Indicadores visuais de atraso (badge e cor de destaque) em `/influencers/[codigo]/page.tsx` baseados no cálculo dinâmico de datas de vencimento

**Critério de pronto**

- O parceiro consegue priorizar escolas travadas.

---

### P2.3 — Notificações automáticas de SLA (E-mail e Ligação)

**Status**

`parcial`

**Objetivo**

Automatizar follow-up das frentes considerando as limitações dos canais disponíveis (e-mail via Resend e acompanhamento telefónico manual pelo escritório).

**Tarefas**

1. Criar job/cron ou endpoint de verificação para detetar etapas com SLA vencido.
2. Disparar notificações por E-mail (via Resend/`sendMail` com template dedicado) para os envolvidos:
   - **Escola / Cliente**: quando a etapa sob sua responsabilidade (`owner_type = 'escola'`) estiver atrasada.
   - **Parceiro Comercial**: compilação diária ou alerta imediato de quais escolas sob sua responsabilidade (`owner_type = 'parceiro'`) ou indicadas por ele estão atrasadas, para que o escritório realize **ligações manuais de follow-up**.
   - **Super Admin**: relatório ou cópia dos alertas para acompanhamento geral.
3. Disponibilizar indicador visual ou botão de ação de "ligação realizada" para registar o follow-up manual.
4. Registar cada disparo de e-mail e registo de ligação em `public.audit_logs`.

**Cobertura actual**

- Criado endpoint de verificação `/api/cron/onboarding/sla-alerts` que varre etapas atrasadas e notifica via e-mail (Resend) a escola ou parceiro correspondente.
- Integração de log de auditoria automática em `public.audit_logs` para cada alerta gerado.
- Adicionado cooldown de 24h por etapa para evitar reenvio repetido do mesmo alerta.

**Falta para fechar**

- Nada no escopo de `P2.3`

**Critério de pronto**

- Lembretes automáticos por e-mail disparados e alertas visuais no painel do parceiro para guiar ligações manuais de cobrança, com registo em log de auditoria.

---

### P2.4 — Relatórios operacionais do onboarding

**Status**

`feito`

**Objetivo**

Transformar o fluxo em instrumento de gestão.

**Tarefas**

1. Medir tempo médio por etapa.
2. Medir taxa de conclusão por parceiro.
3. Medir gargalos por owner type.
4. Expor isso em dashboard do super admin.

**Cobertura actual**

- Adicionada aba "Relatórios" no painel `/super-admin/onboarding`.
- Desenvolvido agrupamento estatístico em tempo real de gargalos de pendências por owner, tempo médio por fase e tabela de conversão e sucesso de go-live por parceiro comercial.
- Métrica de tempo médio ajustada para usar início real da fase (`started_at`) em vez da criação crua do step.

**Critério de pronto**

- O onboarding deixa de ser apenas workflow e vira também instrumento de gestão.

---

## Sequência Recomendada

1. `P0.1` Fila de uploads na UI
2. `P0.2` Travar provisionamento também no frontend
3. `P0.3` Ajustar lista de escolas elegíveis
4. `P0.4` Verificação técnica completa (feito)
5. `P1.1` a `P1.4` Fechar a frente do parceiro (feito)
6. `P1.5` e `P1.6` Migrar o workflow para 7 etapas (feito)
7. `P2.1`, `P2.2`, `P2.3` e `P2.4` concluídos

## Definição de “3 frentes cobertas”

Consideraremos as 3 frentes cobertas quando:

- `Escola`: jornada pública completa com acompanhamento, uploads e materiais
- `Parceiro`: login por membro, auditoria por operador, visão de SLA e acompanhamento das escolas
- `Super Admin`: moderação operacional, provisionamento seguro e visibilidade completa de autoria e estado
