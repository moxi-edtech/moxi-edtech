begin;

alter table public.alunos alter column escola_id set not null;
alter table public.pagamentos alter column escola_id set not null;

create index if not exists idx_presencas_escola_data
  on public.presencas (escola_id, data);

create unique index if not exists ux_pagamentos_escola_transacao
  on public.pagamentos (escola_id, transacao_id_externo)
  where transacao_id_externo is not null;

do $$
declare
  r record;
begin
  for r in
    select inhrelid::regclass as part
    from pg_inherits
    where inhparent = 'public.frequencias'::regclass
  loop
    execute format(
      'create unique index if not exists ux_%s_escola_matricula_data_aula on %s (escola_id, matricula_id, data, aula_id)',
      r.part, r.part
    );
  end loop;
end $$;

create or replace function public.enforce_matriculas_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno_escola uuid;
  v_turma_escola uuid;
  v_secao_escola uuid;
begin
  select escola_id into v_aluno_escola from public.alunos where id = new.aluno_id;
  if v_aluno_escola is not null and v_aluno_escola <> new.escola_id then
    raise exception 'aluno pertence a outra escola';
  end if;

  if new.turma_id is not null then
    select escola_id into v_turma_escola from public.turmas where id = new.turma_id;
    if v_turma_escola is not null and v_turma_escola <> new.escola_id then
      raise exception 'turma pertence a outra escola';
    end if;
  end if;

  if new.secao_id is not null then
    select escola_id into v_secao_escola from public.secoes where id = new.secao_id;
    if v_secao_escola is not null and v_secao_escola <> new.escola_id then
      raise exception 'secao pertence a outra escola';
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_matriculas_tenant_consistency') then
    create trigger trg_matriculas_tenant_consistency
    before insert or update on public.matriculas
    for each row execute function public.enforce_matriculas_tenant_consistency();
  end if;
end $$;

create or replace function public.enforce_pagamentos_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mensalidade_escola uuid;
begin
  if new.mensalidade_id is not null then
    select escola_id into v_mensalidade_escola from public.mensalidades where id = new.mensalidade_id;
    if v_mensalidade_escola is not null and v_mensalidade_escola <> new.escola_id then
      raise exception 'mensalidade pertence a outra escola';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_pagamentos_tenant_consistency') then
    create trigger trg_pagamentos_tenant_consistency
    before insert or update on public.pagamentos
    for each row execute function public.enforce_pagamentos_tenant_consistency();
  end if;
end $$;

alter table public.outbox_events drop constraint if exists outbox_events_dedupe_key_not_null;
alter table public.outbox_events alter column dedupe_key type text using dedupe_key::text;

drop index if exists ux_outbox_dedupe;
create unique index if not exists ux_outbox_dedupe
  on public.outbox_events (coalesce(escola_id, '00000000-0000-0000-0000-000000000000'::uuid), event_type, dedupe_key)
  where dedupe_key is not null and status <> 'dead';

create or replace function public.enqueue_outbox_event(
  p_escola_id uuid,
  p_topic text,
  p_payload jsonb,
  p_request_id uuid default gen_random_uuid(),
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_dedupe text;
  v_idempotency text;
begin
  if not public.can_manage_school(p_escola_id) then
    raise exception 'sem permissão para escola %', p_escola_id;
  end if;

  v_dedupe := coalesce(p_idempotency_key, p_request_id::text);
  v_idempotency := coalesce(p_idempotency_key, p_topic || ':' || p_request_id::text);

  insert into public.outbox_events (escola_id, event_type, dedupe_key, idempotency_key, payload)
  values (
    p_escola_id,
    p_topic,
    v_dedupe,
    v_idempotency,
    p_payload
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id
      into v_id
      from public.outbox_events
     where escola_id = p_escola_id
       and event_type = p_topic
       and dedupe_key = v_dedupe
     limit 1;
  end if;

  return v_id;
end;
$$;

create or replace function public.outbox_requeue_stuck()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.outbox_events
     set status = 'failed',
         next_attempt_at = now(),
         locked_at = null,
         locked_by = null,
         last_error = coalesce(last_error, '') || ' | requeued_stuck'
   where status = 'processing'
     and locked_at < now() - interval '15 minutes';
end;
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notas' and policyname = 'notas_select') then
    create policy notas_select on public.notas
      for select to authenticated
      using (escola_id = public.current_tenant_escola_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notas' and policyname = 'notas_insert') then
    create policy notas_insert on public.notas
      for insert to authenticated
      with check (escola_id = public.current_tenant_escola_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notas' and policyname = 'notas_update') then
    create policy notas_update on public.notas
      for update to authenticated
      using (escola_id = public.current_tenant_escola_id())
      with check (escola_id = public.current_tenant_escola_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notas' and policyname = 'notas_delete') then
    create policy notas_delete on public.notas
      for delete to authenticated
      using (escola_id = public.current_tenant_escola_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avaliacoes' and policyname = 'avaliacoes_select') then
    create policy avaliacoes_select on public.avaliacoes
      for select to authenticated
      using (escola_id = public.current_tenant_escola_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avaliacoes' and policyname = 'avaliacoes_insert') then
    create policy avaliacoes_insert on public.avaliacoes
      for insert to authenticated
      with check (escola_id = public.current_tenant_escola_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avaliacoes' and policyname = 'avaliacoes_update') then
    create policy avaliacoes_update on public.avaliacoes
      for update to authenticated
      using (escola_id = public.current_tenant_escola_id())
      with check (escola_id = public.current_tenant_escola_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avaliacoes' and policyname = 'avaliacoes_delete') then
    create policy avaliacoes_delete on public.avaliacoes
      for delete to authenticated
      using (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

commit;
