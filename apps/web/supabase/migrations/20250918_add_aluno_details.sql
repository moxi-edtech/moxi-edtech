-- Adds extra details to alunos: birthdate, sex, document, guardian info.
-- Safe to re-run with IF NOT EXISTS guards.

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'alunos') then
    -- data_nascimento
    if not exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'alunos' and column_name = 'data_nascimento'
    ) then
      alter table public.alunos add column data_nascimento date null;
    end if;

    -- sexo (texto curto: 'M','F','O','N')
    if not exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'alunos' and column_name = 'sexo'
    ) then
      alter table public.alunos add column sexo text null;
    end if;

    -- documento (CPF/RG genérico)
    if not exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'alunos' and column_name = 'documento'
    ) then
      alter table public.alunos add column documento text null;
    end if;

    -- responsável: nome + contato
    if not exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'alunos' and column_name = 'responsavel_nome'
    ) then
      alter table public.alunos add column responsavel_nome text null;
    end if;

    if not exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' and table_name = 'alunos' and column_name = 'responsavel_contato'
    ) then
      alter table public.alunos add column responsavel_contato text null;
    end if;
  end if;
end $$;

