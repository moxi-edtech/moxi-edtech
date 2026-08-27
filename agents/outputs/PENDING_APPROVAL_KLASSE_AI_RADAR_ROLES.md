# Aprovação necessária — Agent 3
run_id:    3EF4B171-1EB9-4AF8-A0E6-289CC133BC26
timestamp: 2026-07-26T11:10:30Z

## Acção proposta

Restringir o wrapper financeiro do Radar KLASSE IA a utilizadores K12 com um dos seguintes valores em `escola_users.papel`:

- `admin`
- `admin_escola`
- `staff_admin`
- `secretaria`
- `financeiro`
- `admin_financeiro`
- `secretaria_financeiro`

Todos os demais cargos ficam bloqueados por padrão.

## Evidência de alinhamento

- O cargo funcional está em `escola_users.papel`.
- `escola_users.role` contém predominantemente o valor técnico `staff` e não deve ser usado para autorização funcional.
- Os cargos compostos existentes no constraint são `admin_financeiro` e `secretaria_financeiro`.
- A allowlist corresponde ao registry `assistant.finance` do KLASSE, removendo os aliases não existentes no constraint do banco.

## Diff

```diff
diff --git a/supabase/migrations/20270726111500_harden_radar_inadimplencia_finance_roles.sql b/supabase/migrations/20270726111500_harden_radar_inadimplencia_finance_roles.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270726111500_harden_radar_inadimplencia_finance_roles.sql
@@
+BEGIN;
+
+CREATE OR REPLACE FUNCTION internal.get_radar_inadimplencia_for_current_user()
+RETURNS TABLE (
+  escola_id uuid,
+  mensalidade_id uuid,
+  aluno_id uuid,
+  nome_aluno text,
+  responsavel text,
+  telefone text,
+  nome_turma text,
+  valor_previsto numeric(10,2),
+  valor_pago_total numeric,
+  valor_em_atraso numeric,
+  data_vencimento date,
+  dias_em_atraso integer,
+  status_risco text,
+  status_mensalidade text
+)
+LANGUAGE sql
+STABLE
+SECURITY DEFINER
+SET search_path = ''
+AS $$
+  SELECT
+    m.escola_id,
+    m.mensalidade_id,
+    m.aluno_id,
+    m.nome_aluno,
+    m.responsavel,
+    m.telefone,
+    m.nome_turma,
+    m.valor_previsto,
+    m.valor_pago_total,
+    m.valor_em_atraso,
+    m.data_vencimento,
+    m.dias_em_atraso,
+    m.status_risco,
+    m.status_mensalidade
+  FROM internal.mv_radar_inadimplencia AS m
+  WHERE auth.role() = 'service_role'
+     OR EXISTS (
+       SELECT 1
+       FROM public.escola_users AS eu
+       WHERE eu.escola_id = m.escola_id
+         AND eu.user_id = auth.uid()
+         AND eu.tenant_type = 'k12'
+         AND lower(trim(coalesce(eu.papel, ''))) = ANY (
+           ARRAY[
+             'admin',
+             'admin_escola',
+             'staff_admin',
+             'secretaria',
+             'financeiro',
+             'admin_financeiro',
+             'secretaria_financeiro'
+           ]::text[]
+         )
+     );
+$$;
+
+REVOKE ALL
+  ON FUNCTION internal.get_radar_inadimplencia_for_current_user()
+  FROM PUBLIC, anon, authenticated, service_role;
+
+GRANT EXECUTE
+  ON FUNCTION internal.get_radar_inadimplencia_for_current_user()
+  TO authenticated, service_role;
+
+COMMIT;
```

## Garantias de segurança

- A autorização é fail-closed: cargos ausentes ou desconhecidos não recebem dados.
- `aluno`, `professor`, `formador`, `formando` e cargos de Formação ficam bloqueados.
- O filtro de `escola_id` e `auth.uid()` permanece obrigatório.
- `authenticated` continua sem `SELECT` directo na MV.
- `anon` continua sem acesso.
- `service_role` mantém o acesso operacional já aprovado.
- Nenhuma linha, tabela, constraint ou política RLS é alterada.

## Testes obrigatórios após aprovação

1. Cada cargo autorizado existente consegue consultar apenas a própria escola.
2. `professor` da mesma escola recebe zero linhas.
3. `aluno` da mesma escola recebe zero linhas.
4. Cargo desconhecido ou `papel` nulo recebe zero linhas.
5. Utilizador autorizado recebe zero linhas de outro tenant.
6. `anon` continua sem `SELECT` na view.
7. `authenticated` continua sem `SELECT` directo na MV.
8. `service_role` continua a consultar as duas escolas da MV.

## Rollback proposto

```sql
BEGIN;

CREATE OR REPLACE FUNCTION internal.get_radar_inadimplencia_for_current_user()
RETURNS TABLE (
  escola_id uuid,
  mensalidade_id uuid,
  aluno_id uuid,
  nome_aluno text,
  responsavel text,
  telefone text,
  nome_turma text,
  valor_previsto numeric(10,2),
  valor_pago_total numeric,
  valor_em_atraso numeric,
  data_vencimento date,
  dias_em_atraso integer,
  status_risco text,
  status_mensalidade text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    m.escola_id,
    m.mensalidade_id,
    m.aluno_id,
    m.nome_aluno,
    m.responsavel,
    m.telefone,
    m.nome_turma,
    m.valor_previsto,
    m.valor_pago_total,
    m.valor_em_atraso,
    m.data_vencimento,
    m.dias_em_atraso,
    m.status_risco,
    m.status_mensalidade
  FROM internal.mv_radar_inadimplencia AS m
  WHERE auth.role() = 'service_role'
     OR EXISTS (
       SELECT 1
       FROM public.escola_users AS eu
       WHERE eu.escola_id = m.escola_id
         AND eu.user_id = auth.uid()
     );
$$;

COMMIT;
```

## Risco

Uma allowlist incompleta pode bloquear um cargo legítimo; uma allowlist excessiva pode expor PII financeira. Os testes por cargo e o bloqueio fail-closed são obrigatórios.

## Como aprovar

Commit com mensagem: `APPROVE: 3EF4B171-1EB9-4AF8-A0E6-289CC133BC26`

## Como rejeitar

Commit com mensagem: `REJECT: 3EF4B171-1EB9-4AF8-A0E6-289CC133BC26 [motivo]`
