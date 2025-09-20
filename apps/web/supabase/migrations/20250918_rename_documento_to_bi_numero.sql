-- Renames public.alunos.documento -> bi_numero (Angola: BI/Cédula)

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'alunos' and column_name = 'documento'
  ) then
    -- Only rename if target does not already exist
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'alunos' and column_name = 'bi_numero'
    ) then
      alter table public.alunos rename column documento to bi_numero;
    else
      -- If both exist (edge case), copy data where target is null, then drop source
      execute $$update public.alunos set bi_numero = coalesce(bi_numero, documento) where documento is not null and (bi_numero is null or length(trim(bi_numero)) = 0)$$;
      alter table public.alunos drop column documento;
    end if;
  end if;
end $$;

