# Apply diff — Agent 3
run_id: 3E280C67-5238-47C8-B1B4-E2FDCDF69AFE
timestamp: 2026-07-26T11:54:13Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Criar uma ferramenta fechada do Data Copilot para consultar o radar de risco pedagógico já aprovado e materializado.

## Diff proposto
```diff
+++ apps/web/src/lib/assistant/data-copilot/tools/academic-pedagogical-risk.ts
+ matcher tolerante a gralhas para intenção de risco pedagógico
+ leitura agregada de public.vw_risco_pedagogico_aluno
+ separação explícita entre sinais accionáveis e cobertura insuficiente
+ evidências agregadas e acções de revisão de notas/frequência
```

## Risco
Baixo: adiciona um ficheiro sem alterar schema, RLS, dados reais ou contratos existentes.

## Reversão
Remover o novo ficheiro num único `git revert`.
