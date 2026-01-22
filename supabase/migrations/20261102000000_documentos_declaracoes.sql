-- KLASSE — Tipos de documento: declarações (frequência e notas)

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'tipo_documento'
      and e.enumlabel = 'declaracao_frequencia'
  ) then
    alter type public.tipo_documento add value 'declaracao_frequencia';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'tipo_documento'
      and e.enumlabel = 'declaracao_notas'
  ) then
    alter type public.tipo_documento add value 'declaracao_notas';
  end if;
end $$;

commit;
