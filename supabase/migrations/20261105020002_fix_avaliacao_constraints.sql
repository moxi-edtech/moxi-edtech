alter table public.configuracoes_escola
  drop constraint if exists configuracoes_escola_modelo_avaliacao_check,
  drop constraint if exists configuracoes_escola_frequencia_modelo_check,
  drop constraint if exists configuracoes_escola_frequencia_min_percent_check;

alter table public.configuracoes_escola
  add constraint configuracoes_escola_modelo_avaliacao_check
    check (modelo_avaliacao in ('SIMPLIFICADO', 'ANGOLANO_TRADICIONAL', 'COMPETENCIAS', 'DEPOIS')),
  add constraint configuracoes_escola_frequencia_modelo_check
    check (frequencia_modelo in ('POR_AULA', 'POR_PERIODO')),
  add constraint configuracoes_escola_frequencia_min_percent_check
    check (frequencia_min_percent between 0 and 100);
