# Varredura CRM — 3 frentes
data: 2026-06-28
base: reunião de 2026-06-20 20:38 GMT-03
escopo: Super Admin, Escritório/Parceiro, Escola
atualizado_em: 2026-06-30
validacao_live_db: confirmada e sincronizada com migrations `20270628120000`, `20270628123000`, `20270628130000`, `20270628131000`, `20270629100000`, `20270629103000`, `20270629120000`, `20270629123000`, `20270629124000`, `20270629130000`, `20270630100000`, `20270630113000`, `20270630122000`, `20270630133000` e `20270630143000`
docs_pop_consultados: `docs/pop/parceiro`, `docs/pop/admin` sincronizados com `/Users/gundja/Desktop/Projetos/KLASSE/Kit_Onboarding_AELS/POPs`

## Veredito

O CRM já tem base funcional forte para onboarding e operação tripartite. A frente mais avançada é `Escritório/Parceiro`, com CRM pré-vendas, membros individuais, pipeline e acompanhamento de onboarding. A frente `Super Admin` tem controle operacional, onboarding e CRM pós-venda/churn. A frente `Escola` tem portal público de acompanhamento e uploads.

O principal ponto de evolução não é criar o CRM do zero. É fechar a costura entre captação, pré-vendas, onboarding, trial, ativação, assinatura e operação de comissão recorrente.

## Evidências principais

- Plano de cobertura já separa as 3 frentes em `plan_crm_execution_status.md`.
- CRM pré-vendas do parceiro usa `public.crm_leads` em `supabase/migrations/20270623140000_create_crm_pre_sales_pipeline.sql`.
- Portal do parceiro consome `/api/influencers/[codigo]/crm/leads` e permite cadastrar lead, mover etapa e registrar próxima ação.
- Landing captura diagnóstico em `marketing_leads` via `apps/landing/app/api/leads/route.ts`.
- Conversão formal `crm_lead -> onboarding_request` existe em `supabase/migrations/20270628120000_crm_lead_to_onboarding_conversion.sql` e foi aplicada no DB remoto.
- Ledger de comissão do parceiro existe em `supabase/migrations/20270628123000_partner_commissions_ledger.sql` e foi aplicado no DB remoto.
- Comissão de ativação 100% e trial comercial de 15 dias foram modelados em `supabase/migrations/20270628130000_partner_commission_activation_and_trial.sql`.
- Solicitação de payout com fatura/recibo obrigatório foi formalizada em `supabase/migrations/20270630113000_partner_commission_payouts_sprint7.sql` e aplicada no DB remoto.
- Fluxo Super Admin de payout foi formalizado em `/api/super-admin/commissions/payouts`, `/api/super-admin/commissions/payouts/[id]` e no cockpit `PartnerCommissionsClient`; migration `20270630122000_partner_payout_reopen_unique_index.sql` aplicada no DB remoto.
- Responsabilidade compartilhada Escola + Parceiro na etapa `planilhas` foi formalizada em `supabase/migrations/20270628131000_onboarding_planilhas_shared_owner.sql`.
- Gestão de equipe do parceiro, papéis operacionais e reset de PIN foram formalizados em `supabase/migrations/20270629100000_partner_portal_team_management.sql`.
- Responsável operacional por lead/follow-up foi formalizado em `supabase/migrations/20270629103000_crm_lead_responsavel_membro.sql`.
- Checklist de implantação, termo de aceite e gate de comissão de ativação foram formalizados em `20270629120000`, `20270629123000` e expostos ao portal do parceiro em `20270629124000`.
- Suporte L1 com tickets, gravidade, SLA e escalação para KLASSE foi formalizado em `supabase/migrations/20270629130000_partner_support_tickets_l1.sql`, API `/api/influencers/[codigo]/support/tickets` e aba `Suporte L1` no portal do parceiro.
- Triagem documental do parceiro foi formalizada em `supabase/migrations/20270630100000_partner_document_triage_sprint4.sql`, API `/api/influencers/[codigo]/onboarding/[token]/uploads/[uploadId]/triage` e controles no drawer da escola.
- Cockpit administrativo de comissões existe em `apps/web/src/app/super-admin/comissoes/page.tsx`, `apps/web/src/components/super-admin/comissoes/PartnerCommissionsClient.tsx` e APIs `/api/super-admin/commissions`.
- Portal do parceiro agora permite solicitar payout de comissões aprovadas ainda não solicitadas, anexando fatura/recibo obrigatório via `/api/influencers/[codigo]/commissions/payouts`; Super Admin agora aprova/rejeita/cancela/marca como pago pelo cockpit de comissões.
- Super Admin tem zona CRM pós-venda em `apps/web/src/components/super-admin/CrmSection.tsx`.
- Materiais comerciais existem em `apps/web/public/influencers/` e modelos de importação em `apps/web/public/templates/`.
- POPs operacionais do parceiro e admin existem em `docs/pop/parceiro` e `docs/pop/admin`.

