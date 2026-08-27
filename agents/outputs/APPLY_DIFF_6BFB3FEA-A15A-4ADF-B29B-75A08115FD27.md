# Apply diff — Agent 3
run_id: 6BFB3FEA-A15A-4ADF-B29B-75A08115FD27
timestamp: 2026-07-26T12:55:56Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Impedir falso “sem risco” quando a cobertura de frequência é inexistente ou parcial.

## Diff proposto
```diff
 academic-low-attendance.ts
+ contagem de matrículas activas e alunos cobertos
+ diagnóstico explícito de dados insuficientes/parciais
+ evidências de cobertura
```

## Risco
Baixo: somente leitura e apresentação mais conservadora.

## Reversão
Um único `git revert`.
