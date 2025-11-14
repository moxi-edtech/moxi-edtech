-- Runs the partition helpers to eagerly create the current and next month
-- partitions for frequencias/lancamentos. Safe to execute multiple times.
DO $$
BEGIN
  PERFORM public.create_month_partition('frequencias', date_trunc('month', current_date)::date);
  PERFORM public.create_month_partition('frequencias', date_trunc('month', current_date + interval '1 month')::date);
  PERFORM public.create_month_partition_ts('lancamentos', date_trunc('month', current_date)::date);
  PERFORM public.create_month_partition_ts('lancamentos', date_trunc('month', current_date + interval '1 month')::date);
EXCEPTION
  WHEN others THEN
    RAISE NOTICE '[partitions] erro ao criar partições: %', SQLERRM;
END;
$$;