## Frente 1 — Escritório / Parceiro

### Coberto

- Login e sessão por parceiro/membro.
- CRM pré-vendas com etapas `prospeccao`, `contacto`, `apresentacao`, `negociacao`, `ganho`, `perdido`.
- Cadastro manual de lead pelo parceiro.
- Captura de taxa de ativação e degustação de 15 dias no cadastro do lead.
- Próxima ação e prazo.
- Histórico via `audit_logs`.
- Pipeline visual no portal do parceiro.
- Aba `Equipe` no portal do parceiro para `owner/admin` cria membros, altera papel, ativa/desativa e redefine PIN.
- Leads têm responsável operacional explícito para follow-up, além do membro criador.
- Aba `Equipe` mostra produtividade por operador: carteira ativa, follow-ups vencidos, leads sem próxima ação, ganhos e pipeline potencial.
- Drawer de onboarding do parceiro inclui aba `Implantação` com checklist técnico, upload de Termo de Aceite, signatário, data e validação que libera a comissão de ativação.
- Drawer de onboarding do parceiro permite classificar uploads por tipo documental, marcar `em_revisao_parceiro`, `pendencia_cliente` ou `pronto_para_klasse` e registrar comentário antes da aprovação final KLASSE.
- Aba `Suporte L1` permite abrir tickets por escola, definir canal/categoria/gravidade/responsável, acompanhar SLA de resposta/resolução e escalar para KLASSE com motivo auditado.
- Aba `Escolas 360` consolida lead, contrato comercial, onboarding, checklist de implantacao/treinamento, tickets, SLA, comissoes e risco operacional por escola no portal do parceiro.
- Biblioteca contextual de POPs foi ligada ao Painel 360 via `PARTNER_CONTEXTUAL_POPS`, com HTMLs servidos por `apps/web/public/crm/pops/parceiro`.
- UI dedicada `Biblioteca POPs` foi adicionada ao portal do parceiro para busca e filtragem por fase/status de revisão.
- Painel 360 ganhou filtros por operador, risco, status de onboarding, SLA e carteira.
- Score de risco 360 passou a ser persistido no backend por `sync_influencer_school_360_risk` e colunas `crm_risk_*` em `onboarding_requests`.
- Ligacao explicita lead/escola/onboarding foi reforcada no payload do portal com `onboarding_request_id`, `crm_lead_id` e `escola_id`.
- Conversão formal de lead ganho para onboarding com `tracking_token`.
- Comissão de ativação 100% preparada para ser gerada no provisionamento da escola.
- Ledger de comissão recorrente por pagamento SaaS.
- Solicitação de payout com recibo/fatura obrigatório para comissões aprovadas.
- Acompanhamento de onboarding por SLA.
- Materiais comerciais e roteiros de WhatsApp/venda.

### Evolução recomendada

1. Adicionar metas mensais por parceiro/membro:
   - leads captados
   - demonstrações agendadas
   - contratos fechados
   - ativações concluídas
   - churn das escolas trazidas

2. Evoluir a fila diária de follow-up já iniciada:
   - leads sem próxima ação
   - próxima ação vencida
   - leads parados por etapa
   - SLA de onboarding vencido
   - metas mensais por responsável

3. Integrar WhatsApp Business/Meta como canal rastreável.
   Hoje há links/roteiros e textos, mas não há inbox multiusuário ou log automático de conversas.

4. Refinar moderação/pré-validação documental no portal do parceiro.
   A triagem do parceiro já existe; falta melhorar filtros dedicados no Super Admin e transformar o checklist de recolha em uma visão visual por tipo de documento.

5. Completar suporte L1 com anexos e relatório mensal.
   A fila de tickets e SLAs já existe; faltam upload de prints/evidências por ticket e agregação mensal de cumprimento de SLA.

## Frente 2 — Escola

### Coberto

- Formulário público de entrada/onboarding.
- Página pública por token.
- Upload de documentos/planilhas.
- Etapa `planilhas` tratada como responsabilidade compartilhada Escola + Parceiro.
- Download de modelos de alunos e professores.
- Visibilidade de etapas, responsáveis e SLA.
- Fluxo de provisionamento depois da conclusão das etapas.
- POPs/Admin da Escola estão documentados em `docs/pop/admin` e cobrem a operação pós-go-live: dashboard, alunos, turmas/currículo, avaliação/horários, setup, financeiro, migração, documentos oficiais e auditoria.

### Evolução recomendada

1. Completar a experiência visual do trial K12 de 15 dias.
   A regra comercial já foi levada para o funil de lead/onboarding/assinatura em migration local, mas falta expor expiração, lembretes e conversão no portal da escola.

2. Criar checklist de diagnóstico comercial dentro da jornada da escola:
   - número de alunos
   - resistência a pagamento digital
   - banco/API pretendido
   - maturidade da secretaria
   - urgência de matrículas online

3. Reforçar módulo de pagamentos com reconciliação assistida:
   - referência única por cobrança
   - upload de comprovativo
   - estado de validação pela escola
   - guia antifraude para conferência com extrato

