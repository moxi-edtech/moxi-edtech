# Apply Diff — Cockpit administrativo de comissões
run_id: AEA38376-D029-4FCC-B698-DC0C8AE369D8
timestamp: 2026-06-28T00:00:00-03:00
commit: 4d3a1f79

## Escopo

Implementar o primeiro bloco do backlog pós-sincronização CRM:

- cockpit administrativo de comissões do parceiro
- listagem Super Admin
- ações de aprovação, bloqueio, pagamento, cancelamento e reabertura
- auditoria operacional e navegação de acesso

## Diff

```diff
+ apps/web/src/app/api/super-admin/commissions/route.ts
+ apps/web/src/app/api/super-admin/commissions/[id]/route.ts
+ apps/web/src/app/super-admin/comissoes/page.tsx
+ apps/web/src/components/super-admin/comissoes/PartnerCommissionsClient.tsx
~ apps/web/src/components/super-admin/QuickActionsSection.tsx
~ plan_crm_execution_backlog.md
~ plan_crm_execution_status.md
```

## Risco

Mudança operacional no fluxo comercial do Super Admin; erro de implementação afetaria apenas a gestão administrativa de comissões e não a geração do ledger em si.
