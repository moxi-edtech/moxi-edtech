# Apply Diff — Rota canónica de Cobranças

run_id: 0422F7CA-26C8-4C72-8CC2-9F8AFCEE4B78  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/cobrancas/page.tsx`

## Objetivo

Expor a carteira consolidada na rota canónica `/financeiro/cobrancas`, também acessível pelo portal operacional.

## Diff proposto

```diff
+ import CarteiraCobrancasClient from "./CarteiraCobrancasClient";
+ export const dynamic = "force-dynamic";
+ export default function CobrancasPage() { ... }
```

## Risco

Baixo. Nova rota sem substituição ou remoção de fluxos existentes.

## Reversão

Remover o ficheiro da rota.
