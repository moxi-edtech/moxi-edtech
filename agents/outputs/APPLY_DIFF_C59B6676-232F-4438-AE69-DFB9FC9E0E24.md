# Apply diff — Agent 3
run_id: C59B6676-232F-4438-AE69-DFB9FC9E0E24
timestamp: 2026-07-26T12:00:42Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Criar a ferramenta fechada do radar pedagógico no Data Copilot.

## Diff proposto
```diff
+++ apps/web/src/lib/assistant/data-copilot/tools/academic-pedagogical-risk.ts
+ intenção tolerante a gralhas
+ consulta agregada da view canónica
+ distinção segura entre risco accionável e cobertura insuficiente
+ acções humanas para rever notas e frequência
```

## Risco
Baixo: novo ficheiro sem mutações ou exposição de dados pessoais.

## Reversão
Um único `git revert`.
