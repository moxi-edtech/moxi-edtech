# Apply diff — Agent 3
run_id: 94DA5AA4-FC0C-470C-B22A-BF266B99E6F1
timestamp: 2026-07-26T12:01:56Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Adicionar cobertura unitária para intenção de risco pedagógico com gralha e para falso positivo financeiro.

## Diff proposto
```diff
 apps/web/tests/unit/query-matcher.spec.ts
+ caso positivo de risco pedagógico
+ caso negativo de risco financeiro
```

## Risco
Baixo: apenas testes.

## Reversão
Um único `git revert`.
