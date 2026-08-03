# Aprovação necessária — Agent 3
run_id:    F99550FB-D142-4917-8011-4F35ACF69DD2
timestamp: 2026-08-03T09:31:41Z

## Acção proposta

Aplicar a migração `20270803120000_create_virada_import_staging.sql`, que cria uma área de staging tenant-scoped para receber notas por planilha, formulário manual ou API antes de qualquer mutação oficial.

## Diff

O diff deste run será consolidado em `agents/outputs/APPLY_DIFF_F99550FB-D142-4917-8011-4F35ACF69DD2.md` após os testes finais.

## Risco

A migração adiciona duas tabelas e políticas RLS; uma política incorreta poderia impedir a secretaria de guardar lotes ou expor dados entre escolas, por isso a aplicação requer revisão humana.

## Como aprovar

Commit com mensagem: `APPROVE: F99550FB-D142-4917-8011-4F35ACF69DD2`

## Como rejeitar

Commit com mensagem: `REJECT: F99550FB-D142-4917-8011-4F35ACF69DD2 [motivo]`
