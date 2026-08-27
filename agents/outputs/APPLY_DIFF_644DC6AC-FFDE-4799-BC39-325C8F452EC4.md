# Apply Diff — Rematrícula Balcão / Reconciliação

run_id: 644DC6AC-FFDE-4799-BC39-325C8F452EC4
timestamp: 2026-08-10T00:00:00-03:00

## Acção proposta

Corrigir a finalização de rematrículas para gerar o número oficial da matrícula
e permitir a conclusão idempotente de pedidos cujo pagamento foi liquidado mas
cuja etapa académica ficou pendente.

## Ficheiros alterados

- `supabase/migrations/20260810100000_harden_balcao_rematricula_number.sql`
  - insere novas matrículas como `pendente`;
  - chama `confirmar_matricula_core` para gerar `numero_matricula`;
  - activa a matrícula somente depois de possuir número;
  - preserva a reconciliação do pedido no mesmo fluxo.
- `apps/web/src/app/api/secretaria/balcao/rematriculas/reconcile/route.ts`
  - adiciona `action: complete`;
  - exige pagamento liquidado associado ao pedido;
  - executa a finalização canónica e emite/reutiliza comprovante;
  - regista auditoria.
- `apps/web/src/hooks/useRematriculaBalcao.ts`
  - adiciona ação de reconciliação sem nova cobrança.
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx`
  - apresenta CTA operacional “Concluir reconciliação”;
  - mostra erro de reconciliação com `role="alert"`.

## Diff funcional exacto

```diff
+ action: "complete" no endpoint de reconciliação
+ pagamento liquidado obrigatório antes da conclusão
+ RPC de rematrícula usa confirmar_matricula_core para número oficial
+ UI deixa de mostrar pendência sem próximo passo
+ nenhum pagamento é criado novamente
```

## Verificação

- `P0_CHECKLIST.md`: todos os itens PASS.
- `pnpm --filter web exec tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- ESLint direcionado: 0 erros; warnings preexistentes no fluxo.
- Nenhum SQL foi executado no banco remoto nesta aplicação.

## Risco

Alteração de comportamento da RPC de finalização e da reconciliação de pedidos
financeiros; reversível por um único `git revert` antes de aplicar a migration.

## Próximo passo

Aplicar a migration no ambiente de staging, testar o pedido do Cheme em modo
controlado e só depois executar a reconciliação explícita do pedido pendente.
