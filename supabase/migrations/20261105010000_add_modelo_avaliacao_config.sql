begin;

alter table public.configuracoes_escola
  add column if not exists modelo_avaliacao text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'configuracoes_escola_modelo_avaliacao_check'
  ) then
    alter table public.configuracoes_escola
      add constraint configuracoes_escola_modelo_avaliacao_check
      check (modelo_avaliacao in ('simplificado','tradicional'));
  end if;
end $$;

commit;
