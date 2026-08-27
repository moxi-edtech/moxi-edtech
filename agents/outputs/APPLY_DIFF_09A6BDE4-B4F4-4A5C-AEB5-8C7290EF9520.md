# Apply Diff — dedicated school profile audit

run_id: 09A6BDE4-B4F4-4A5C-AEB5-8C7290EF9520
timestamp: 2026-08-21T00:00:00-03:00
scope: repo-only; no live database apply

## Acção proposta

Adicionar a migration `20260821150000_school_profile_audit_logs.sql` para criar a auditoria dedicada do perfil institucional.

## Diff proposto

```diff
diff --git a/supabase/migrations/20260821150000_school_profile_audit_logs.sql b/supabase/migrations/20260821150000_school_profile_audit_logs.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20260821150000_school_profile_audit_logs.sql
@@
+CREATE TABLE public.school_profile_audit_logs (...);
+ALTER TABLE public.school_profile_audit_logs ENABLE ROW LEVEL SECURITY;
+CREATE FUNCTION public.record_school_profile_audit(...);
+CREATE TRIGGER ... BEFORE UPDATE OR DELETE ...;
```

## Risco

Baixo no repo. A migration não é executada no banco live nesta etapa. Em produção, a função SECURITY DEFINER e as policies serão aplicadas somente durante o deploy/migration aprovado.

## Salvaguardas

- sem `DROP`, `TRUNCATE`, `DELETE` ou alteração de tabelas financeiras;
- escrita autenticada somente via função protegida para Super Admin;
- UPDATE/DELETE bloqueados por trigger append-only;
- retenção independente do cleanup genérico de `audit_logs`;
- `escola_auditoria` e `audit_logs` não serão usados como fonte única desse histórico.

## Verificação pós-apply

- `git diff --check`;
- inspeção estática da migration;
- `pnpm -C apps/web typecheck` não é afetado por SQL, mas permanece parte do gate geral.
