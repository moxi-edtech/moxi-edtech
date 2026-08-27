# KLASSE — Apply Diff
run_id: 19485B3A-EB9B-49AD-A726-59E12B81AE62
timestamp: 2026-08-23T14:11:18Z

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão em PASS.

## Alteração proposta

Transformar o aviso de mensalidades pendentes do dashboard do aluno num ponto
de entrada contextual para regularização financeira da rematrícula, com texto
explicativo e CTA para consultar valores e enviar comprovativos.

O fluxo de upload, fila de validação e liquidação existente será reutilizado;
nenhum dado financeiro, schema ou política RLS será alterado.

## Ficheiro

`apps/web/src/components/aluno/dashboard/DashboardLoader.tsx`

## Diff proposto

```diff
- Aviso passivo com pill “Regularizar”.
+ Aviso contextual sobre ativação da rematrícula.
+ Botão “Ver dívida e enviar comprovativo” para `/aluno/financeiro`.
```

## Reversão

Reversível num único `git revert` do commit correspondente.
