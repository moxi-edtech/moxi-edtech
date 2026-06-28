# Status de Cobertura — `plan_crm_execution.md`

Referência principal: [plan_crm_execution.md](/Users/gundja/moxi-edtech/plan_crm_execution.md:1)
Última validação live DB: 2026-06-28

Este documento traduz o plano em uma matriz objetiva de cobertura, separada pelas 3 frentes operacionais:

1. Escritório / Parceiro
2. Escola / Cliente
3. Super Admin / For Net

Legenda:

- `feito`: coberto no código atual
- `parcial`: existe implementação, mas ainda incompleta frente ao plano
- `falta`: item do plano ainda não coberto

## Escritório / Parceiro

| Item do plano | Status | Cobertura atual | Falta para fechar |
|---|---|---|---|
| Portal do parceiro em `/influencers/[codigo]` | `feito` | [apps/web/src/app/influencers/[codigo]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/[codigo]/page.tsx:1) | |
| Estatísticas e onboarding agregado do parceiro | `feito` | [supabase/migrations/20270621160000_update_influencer_portal_rpc.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621160000_update_influencer_portal_rpc.sql:1) | |
| Link para acompanhamento da escola por token | `feito` | [apps/web/src/app/influencers/[codigo]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/[codigo]/page.tsx:1) | |
| Login individual por membro (`afiliado_membros`) | `feito` | [supabase/migrations/20270621190000_partner_member_login.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621190000_partner_member_login.sql:1), [apps/web/src/app/influencers/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/page.tsx:1), [apps/web/src/app/influencers/[codigo]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/[codigo]/page.tsx:1) | |
| PIN pessoal por membro do parceiro | `feito` | Mesmo fluxo acima, validando `member_id + pin` por RPC dedicada | |
| Auditoria de uploads por membro (`criado_por_membro_id`) | `feito` | [supabase/migrations/20270621193000_onboarding_upload_member_audit.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621193000_onboarding_upload_member_audit.sql:1), [apps/web/src/app/api/onboarding/[token]/upload/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/onboarding/[token]/upload/route.ts:1), [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) | |
| Workflow de 7 etapas do parceiro (`diagnostico`, `config`, `live` etc.) | `feito` | Banco, RPCs e UIs (tanto de acompanhamento da escola quanto portal do parceiro) totalmente alinhados e exibindo as 7 fases | |
| Dashboard operacional do parceiro por SLA | `feito` | [apps/web/src/app/influencers/[codigo]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/[codigo]/page.tsx:1) com filtros de estado, contadores por responsável, quebra por etapa e destaque visual de atrasados | |
| Conversão formal `crm_lead -> onboarding_request` | `feito` | [supabase/migrations/20270628120000_crm_lead_to_onboarding_conversion.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270628120000_crm_lead_to_onboarding_conversion.sql:1), [apps/web/src/app/api/influencers/[codigo]/crm/leads/[leadId]/convert/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/influencers/[codigo]/crm/leads/[leadId]/convert/route.ts:1), [apps/web/src/app/influencers/[codigo]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/[codigo]/page.tsx:1) | |
| Ledger de comissão recorrente do parceiro | `feito` | [supabase/migrations/20270628123000_partner_commissions_ledger.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270628123000_partner_commissions_ledger.sql:1), [apps/web/src/app/api/influencers/[codigo]/commissions/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/influencers/[codigo]/commissions/route.ts:1), [apps/web/src/app/api/super-admin/billing/assinaturas/[id]/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/billing/assinaturas/[id]/route.ts:1) | Falta cockpit administrativo para aprovar/bloquear/pagar comissão |

## Escola / Cliente

