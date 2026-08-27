# Apply Diff — Contrato de navegação consolidada

run_id: DAB216E2-9AA5-48BA-91C6-C27F7961E5C7  
data: 2026-08-02  
ficheiro alvo: `apps/web/tests/unit/operacoes-access-and-navigation.spec.ts`

## Objetivo

Actualizar a matriz esperada do menu operacional para a entrada única de Cobranças.

## Diff proposto

```diff
- Cobranças → /financeiro/radar
- Alunos e turmas → /financeiro/turmas-alunos
+ Cobranças → /financeiro/cobrancas
```

## Risco

Baixo. Ajuste de teste à decisão de UX aprovada.

## Reversão

Restaurar as duas expectativas anteriores.
