# Apply Diff — CRM conversion + partner commissions
run_id: A0E8F48F-C4E6-4927-B109-7C4ABBF842A4
timestamp: 2026-06-28T00:00:00-03:00
commit: 4d3a1f79

## Escopo

Aplicar no PostgreSQL remoto as migrations pendentes:

- `supabase/migrations/20270628120000_crm_lead_to_onboarding_conversion.sql`
- `supabase/migrations/20270628123000_partner_commissions_ledger.sql`

## Diff

```diff
+ public.onboarding_requests.crm_lead_id uuid references public.crm_leads(id)
+ public.crm_leads.onboarding_request_id uuid references public.onboarding_requests(id)
+ public.crm_leads.converted_at timestamptz
+ public.crm_leads.converted_by_membro_id uuid references public.afiliado_membros(id)
+ unique index ux_onboarding_requests_crm_lead_id on public.onboarding_requests (crm_lead_id) where crm_lead_id is not null
+ index ix_crm_leads_onboarding_request_id on public.crm_leads (onboarding_request_id) where onboarding_request_id is not null
+ function public.convert_influencer_crm_lead_to_onboarding(uuid, text, uuid)
~ function public.get_influencer_crm_leads(uuid, text) extended with onboarding linkage fields
+ table public.partner_commissions
+ policy partner_commissions_super_admin_all on public.partner_commissions
+ index ux_partner_commissions_pagamento_tipo on public.partner_commissions (pagamento_saas_id, tipo) where pagamento_saas_id is not null
+ index ix_partner_commissions_afiliado_status on public.partner_commissions (afiliado_codigo, status, created_at desc)
+ index ix_partner_commissions_escola on public.partner_commissions (escola_id, created_at desc)
+ trigger trg_partner_commissions_updated on public.partner_commissions
+ function public.generate_partner_commission_for_saas_payment(uuid, uuid)
+ function public.get_influencer_partner_commissions(uuid, text)
+ migration history row 20270628120000 in supabase_migrations.schema_migrations
+ migration history row 20270628123000 in supabase_migrations.schema_migrations
```

## Risco

Mudança de schema e funções do fluxo comercial/financeiro; falha de compatibilidade afectaria conversão de leads e geração de comissões no backend.
