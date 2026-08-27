# Apply diff — Agent 3
run_id: 2C12463D-912D-47BA-BF8A-BC9B4F6096D4
timestamp: 2026-07-26T12:58:02Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Exibir cobertura parcial do briefing e calcular severidade pelos sinais retornados.

## Diff proposto
```diff
 school-daily-briefing.ts
+ fontes elegíveis e indisponíveis
+ aviso explícito de briefing parcial
+ severidade dinâmica info/low/medium/high
+ evidência de cobertura das fontes
```

## Risco
Baixo: altera somente composição e metadados do briefing.

## Reversão
Um único `git revert`.
