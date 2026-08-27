# Apply diff — Agent 3
run_id: F2CADC11-CD3A-4AA6-ADBD-5B8B40A3B441
timestamp: 2026-07-26T12:02:39Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Endurecer o matcher do radar pedagógico contra gralhas e colisões com risco financeiro.

## Diff proposto
```diff
 academic-pedagogical-risk.ts
- matcher genérico de expressão composta
+ risco + qualificador pedagógico avaliados separadamente
+ contexto académico explícito
```

## Risco
Baixo: restringe o roteamento sem alterar dados.

## Reversão
Um único `git revert`.
