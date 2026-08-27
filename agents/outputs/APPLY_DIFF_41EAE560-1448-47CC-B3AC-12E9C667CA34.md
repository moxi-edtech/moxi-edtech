# Apply diff
run_id: 41EAE560-1448-47CC-B3AC-12E9C667CA34
ficheiro: supabase/migrations/20270823170000_pagamentos_comprovativo_consolidado.sql

Cria duas RPCs transaccionais: submissão de várias mensalidades sob o mesmo
`lote_id` e decisão atómica de todos os pagamentos pertencentes ao lote.
