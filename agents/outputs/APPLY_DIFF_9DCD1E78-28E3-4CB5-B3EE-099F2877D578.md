# Apply diff — Agent 3
run_id: 9DCD1E78-28E3-4CB5-B3EE-099F2877D578
timestamp: 2026-07-26T12:44:31Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Reconhecer “alunos em dívida” como consulta do resumo financeiro geral.

## Diff proposto
```diff
 finance-risk-summary.ts
+ "aluno" nos termos diagnósticos
```

## Risco
Baixo: amplia apenas o roteamento para uma consulta financeira canónica.

## Reversão
Um único `git revert`.
