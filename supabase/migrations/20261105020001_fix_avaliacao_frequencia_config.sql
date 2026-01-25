alter table public.configuracoes_escola
  add column if not exists frequencia_modelo text,
  add column if not exists frequencia_min_percent integer,
  add column if not exists avaliacao_config jsonb;

alter table public.configuracoes_escola
  drop constraint if exists configuracoes_escola_modelo_avaliacao_check;

update public.configuracoes_escola
set
  modelo_avaliacao = case
    when modelo_avaliacao is null then 'SIMPLIFICADO'
    when lower(modelo_avaliacao) = 'simplificado' then 'SIMPLIFICADO'
    when lower(modelo_avaliacao) = 'tradicional' then 'ANGOLANO_TRADICIONAL'
    else upper(modelo_avaliacao)
  end,
  frequencia_modelo = coalesce(frequencia_modelo, 'POR_AULA'),
  frequencia_min_percent = coalesce(frequencia_min_percent, 75),
  avaliacao_config = coalesce(avaliacao_config, '{}'::jsonb);

alter table public.configuracoes_escola
  alter column modelo_avaliacao set default 'SIMPLIFICADO',
  alter column modelo_avaliacao set not null,
  alter column frequencia_modelo set default 'POR_AULA',
  alter column frequencia_modelo set not null,
  alter column frequencia_min_percent set default 75,
  alter column frequencia_min_percent set not null,
  alter column avaliacao_config set default '{}'::jsonb,
  alter column avaliacao_config set not null;

alter table public.configuracoes_escola
  add constraint configuracoes_escola_modelo_avaliacao_check
    check (modelo_avaliacao in ('SIMPLIFICADO', 'ANGOLANO_TRADICIONAL', 'COMPETENCIAS', 'DEPOIS')),
  add constraint configuracoes_escola_frequencia_modelo_check
    check (frequencia_modelo in ('POR_AULA', 'POR_PERIODO')),
  add constraint configuracoes_escola_frequencia_min_percent_check
    check (frequencia_min_percent between 0 and 100);
