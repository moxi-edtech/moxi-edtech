# Apply diff — Agent 3
run_id: 2A4CF8C6-B223-4729-976A-B249DD690EFA

## Ficheiro
`supabase/migrations/20270803130000_complete_k12_rollover.sql`

## Alteração aprovada

- Alinhar os perfis autorizados em `cutover_ano_letivo_v3`.
- Criar aplicação atómica e idempotente dos lotes aprovados.
- Validar tenant, matrícula, turma, ano e avaliação antes de escrever notas.

## Reversão

Reaplicar a definição anterior da RPC e remover a nova RPC numa migration compensatória.
