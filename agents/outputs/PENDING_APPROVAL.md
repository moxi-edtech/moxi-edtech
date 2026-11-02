# Aprovação necessária — Agent 3
run_id: 8bdcf683-0dfe-4ac8-9b0c-3a2fd5e1d840
timestamp: 2026-11-02T18:04:26.873819+00:00
status: PENDENTE; nenhum SQL aplicado

## Acção proposta
Criar a tabela privada public.whatsapp_appypay_test_sessions no projeto KLASSE wjtifcpxxxotsbmvbgoq, exclusiva para sessões fictícias sandbox de 100 AOA da Escola KLASSE, deste Flow e do remetente FEXA. Sem FK, trigger, atualização de propinas, alunos ou tabelas financeiras existentes. RLS habilitado sem políticas de clientes; apenas o servidor tem SELECT/INSERT/UPDATE. Sessões expiram para uso após no máximo 30 minutos; respostas incertas não repetem POST.

Novo contrato SQL e privilégios de acesso requerem aprovação segundo AGENTS.md, Agent 3: “Mudança de contrato SQL (nomes de colunas, tipos)”. Esta interpretação aplica a regra ao novo store e aos seus privilégios; não é alteração de RLS de tabelas existentes.

Ficheiro: docs/financeiro/whatsapp-flows/session-store.proposed.sql
SHA256 exacto: c8148fd55bf05a8b34e5511e9fd3763ec3ea47e7796e133f35be49d0995e7c88

## Diff
```diff
--- /dev/null
+++ b/docs/financeiro/whatsapp-flows/session-store.proposed.sql
@@ -0,0 +1,33 @@
+BEGIN;
+-- Only fictitious AppyPay sandbox sessions; no FK or trigger touches real ledgers.
+CREATE TABLE public.whatsapp_appypay_test_sessions (
+  id uuid PRIMARY KEY,
+  school_id uuid NOT NULL CHECK (school_id = 'f406f5a7-a077-431c-b118-297224925726'::uuid),
+  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
+  flow_id text NOT NULL CHECK (flow_id = '2328444514659033'),
+  phone_id text NOT NULL CHECK (phone_id = '1295106843688961'),
+  state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready', 'issuing', 'issued', 'simulating', 'paid')),
+  reference_payload jsonb NOT NULL,
+  expires_at timestamptz NOT NULL,
+  created_at timestamptz NOT NULL DEFAULT now(),
+  updated_at timestamptz NOT NULL DEFAULT now(),
+  CHECK (expires_at > created_at AND expires_at <= created_at + interval '31 minutes'),
+  CHECK (coalesce(
+    jsonb_typeof(reference_payload) = 'object'
+    AND reference_payload->'amount' = '100'::jsonb
+    AND reference_payload->>'currency' = 'AOA'
+    AND reference_payload->>'school_id' = school_id::text
+    AND reference_payload->>'obligation_id' = id::text
+    AND reference_payload->>'reference' ~ '^[0-9]{9}$'
+    AND jsonb_typeof(reference_payload->'provider_payload') = 'object', false))
+);
+CREATE INDEX ix_whatsapp_appypay_test_expiry ON public.whatsapp_appypay_test_sessions(expires_at);
+CREATE UNIQUE INDEX ux_whatsapp_appypay_test_charge
+  ON public.whatsapp_appypay_test_sessions ((reference_payload->>'provider_reference_id'))
+  WHERE state IN ('issued', 'simulating', 'paid');
+ALTER TABLE public.whatsapp_appypay_test_sessions ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON public.whatsapp_appypay_test_sessions FROM PUBLIC, anon, authenticated, service_role;
+GRANT SELECT, INSERT, UPDATE ON public.whatsapp_appypay_test_sessions TO service_role;
+COMMENT ON TABLE public.whatsapp_appypay_test_sessions IS
+  'Private server-only sandbox fixtures, fixed 100 AOA; no real obligations or student identifiers. No client policies by design.';
+COMMIT;
```

## Risco
Uma implementação incorreta de persistência ou privilégios poderia expor ou duplicar sessões de teste. A tabela não contém dados de alunos, tokens brutos ou segredos, e os CHECKs fixam escola/Flow/remetente/100 AOA. A autorização não concede exceção ao gate global nem permite cobranças reais.

## Verificação preparada
39 testes passaram; lint e typecheck global apps/web passaram. SQL revisado mas não executado em Postgres; após aprovação, aplicar via migration, verificar RLS/privilégios/constraints e concorrência com fixtures. Meta ainda exige reautenticação para ler o App Secret, e o token Cloud API ainda não foi fornecido. Chaves locais preparadas, não publicadas. Nenhuma mensagem enviada; destinatário escolhido guardado apenas em ficheiro privado.

## Como aprovar
Commit com mensagem: `APPROVE: 8bdcf683-0dfe-4ac8-9b0c-3a2fd5e1d840`
O proprietário pode confirmar essa mensagem nesta conversa para registar o commit de aprovação do diff acima.

## Como rejeitar
Commit com mensagem: `REJECT: 8bdcf683-0dfe-4ac8-9b0c-3a2fd5e1d840 [motivo]`

A aprovação cf8dc48d-6b39-47d3-af87-410afcf95ddb anterior continua aplicada à migração de serviços; não autoriza este novo SQL. O gate global mantém can_merge=false e não foi contornado.
