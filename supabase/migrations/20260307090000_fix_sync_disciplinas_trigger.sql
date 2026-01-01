-- Atualiza trigger de criação automática de turma_disciplinas
-- para usar curso_matriz_id em vez de disciplina_id (coluna inexistente).

create or replace function public.sync_disciplinas_ao_criar_turma() returns trigger
    language plpgsql security definer
    set search_path to 'public'
as $$
begin
    if NEW.classe_id is null then
        return NEW;
    end if;

    insert into public.turma_disciplinas (escola_id, turma_id, curso_matriz_id, professor_id)
    select NEW.escola_id, NEW.id, cm.id, null
    from public.curso_matriz cm
    where cm.classe_id = NEW.classe_id
      and cm.escola_id = NEW.escola_id
      and (NEW.curso_id is null or cm.curso_id = NEW.curso_id)
    on conflict do nothing;

    return NEW;
end;
$$;
