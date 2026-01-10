-- =============================================================================
-- MIGRAÇÃO — ONBOARDING CURRÍCULO (SSOT + TURMA_DISCIPLINAS AUTO-FILL)
-- Foco:
--  1) Garantir SSOT de curso por escola via course_code (e opcional: codigo=course_code)
--  2) Garantir idempotência em turma_disciplinas (não duplica)
--  3) Trigger: ao criar turma, preencher turma_disciplinas a partir de curso_matriz
--  4) (Opcional) reforçar unicidade de curso_matriz
-- =============================================================================

begin;

-- -------------------------------------------------------------------------
-- 0) PRÉ-CHECKS (rápidos)
-- -------------------------------------------------------------------------

-- Se você vai apagar legado, este bloco ajuda a detectar duplicatas antes de
-- impor constraints/índices únicos. Se houver duplicatas, você limpa e roda de novo.
-- (Deixe comentado se não quiser.)
-- select escola_id, upper(coalesce(course_code, '')) as course_code_norm, count(*)
-- from public.cursos
-- where course_code is not null
-- group by 1,2
-- having count(*) > 1;

-- -------------------------------------------------------------------------
-- 1) CURSOS — SSOT por escola (course_code)
-- -------------------------------------------------------------------------

-- 1.1) Normalização defensiva (não quebra nada): força uppercase
-- Rode só se você já limpou legado e quer padronizar o banco.
-- update public.cursos
-- set
--   course_code = upper(trim(course_code)),
--   codigo      = upper(trim(codigo))
-- where course_code is not null or codigo is not null;

-- 1.2) Índice único: (escola_id, course_code)
-- (Se você já tem, o IF NOT EXISTS não duplica.)
create unique index if not exists uq_cursos_escola_course_code
on public.cursos (escola_id, course_code)
where course_code is not null;

-- 1.3) (Opcional, mas recomendado) Garantir que codigo = course_code
-- Isso impede o banco de aceitar drift (sanidade total).
-- Se você ainda está em transição, deixe comentado.
-- Data cleanup: Ensure codigo = course_code for existing data before applying the constraint.
UPDATE public.cursos
SET codigo = course_code
WHERE course_code IS NOT NULL
  AND (codigo IS NULL OR codigo != course_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_cursos_codigo_igual_course_code'
      and conrelid = 'public.cursos'::regclass
  ) then
    alter table public.cursos
      add constraint ck_cursos_codigo_igual_course_code
      check (
        course_code is null
        or codigo = course_code
      );
  end if;
end $$;

-- 1.4) Reforçar NOT NULL (só se você realmente vai apagar legado)
-- Se houver curso “meio criado” sem course_code/codigo, isso vai falhar.
-- Se tiver certeza, descomenta:
-- alter table public.cursos alter column codigo set not null;
-- alter table public.cursos alter column course_code set not null;

-- -------------------------------------------------------------------------
-- 2) TURMA_DISCIPLINAS — idempotência (não duplicar)
-- -------------------------------------------------------------------------

-- Garante que não existirá (turma_id + curso_matriz_id) duplicado dentro da escola.
create unique index if not exists uq_turma_disciplinas_unique
on public.turma_disciplinas (escola_id, turma_id, curso_matriz_id);

-- -------------------------------------------------------------------------
-- 3) TRIGGER: ao criar turma, preencher turma_disciplinas via curso_matriz
-- -------------------------------------------------------------------------

create or replace function public.tg_fill_turma_disciplinas()
returns trigger
language plpgsql
as $$
begin
  -- Só preenche se tiver as chaves necessárias (turma criada “hidratada”)
  if new.curso_id is null or new.classe_id is null then
    return new;
  end if;

  insert into public.turma_disciplinas (
    escola_id,
    turma_id,
    curso_matriz_id,
    professor_id,
    created_at
  )
  select
    new.escola_id,
    new.id,
    cm.id,
    null,
    now()
  from public.curso_matriz cm
  where cm.escola_id = new.escola_id
    and cm.curso_id  = new.curso_id
    and cm.classe_id = new.classe_id
    and cm.ativo = true
  on conflict (escola_id, turma_id, curso_matriz_id) do nothing;

  return new;
end;
$$;

drop trigger if exists fill_turma_disciplinas_on_turma_insert on public.turmas;

create trigger fill_turma_disciplinas_on_turma_insert
after insert on public.turmas
for each row
execute function public.tg_fill_turma_disciplinas();

-- -------------------------------------------------------------------------
-- 4) (OPCIONAL) CURSO_MATRIZ — evitar duplicatas de grade
-- -------------------------------------------------------------------------

-- Se você quer garantir que uma disciplina não seja repetida na mesma classe+curso:
create unique index if not exists uq_curso_matriz_unique
on public.curso_matriz (escola_id, curso_id, classe_id, disciplina_id);

-- -------------------------------------------------------------------------
-- 5) (OPCIONAL) TURMAS — check leve de ano_letivo (já é int4 no teu schema)
-- -------------------------------------------------------------------------

-- Se você quiser garantir “ano razoável”:
-- do $$
-- begin
--   if not exists (
--     select 1 from pg_constraint
--     where conname = 'ck_turmas_ano_letivo_range'
--       and conrelid = 'public.turmas'::regclass
--   ) then
--     alter table public.turmas
--       add constraint ck_turmas_ano_letivo_range
--       check (ano_letivo between 2000 and 2100);
--   end if;
-- end $$;

commit;
