# Diff proposto — DB lint, lote 7 auditoria de parceiros
run_id: FE3BD60B-0263-43D2-BFCE-989D5C5F9445
timestamp: 2026-07-18T13:00:39Z
commit_base: 1c446392

Migration proposta: `supabase/migrations/20260718135000_fix_partner_audit_user_uuid.sql`

```diff
--- public.update_influencer_crm_lead_commercial_terms(...)
+++ public.update_influencer_crm_lead_commercial_terms(...)
@@
-    coalesce(v_member_id::text, 'system'),
+    v_member_id,

--- public.convert_influencer_crm_lead_to_onboarding(uuid,text,uuid)
+++ public.convert_influencer_crm_lead_to_onboarding(uuid,text,uuid)
@@
-    coalesce(v_member_id::text, 'system'),
+    v_member_id,

--- public.create_influencer_partner_commission_payout(...)
+++ public.create_influencer_partner_commission_payout(...)
@@
-    coalesce(v_member_id::text, 'system'),
+    v_member_id,

--- public.generate_partner_commission_for_saas_payment(uuid,uuid)
+++ public.generate_partner_commission_for_saas_payment(uuid,uuid)
@@
-    coalesce(p_actor_id::text, 'system'),
+    p_actor_id,

--- public.update_influencer_support_ticket(...)
+++ public.update_influencer_support_ticket(...)
@@
-    v_session.member_id::text,
+    v_session.member_id,
```

`audit_logs.user_id` é UUID. As cinco funções já possuem o UUID do ator; quando
não houver ator, o valor correto é `NULL`, não o texto inválido `system`.

