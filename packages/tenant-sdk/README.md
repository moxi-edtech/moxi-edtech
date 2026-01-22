# @moxi/tenant-sdk

SDK interno para operações multi-tenant no Supabase.

## Objetivo
- Garantir acesso a dados sempre escopado por `escola_id`.
- Centralizar criação de cliente service-role para operações administrativas.
- Cache local (processo) para configurações da escola.

## Uso

```ts
import {
  createServiceRoleClient,
  scopeToTenant,
  getTenantConfig,
  invalidateTenantConfig,
} from "@moxi/tenant-sdk";

const client = createServiceRoleClient();
const escolaId = "uuid-da-escola";

const { data } = await scopeToTenant(client, "turmas", escolaId)
  .select("id, nome")
  .order("nome");

const config = await getTenantConfig(escolaId, { client });
invalidateTenantConfig(escolaId);
```

## Funções expostas
- `createServiceRoleClient()` cria um `SupabaseClient` usando `SUPABASE_SERVICE_ROLE_KEY`.
- `scopeToTenant(client, table, escolaId)` adiciona `.eq("escola_id", escolaId)`.
- `getTenantConfig(escolaId, { client, refresh })` carrega `escola_configuracoes` com cache.
- `invalidateTenantConfig(escolaId)` invalida o cache de uma escola.
- `clearTenantConfigCache()` limpa todo o cache em memória.

## Requisitos de ambiente
- `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Boas práticas
- Não use service-role em rotas humanas sem autorização explícita.
- Sempre valide `escola_id` com `resolveEscolaIdForUser` antes de chamar o SDK em APIs públicas.
