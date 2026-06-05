# Apply Diff — GAP-REM-001

data: 2026-06-04
finding: GAP-REM-001

## Ação

Aplicar comportamento fail-closed às consultas usadas na elegibilidade financeira da rematrícula.

## Diff proposto

```diff
- ignorar erros das consultas de ano, candidatura, matrícula e mensalidades
+ verificar erros explicitamente
+ limitar consultas por escola_id
+ bloquear confirmação quando a situação financeira não puder ser validada
```

## Risco

Em caso de indisponibilidade do banco, o aluno não conseguirá solicitar rematrícula até a consulta voltar a funcionar.

## Reversão

Reverter as alterações nas rotas de status e confirmação da rematrícula.