4. Criar modo “escola pública”.
   A reunião identificou oportunidade para escolas públicas sem cobrança/mensalidades; isso deve virar variante de plano/feature flag que remove módulos financeiros transacionais.

5. Criar onboarding de treinamento:
   - agenda de sessões
   - presença dos colaboradores treinados
   - materiais vistos
   - aprovação para go-live

6. Transformar os POPs/Admin em checklist de aceite de implantação.
   O provisionamento actual cria a base operacional da escola, mas os POPs exigem validação explícita de dashboard, alunos, turmas/currículo publicado, regras de avaliação, tabelas financeiras, migração e evidências antes do go-live.

## Frente 3 — Super Admin / For Net

### Coberto

- Dashboard com CRM pós-venda: activation, engagement, payment risk, support pressure, expansion signal e churn.
- Pipeline de onboarding.
- Moderação de uploads.
- Provisionamento de escola existente ou nova.
- Guardrails de provisionamento.
- Relatórios operacionais de onboarding.
- Gestão de planos/preços/trial.
- Gestão de parceiros/influencers e marketing.
- Cockpit administrativo de comissões com filtros, resumo e ações de aprovar, bloquear, pagar, cancelar e reabrir.

### Evolução recomendada

1. Unificar visão de funil:
   `marketing_leads -> crm_leads -> onboarding_requests -> escolas -> assinaturas -> comissões`.
   Hoje há várias superfícies boas, mas a rastreabilidade ponta a ponta está fragmentada.

2. Criar painel de CAC e campanhas:
   - origem/UTM
   - parceiro/influencer
   - investimento mensal em tráfego pago
   - custo por lead
   - custo por demonstração
   - custo por escola ativada

3. Criar governança comercial:
   - aprovação de descontos
   - motivo de perda obrigatório
   - concorrente perdido para
   - SLA de resposta ao lead
   - auditoria de alterações de etapa

4. Expandir tarefas acionáveis para pós-venda.
   A base relacional de tarefas/agenda já existe para follow-up comercial; ainda falta gerar tarefas automáticas de churn, upgrade e pós-go-live com dono, prazo e conclusão.

## Lacunas estruturais encontradas

1. Há três fontes de lead separadas:
   - `marketing_leads`
   - `crm_leads`
   - `onboarding_requests`

2. A captura por landing grava `marketing_leads`; o parceiro usa `crm_leads`; o onboarding usa `onboarding_requests`.

3. A ponte explícita e auditável para converter lead ganho em onboarding já existe no código e no DB remoto; a visão 360 ponta a ponta já usa FK explícita quando disponível e persiste score de risco para relatório executivo.

4. O ledger de comissão recorrente, cockpit administrativo de comissões e aprovação/rejeição/pagamento de payout pelo Super Admin já existem; falta ligar essa visão aos relatórios executivos e ao extrato mensal.

5. A regra de trial de 15 dias já entrou no caminho comercial local, mas ainda precisa de experiência de aquisição K12 com expiração, lembrete e conversão visíveis.

6. A moderação documental do parceiro já tem endpoint/tela de ação no portal do parceiro; falta filtro operacional dedicado para `pronto_para_klasse` no Super Admin.

7. Os POPs/Admin da Escola já estão amarrados ao painel 360 como biblioteca contextual por fase; ainda falta revisar textos antigos que declaram `NAO OPERACIONAL NO CODIGO ACTUAL` em fluxos que já evoluíram no código.

8. WhatsApp/Meta está tratado como links, scripts e rascunhos, não como operação centralizada multiusuário.

9. Suporte L1 já tem ticket/SLA/escalação, mas ainda não tem anexos por chamado nem relatório mensal de performance.

10. Tarefas comerciais e propostas comerciais já têm tabelas normalizadas no DB remoto (`partner_tasks` e `crm_commercial_proposals`), sincronizadas pelas RPCs atuais do CRM.

## Ordem sugerida

1. Unificar dashboard Super Admin do funil ponta a ponta.
2. Integrar comissões no dashboard executivo do Super Admin e relatórios por parceiro.
3. Completar trial K12 de 15 dias com expiração, lembrete e conversão visíveis.
4. Implementar moderação/pré-validação documental do parceiro antes da validação técnica KLASSE.
5. Criar checklist de aceite de implantação baseado nos POPs/Admin da Escola.
6. Criar agenda visual e tarefas automáticas para follow-up vencido, churn e upgrade.
7. Criar pacote “escola pública” sem financeiro transacional.
8. Integrar WhatsApp Business/Meta ou, no mínimo, registrar manualmente interações com canal, operador e resultado.

## Risco principal

O produto já suporta operação e parte relevante do backend comercial foi sincronizada no DB remoto em 2026-06-28. O risco actual é continuar com marketing, CRM, onboarding, assinatura e payout de comissão em superfícies separadas, perdendo rastreabilidade e capacidade operacional.
