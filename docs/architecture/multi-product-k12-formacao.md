# KLASSE Multi-Product Architecture (K12 + Formação)

## 1) Product Separation
- `apps/landing` => `klasse.ao` (marketing/landing)
- `apps/web` => K12 product (`app.klasse.ao`)
- `apps/formacao` => Formação product (`formacao.klasse.ao`)
- Shared infra kept as-is:
  - single Supabase project
  - single auth system
  - single database

### Current evolutionary split
- `apps/formacao` created as dedicated deployable app and host boundary.
- Existing Formação routes in `apps/web` remain as compatibility surface during migration phase.

## 2) Tenant Model (`tenant_type`)
- Canonical values: `k12 | formacao`.
- Enforced at DB level in:
  - `public.escolas.tenant_type` (SSOT by tenant)
  - `public.escola_users.tenant_type` (membership-level hardening)
- Backfill strategy:
  - if school has Formação roles (`formacao_*`, `formador`, `formando`) => `formacao`
  - otherwise => `k12`

## 3) Route/Domain Strategy
- `klasse.ao` -> landing only.
- `app.klasse.ao` -> K12 UX and K12-first routes.
- `formacao.klasse.ao` -> Formação UX and Formação-first routes.

### Host-aware behavior
- Host/product mismatch redirects to canonical host.
- `tenant_type` mismatch with accessed product redirects/blocks.
- APIs in protected matchers use 403 on mismatch (no silent fallback).

## 4) Unified Tenant Resolver Design
- Shared resolver implemented in `@moxi/tenant-sdk`:
  - `resolveTenantContext(...)`
  - `detectProductContextFromHostname(...)`
- Output contract:
  - `tenant_id`
  - `tenant_slug`
  - `tenant_type`
  - `user_role`
  - `product_context`

### Resolver source order
1. membership (`escola_users`) for role + tenant membership
2. tenant metadata (`escolas`) for slug + tenant_type
3. fallback tenant_type inference from role when needed

## 5) Middleware Plan
- `apps/web/src/middleware.ts`
  - host -> product context detection
  - cross-product route protection
  - role-vs-product check (`isRoleAllowedForProduct`)
  - tenant_type-vs-path enforcement
- `apps/formacao/middleware.ts`
  - canonical host guard for `formacao.klasse.ao`
  - protected routes require session
  - `tenant_type=k12` redirected to K12 host

## 6) RBAC + Feature Gate Impact
- RBAC:
  - role compatibility with product enforced via `isRoleAllowedForProduct`.
  - `requireRoleInSchool` accepts optional `productContext`.
- Feature gates:
  - matrix now includes:
    - `products` (`k12` and/or `formacao`)
    - `tenantTypes` (`k12` and/or `formacao`)
  - `requireFeature` resolves tenant context and enforces plan + product + tenant_type.

## 7) DB Hardening (Minimal)
- Migration: `20270407194500_tenant_type_foundation.sql`
  - adds/checks `tenant_type` in `escolas` and `escola_users`
  - backfills existing rows
  - trigger to keep `escola_users.tenant_type` synced with school
  - index for lookups (`tenant_type`, `slug`)

## 8) Phased Rollout Plan
1. **Foundation (this change)**
   - introduce tenant_type schema + resolver + middleware guards.
2. **Dual-run**
   - keep legacy Formação routes in `apps/web` while `apps/formacao` becomes canonical host app.
3. **Route migration**
   - migrate Formação pages/APIs from `apps/web` to `apps/formacao` in slices.
4. **Contract hardening**
   - require productContext in critical backend guards.
5. **Cleanup**
   - remove legacy Formação routes from K12 app once traffic is fully switched.

## 9) Non-Goals (explicit)
- no Supabase split
- no auth split
- no microservices
- no data duplication
