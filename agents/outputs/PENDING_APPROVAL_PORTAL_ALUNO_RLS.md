# Aprovação necessária — Agent 3

run_id:    PORTAL-ALUNO-RLS-20260604
timestamp: 2026-06-04T15:00:00Z
status:    APPROVED_AND_APPLIED

## Acção proposta

Corrigir o finding crítico `GAP-SEC-001`:

- Remover a política ampla `tenant_all_access` de `public.alunos`.
- Manter leitura compatível para utilizadores autorizados da escola.
- Restringir INSERT, UPDATE e DELETE de alunos a staff autorizado.
- Criar RPC `aluno_atualizar_contatos_proprios` com allowlist para email, telefone e endereço.
- Alterar `/api/aluno/perfil/dados` para usar a RPC em vez de UPDATE direto.

## Diff

```diff
- CREATE POLICY tenant_all_access ON public.alunos FOR ALL TO authenticated
-   USING (escola_id = current_tenant_escola_id() OR is_super_admin())
-   WITH CHECK (escola_id = current_tenant_escola_id() OR is_super_admin());
+ políticas separadas de SELECT e mutação
+ mutações diretas restritas a staff/super_admin
+ RPC SECURITY DEFINER valida auth.uid(), escola, aluno e allowlist de contatos
+ API do aluno chama RPC para atualizar somente email, telefone e endereco
```

## Risco

Uma política incorreta pode bloquear operações legítimas da secretaria ou permitir alteração lateral de dados. A migration será simulada com rollback e validada com perfis de aluno e staff antes da aplicação.

## Como aprovar

`APPROVE: PORTAL-ALUNO-RLS-20260604`

## Como rejeitar

`REJECT: PORTAL-ALUNO-RLS-20260604 [motivo]`

## Resultado

- Migration aplicada: `20270604193241_harden_alunos_rls_self_contact_update.sql`
- Migration registrada no histórico Supabase.
- Quatro políticas separadas ativas em `public.alunos`.
- RPC executável por `authenticated`; grant explícito de `anon` removido.
- Assertion aluno: update próprio direto `0`, update lateral `0`, RPC própria `1`.
- Assertion staff: update direto `1`.
- Testes de autorização executados em transações com rollback.
- Typecheck, lint e diff check passaram.
