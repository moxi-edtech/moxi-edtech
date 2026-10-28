# Aprovação necessária — Agent 3
run_id:    8c426762-0ebb-43d8-b5a0-7856de85c343
timestamp: 2026-10-28T22:09:26.787466+00:00

## Acção proposta
Permitir AppyPay no domínio de provedores de pagamento existente. Proposta apenas: nenhum SQL aplicado e nenhuma configuração financeira alterada.

## Diff
```diff
--- /dev/null
+++ b/supabase/migrations/<gerar-com-supabase-migration-new>_allow_appypay_provider.sql
@@ -0,0 +1,8 @@
+BEGIN;
+ALTER TABLE public.school_payment_providers
+  DROP CONSTRAINT school_payment_providers_provider_type_check;
+ALTER TABLE public.school_payment_providers
+  ADD CONSTRAINT school_payment_providers_provider_type_check
+  CHECK (provider_type IN ('proxypay', 'appypay'));
+COMMIT;
```

## Risco
A restrição é partilhada pelas escolas; a alteração amplia os valores aceites no schema financeiro. Não habilita cobranças sozinha. Aplicação e rollback exigem validar a inexistência de registos AppyPay antes de restaurar a restrição original.

## Como aprovar
Commit com mensagem: `APPROVE: 8c426762-0ebb-43d8-b5a0-7856de85c343`

## Como rejeitar
Commit com mensagem: `REJECT: 8c426762-0ebb-43d8-b5a0-7856de85c343 [motivo]`

## Evidência e limites
- Base: origin/main 074f96b21; branch codex/appypay-escola-klasse.
- Escola identificada por consulta somente leitura: Escola KLASSE, f406f5a7-a077-431c-b118-297224925726.
- Constraint actual confirmada no banco: school_payment_providers_provider_type_check, CHECK (provider_type = 'proxypay'::text).
- P0_CHECKLIST.md revisto: sem item desmarcado ou FAIL explícito; isto não equivale a revalidar os testes.
- Navegador AppyPay indisponível após timeout; credenciais, aplicações e webhook não verificados.
- Sandbox obrigatório nesta tarefa: https://app-tst.appypay.co.ao ; API https://gwy-api-tst.appypay.co.ao/v2.0.
- Após aprovação ainda é necessário implementar o adaptador, configurar segredos no servidor com vínculo à escola, confirmar cobranças por GET /charges/{id} antes da baixa e testar idempotência e isolamento. Nada disto está implementado ou validado neste run.
- Não houve merge, deploy, cobrança ou escrita de dados no Supabase.

## Documentação consultada
- https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385502-criar-uma-cobranca-charge-na-api-appypay-gpo-e-refer%C3%AAncia
- https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385504-passo-a-passo-para-configurar-um-webhook-no-portal-appypay
