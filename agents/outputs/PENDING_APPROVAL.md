# Aprovação necessária — Agent 3
run_id:    598B12B4-B6B1-461F-A4DD-026E1BDD9764
timestamp: 2026-06-04T11:22:27Z
status:    APPROVED_AND_APPLIED

## Acção proposta

Reduzir a saturação de compute causada por tempestade de jobs pg_cron.

- Distribuir 24 refreshes de MVs ao longo dos respectivos intervalos.
- Manter a frequência atual de cada MV.
- Desativar `refresh_all_materialized_views()` diário, redundante com os jobs individuais.
- Desativar `cleanup_pautas_zip()`, que falha por apagar diretamente da tabela do Storage.

## Evidência

- Conexões: `21/60`; sem locks.
- `626/5326` jobs falharam nas últimas 24 horas.
- Erro predominante: `job startup timeout`.
- Minutos `00` e `30`: até `27` jobs iniciando simultaneamente.
- Os refreshes de MVs dominam as consultas mais caras.
- `get_secretaria_produtividade_hoje` é a RPC mais cara acumulada, mas não apresenta loop atual no frontend.

## Diff

Migration:

`supabase/migrations/20260604112227_stagger_pg_cron_compute_load.sql`

Distribuição planejada:

- Jobs de 10 minutos: um por minuto entre `0` e `9`.
- Jobs de 30 minutos: um a cada 2 minutos.
- Jobs de 15/20/60 minutos: offsets separados.

## Risco

Os dados materializados podem atualizar alguns minutos depois do horário atual, sem alterar sua frequência máxima. Desativar o cleanup quebrado mantém arquivos de pautas até uma correção via Storage API.

## Salvaguardas

- Nenhuma MV obrigatória será removida.
- Nenhuma frequência será reduzida.
- Migration transacional.
- Simulação com rollback antes da aplicação.
- Verificação pós-apply dos schedules e falhas.

## Resultado

- Aplicado em `2026-06-04`.
- Migration registrada como `20260604112227`.
- Jobs redundantes/quebrados removidos.
- Pico observado reduzido de `25–27` para `6` jobs por minuto.
- Zero falhas observadas após o escalonamento.
- `pnpm --filter web typecheck` passou.

## Como aprovar

`APPROVE: 598B12B4-B6B1-461F-A4DD-026E1BDD9764`

## Como rejeitar

`REJECT: 598B12B4-B6B1-461F-A4DD-026E1BDD9764 [motivo]`
