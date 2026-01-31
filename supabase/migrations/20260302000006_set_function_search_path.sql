BEGIN;

ALTER FUNCTION public.block_notas_after_lock_date() SET search_path TO 'public';
ALTER FUNCTION public.update_financeiro_from_pagamento(jsonb) SET search_path TO 'public';
ALTER FUNCTION public.gerar_mensalidades_nova_matricula() SET search_path TO 'public';
ALTER FUNCTION public.update_secretaria_from_presenca(jsonb) SET search_path TO 'public';
ALTER FUNCTION public.recalc_secretaria_turma_counts(uuid, uuid, date) SET search_path TO 'public';
ALTER FUNCTION public.admin_get_system_health() SET search_path TO 'public';
ALTER FUNCTION public.trigger_nota_outbox() SET search_path TO 'public';
ALTER FUNCTION public.confirmar_conciliacao_transacao(uuid, uuid, uuid, uuid, uuid) SET search_path TO 'public';
ALTER FUNCTION public.admin_get_escola_health_metrics() SET search_path TO 'public';
ALTER FUNCTION public.admin_recalc_all_aggregates() SET search_path TO 'public';
ALTER FUNCTION public.trigger_matricula_outbox() SET search_path TO 'public';
ALTER FUNCTION public.block_paid_lancamento_update() SET search_path TO 'public';
ALTER FUNCTION public.update_secretaria_from_matricula(jsonb) SET search_path TO 'public';
ALTER FUNCTION public.fechar_periodo_academico(uuid, uuid, uuid) SET search_path TO 'public';
ALTER FUNCTION public.trigger_presenca_outbox() SET search_path TO 'public';
ALTER FUNCTION public.process_outbox_batch_p0_v2(integer, integer) SET search_path TO 'public';
ALTER FUNCTION public.update_pedagogico_from_nota(jsonb) SET search_path TO 'public';
ALTER FUNCTION public.trigger_financeiro_lancamento_outbox() SET search_path TO 'public';
ALTER FUNCTION public.recalc_escola_financeiro_totals(uuid, date) SET search_path TO 'public';

COMMIT;
