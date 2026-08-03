# Aprovação necessária — Agent 3
run_id:    FAF27C77-93BF-442F-98C3-9EC7784750B8
timestamp: 2026-08-03T08:49:29Z

## Acção proposta

Criar a migração aditiva `20270803100000_evolve_calendario_template_model.sql` para distinguir períodos letivos de provas, ampliar os tipos de eventos oficiais e acrescentar ao catálogo de templates o subsistema, a proveniência, a versão documental e o estado editorial.

## Diff

O diff exato está em `agents/outputs/APPLY_DIFF_FAF27C77-93BF-442F-98C3-9EC7784750B8.md`.

## Risco

A alteração amplia um enum PostgreSQL e o contrato das tabelas de calendário; consumidores com unions TypeScript ou validações exaustivas podem precisar de regeneração de tipos e adaptação antes do seed 2026/2027.

## Como aprovar

Commit com mensagem: `APPROVE: FAF27C77-93BF-442F-98C3-9EC7784750B8`

## Como rejeitar

Commit com mensagem: `REJECT: FAF27C77-93BF-442F-98C3-9EC7784750B8 [motivo]`
