# Diff aplicado — GAP-PERFIL-001

run_id: PORTAL-ALUNO-GAP-PERFIL-001-20260604
status: APPLIED

## Escopo

Separar explicitamente o email de contato do aluno do identificador de login/Auth.

## Decisão

O aluno pode editar `alunos.email` como email de contato. O email/login usado pelo Supabase Auth não é alterado pelo portal do aluno.

Motivo: o login oficial do aluno é derivado de `profiles.numero_processo_login`/`profiles.email_auth`. Permitir que o aluno mude esse identificador no perfil pode quebrar acesso, credenciais liberadas pela secretaria e rastreabilidade.

## Alterações

- `apps/web/src/app/api/aluno/perfil/dados/route.ts`
  - Adicionado `dynamic = "force-dynamic"`.
  - GET retorna `email_contato`, `login_portal`, `email_auth` e `auth_email_mutavel_pelo_aluno=false`.
  - PUT retorna `authEmailUpdated=false` e mensagem explícita de que o login não foi alterado.

- `apps/web/src/components/aluno/tabs/TabPerfil.tsx`
  - Campo editável renomeado para `Email de Contato`.
  - Campo bloqueado `Login do Portal` adicionado.
  - Texto de ajuda informa que atualizar email de contato não altera login.

## Validação

- `pnpm -C apps/web typecheck`: PASS
- `pnpm -C apps/web exec eslint src/app/api/aluno/perfil/dados/route.ts src/components/aluno/tabs/TabPerfil.tsx --max-warnings 10000`: PASS
