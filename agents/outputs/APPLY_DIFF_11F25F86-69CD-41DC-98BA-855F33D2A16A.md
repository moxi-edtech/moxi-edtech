# Apply diff — Agent 3
run_id: 11F25F86-69CD-41DC-98BA-855F33D2A16A

## Ficheiro
`supabase/migrations/20270803131000_seed_calendarios_k12_2026_2027.sql`

## Alteração aprovada

- Inserir três templates oficiais MED, cada um com subsistema próprio.
- Usar IDs determinísticos e upserts idempotentes.
- Não modificar o template Regular/Adultos.

## Reversão

Migration compensatória limitada aos três IDs determinísticos.
