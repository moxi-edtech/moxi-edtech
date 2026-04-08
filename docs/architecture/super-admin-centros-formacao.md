# Super Admin — Centros de Formação

## Escopo implementado
- Listagem de centros: `/super-admin/centros-formacao`
- Wizard de criação em 5 passos: `/super-admin/centros-formacao/novo`
- Provisionamento inicial (tenant + equipa): `POST /api/super-admin/centros-formacao/provision`
- API de listagem: `GET /api/super-admin/centros-formacao/list`

## Modelo de dados
Migration: `supabase/migrations/20270408010000_create_centros_formacao.sql`

Tabela `public.centros_formacao` (1:1 com `public.escolas` via `escola_id`):
- Identidade: `nome`, `abrev`, `logo_url`
- Fiscal: `nipc`, `nif`, `registo_maptess`, `regime_iva`, `moeda`
- Contacto: `morada`, `municipio`, `provincia`, `telefone`, `email`, `website`
- Operacional: `areas_formacao` (jsonb), `modalidades` (jsonb), `capacidade_max`
- Estado/plano: `status` (`onboarding|ativo|suspenso|cancelado`), `plano` (`basic|pro|enterprise`)
- Auditoria: `provisionado_por`, `notas_admin`, `created_at`, `updated_at`

RLS:
- `SELECT`: `check_super_admin_role()` ou membro do tenant com papel de formação.
- `ALL` mutações: apenas `check_super_admin_role()`.

## Fluxo de provisionamento (API)
1. Valida sessão e papel `super_admin`.
2. Valida payload do wizard (zod).
3. Garante equipa mínima: 1 `formacao_admin` + 1 `formacao_secretaria`.
4. Cria escola-base via RPC `create_escola_with_admin`.
5. Ajusta tenant para produto formação:
   - `escolas.tenant_type = 'formacao'`
   - `escolas.plano_atual` mapeado de `basic/pro/enterprise` para `essencial/profissional/premium`
6. Upsert em `centros_formacao` com dados completos do centro.
7. Provisiona cada utilizador da equipa inicial:
   - cria/reaproveita `auth.users`
   - atualiza `app_metadata` com `tenant_type = formacao`
   - upsert em `profiles`
   - upsert em `escola_users` com `papel` de formação
   - se `formacao_admin`, upsert em `escola_administradores`

## Observações
- O módulo mantém **backend, auth e DB partilhados** com K12.
- A criação usa o tenant existente (`escolas`) com `tenant_type = formacao` como SSOT de produto.
- A listagem do super-admin lê da tabela `centros_formacao` e não de views derivadas.
