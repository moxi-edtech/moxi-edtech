# Apply diff
run_id: CURTUME-ORIGEM-RESULTADO-SQL
ficheiro: supabase/migrations/20270823200000_preserve_rematricula_academic_result.sql

Adiciona a RPC que materializa o resultado anual em `historico_anos`, fecha a
matrícula de origem como `concluido` e guarda a proveniência/observação da
decisão de promoção com pendências.