| Item do plano | Status | Cobertura atual | Falta para fechar |
|---|---|---|---|
| Formulário público de entrada | `feito` | [apps/web/src/app/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/onboarding/page.tsx:1) | |
| Página pública de acompanhamento por token | `feito` | [apps/web/src/app/onboarding/acompanhar/[token]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/onboarding/acompanhar/[token]/page.tsx:1) | |
| API de acompanhamento por token | `feito` | [apps/web/src/app/api/onboarding/acompanhar/[token]/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/onboarding/acompanhar/[token]/route.ts:1) | |
| Upload de pendências/documentos | `feito` | [apps/web/src/app/api/onboarding/[token]/upload/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/onboarding/[token]/upload/route.ts:1) | |
| Segurança do tracking por token | `feito` | [supabase/migrations/20270621170000_harden_onboarding_tracking_access.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621170000_harden_onboarding_tracking_access.sql:1) | |
| Transparência de SLA e responsável por etapa | `feito` | Payload de steps e interfaces mostram SLAs e responsáveis para todas as 7 etapas | |
| Download de planilhas modelo | `feito` | Links e templates oficiais de alunos/professores adicionados tanto na jornada pública da escola quanto na aba Materiais do parceiro | |

## Super Admin / For Net

| Item do plano | Status | Cobertura atual | Falta para fechar |
|---|---|---|---|
| Pipeline principal de onboarding | `feito` | [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) | |
| Aprovar/rejeitar uploads em API | `feito` | [apps/web/src/app/api/super-admin/onboarding/uploads/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/route.ts:1), [apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts:1) | |
| Provisionar escola existente | `feito` | [apps/web/src/app/api/super-admin/onboarding/[id]/provision/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/[id]/provision/route.ts:1) | |
| Criar + provisionar em uma chamada | `feito` | [apps/web/src/app/api/super-admin/onboarding/[id]/create-and-provision/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/[id]/create-and-provision/route.ts:1) | |
| Guardrails de provisionamento | `feito` | [supabase/migrations/20270621172000_harden_onboarding_provisioning.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621172000_harden_onboarding_provisioning.sql:1) | |
| Audit log transacional do provisionamento | `feito` | Mesmo arquivo acima | |
| Moderação visual da fila de uploads no dashboard | `feito` | [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) consome [apps/web/src/app/api/super-admin/onboarding/uploads/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/route.ts:1) e [apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/[uploadId]/review/route.ts:1) | |
| Bloqueio visual de provisionamento com etapas pendentes | `feito` | [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) carrega `onboarding_steps`, calcula prontidão e desabilita a ação quando houver pendências | |
| Escolas elegíveis no modal “Vincular Existente” | `feito` | [apps/web/src/app/api/super-admin/escolas/list/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/escolas/list/route.ts:1) com `?mode=provision-target` + [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) exibindo status/plano/localização | |
| Mostrar “quem enviou” com detalhe do parceiro/membro | `feito` | [apps/web/src/app/api/super-admin/onboarding/uploads/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/onboarding/uploads/route.ts:1) e [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) expõem `Enviado por Escola` vs `Enviado por Parceiro: Nome do membro` | |
| Notificações automáticas de SLA (E-mail / Ligações) | `feito` | [apps/web/src/app/api/cron/onboarding/sla-alerts/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/cron/onboarding/sla-alerts/route.ts) verifica prazos, aplica cooldown e dispara alertas com logs em `public.audit_logs`; [apps/web/src/app/influencers/[codigo]/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/influencers/[codigo]/page.tsx:1) expõe ação e indicador visual de `ligação realizada` por escola e por etapa | |
| Relatórios operacionais do onboarding | `feito` | Aba "Relatórios" em [apps/web/src/app/super-admin/onboarding/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/onboarding/page.tsx:1) exibindo gargalos por owner, tempo médio por fase com `started_at` e conversão por parceiro | |
| Cockpit administrativo de comissões | `parcial` | [apps/web/src/app/super-admin/comissoes/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/comissoes/page.tsx:1), [apps/web/src/components/super-admin/comissoes/PartnerCommissionsClient.tsx](/Users/gundja/moxi-edtech/apps/web/src/components/super-admin/comissoes/PartnerCommissionsClient.tsx:1), [apps/web/src/app/api/super-admin/commissions/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/commissions/route.ts:1), [apps/web/src/app/api/super-admin/commissions/[id]/route.ts](/Users/gundja/moxi-edtech/apps/web/src/app/api/super-admin/commissions/[id]/route.ts:1) | Falta fechar comprovativo/recibo e reconciliação de payout |

