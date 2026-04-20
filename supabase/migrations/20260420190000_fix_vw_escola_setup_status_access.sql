create or replace view public.vw_escola_setup_status
with (security_invoker = true) as
select
  m.escola_id,
  m.has_ano_letivo_ativo,
  m.has_3_trimestres,
  m.has_curriculo_published,
  m.has_turmas_no_ano,
  m.percentage
from internal.mv_escola_setup_status m
where public.has_access_to_escola_fast(m.escola_id);

