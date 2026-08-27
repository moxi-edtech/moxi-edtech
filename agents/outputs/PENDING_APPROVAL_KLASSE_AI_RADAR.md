# Aprovação necessária — Agent 3
run_id:    1E251454-41E1-4DCD-BCDB-A4ABD2B2B611
timestamp: 2026-07-26T11:02:05Z

## Acção proposta

Adicionar um wrapper `SECURITY DEFINER` com filtro explícito por `auth.uid()` para permitir que utilizadores autenticados consultem `public.vw_radar_inadimplencia` sem receber acesso directo à MV interna.

## Motivo

O teste autenticado actual falha com:

```text
permission denied for materialized view mv_radar_inadimplencia
```

Estado confirmado:

- `public.vw_radar_inadimplencia` usa `security_invoker=true`;
- `authenticated` tem `SELECT` na view pública;
- `authenticated` não tem, correctamente, `SELECT` em `internal.mv_radar_inadimplencia`;
- a view pública tenta ler a MV com os privilégios de `authenticated` e falha.

## Diff

```diff
diff --git a/supabase/migrations/20270726110500_fix_radar_inadimplencia_authenticated_access.sql b/supabase/migrations/20270726110500_fix_radar_inadimplencia_authenticated_access.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270726110500_fix_radar_inadimplencia_authenticated_access.sql
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
+  valor_previsto numeric,
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
+REVOKE ALL
+  ON internal.mv_radar_inadimplencia
+  FROM anon, authenticated;
+
+CREATE OR REPLACE VIEW public.vw_radar_inadimplencia
+WITH (security_invoker = true) AS
+SELECT *
+FROM internal.get_radar_inadimplencia_for_current_user();
+
+ALTER VIEW public.vw_radar_inadimplencia OWNER TO postgres;
+
+REVOKE ALL
+  ON public.vw_radar_inadimplencia
+  FROM PUBLIC, anon, authenticated, service_role;
+
+GRANT SELECT
+  ON public.vw_radar_inadimplencia
+  TO authenticated, service_role;
+
+COMMIT;
```

## Garantias de segurança

- `anon` continua sem acesso.
- `authenticated` continua sem acesso directo à MV interna.
- O filtro por escola é aplicado dentro da função antes de devolver qualquer linha.
- `search_path` vazio evita object shadowing.
- `service_role` mantém acesso operacional explícito.
- Não há alteração de dados, tabelas, RLS ou estrutura da MV.

## Testes obrigatórios após aprovação

1. Utilizador autenticado de uma escola com dados consegue consultar a view.
2. O mesmo utilizador recebe zero linhas de outras escolas.
3. `anon` recebe `permission denied`.
4. `authenticated` não consegue consultar directamente a MV interna.
5. `service_role` continua a conseguir consultar a view.
6. A pergunta “Quantos alunos em dívida temos na turma da 6 classe?” chega à desambiguação ou ao agregado correcto.

## Rollback proposto

```sql
BEGIN;

CREATE OR REPLACE VIEW public.vw_radar_inadimplencia
WITH (security_invoker = true) AS
SELECT *
FROM internal.mv_radar_inadimplencia AS m
WHERE m.escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users AS eu
  WHERE eu.user_id = auth.uid()
);

ALTER VIEW public.vw_radar_inadimplencia OWNER TO postgres;

REVOKE ALL ON public.vw_radar_inadimplencia FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vw_radar_inadimplencia TO authenticated;

DROP FUNCTION IF EXISTS internal.get_radar_inadimplencia_for_current_user();

COMMIT;
```

O rollback restaura o estado anterior, incluindo a limitação de acesso autenticado que motivou esta proposta.

## Risco

Uma implementação incorrecta de `SECURITY DEFINER` poderia expor dados financeiros entre escolas; por isso o filtro tenant, os grants mínimos e os testes de isolamento são bloqueantes.

## Como aprovar

Commit com mensagem: `APPROVE: 1E251454-41E1-4DCD-BCDB-A4ABD2B2B611`

## Como rejeitar

Commit com mensagem: `REJECT: 1E251454-41E1-4DCD-BCDB-A4ABD2B2B611 [motivo]`