## Arquitetura / Banco

| Item do plano | Status | Cobertura atual | Falta para fechar |
|---|---|---|---|
| `tracking_token` em `onboarding_requests` | `feito` | [supabase/migrations/20270621150000_create_onboarding_crm_architecture.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621150000_create_onboarding_crm_architecture.sql:1) | |
| `onboarding_steps` | `feito` | Mesmo arquivo acima | |
| `onboarding_uploads` | `feito` | Mesmo arquivo acima | |
| Bucket `onboarding` | `feito` | Mesmo arquivo acima | |
| Hardening do acesso público | `feito` | [supabase/migrations/20270621170000_harden_onboarding_tracking_access.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621170000_harden_onboarding_tracking_access.sql:1) | |
| Ordenação estável das etapas | `feito` | [supabase/migrations/20270621171000_stabilize_onboarding_step_order.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621171000_stabilize_onboarding_step_order.sql:1) | |
| Hardening do provisionamento | `feito` | [supabase/migrations/20270621172000_harden_onboarding_provisioning.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621172000_harden_onboarding_provisioning.sql:1) | |
| `afiliado_membros` | `feito` | Base criada em [supabase/migrations/20270621183000_create_afiliado_membros.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621183000_create_afiliado_membros.sql:1) e gestão/hardening concluídos em [supabase/migrations/20270621203000_manage_afiliado_membros_admin.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270621203000_manage_afiliado_membros_admin.sql:1), com UI em [apps/web/src/app/super-admin/influencers/page.tsx](/Users/gundja/moxi-edtech/apps/web/src/app/super-admin/influencers/page.tsx:1) | |
| Modelo de 7 etapas | `feito` | Banco, triggers, RPCs e UIs totalmente alinhados e migrados | |
| Ligação explícita `crm_leads <-> onboarding_requests` | `feito` | [supabase/migrations/20270628120000_crm_lead_to_onboarding_conversion.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270628120000_crm_lead_to_onboarding_conversion.sql:1), com colunas aplicadas no live DB em 2026-06-28 | |
| `partner_commissions` | `feito` | [supabase/migrations/20270628123000_partner_commissions_ledger.sql](/Users/gundja/moxi-edtech/supabase/migrations/20270628123000_partner_commissions_ledger.sql:1), com tabela/funções aplicadas no live DB em 2026-06-28 | |

## Resumo por Frente

- `Escola`: jornada pública completa com acompanhamento, uploads e download de planilhas modelo
- `Super Admin`: fila de uploads, provisionamento seguro, autoria de ações e painel de relatórios operacionais de tempo médio e conversão por parceiro
- `Parceiro`: login de membros, PIN individual, CRM pré-vendas, conversão para onboarding, ledger de comissão recorrente, acompanhamento das 7 etapas, download de templates, dashboard de SLA com filtros integrados e registo manual de follow-up

## Próxima Ordem de Execução

Estado actual após sincronização do live DB:

- P2.1: Modelos de Planilha (`feito`)
- P2.2: Dashboard por SLA (`feito`)
- P2.3: Notificações automáticas (`feito`)
- P2.4: Relatórios operacionais (`feito`)
- P2.5: Conversão `crm_lead -> onboarding_request` (`feito`)
- P2.6: Ledger de comissão recorrente (`feito`)

Próximos blocos reais:

- P3.1: Funil ponta a ponta unificado (`marketing_leads -> crm_leads -> onboarding_requests -> escolas -> assinaturas -> comissões`)
- P3.2: Cockpit administrativo de comissão (`parcial`; falta recibar/reconciliar payout)
- P3.3: Trial K12 explícito de aquisição
- P3.4: Tarefas/fila persistida de follow-up comercial
- P3.5: Variante “escola pública” sem financeiro transacional
- P3.6: Canal WhatsApp rastreável para CRM comercial
