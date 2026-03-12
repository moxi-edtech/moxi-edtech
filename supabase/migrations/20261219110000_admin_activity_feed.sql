-- Admin operational activity feed (append-only)
create table if not exists public.admin_activity_events (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type text not null,
  event_family text not null,
  actor_id uuid null,
  actor_role text null,
  entity_type text null,
  entity_id text null,
  payload jsonb not null default '{}'::jsonb,
  source_audit_log_id bigint null references public.audit_logs(id) on delete set null,
  dedupe_key text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_activity_events_escola_occurred_desc
  on public.admin_activity_events (escola_id, occurred_at desc, id desc);

create index if not exists idx_admin_activity_events_escola_family_occurred
  on public.admin_activity_events (escola_id, event_family, occurred_at desc);

create unique index if not exists ux_admin_activity_events_dedupe
  on public.admin_activity_events (escola_id, dedupe_key)
  where dedupe_key is not null;

alter table public.admin_activity_events enable row level security;

create policy admin_activity_events_select_policy
  on public.admin_activity_events
  for select
  using (public.is_escola_member(escola_id) or public.is_escola_admin(escola_id));

create or replace function public.map_admin_activity_family(p_action text)
returns text
language sql
immutable
as $$
  select case
    when upper(coalesce(p_action, '')) in (
      'PAGAMENTO_REGISTRADO','PAGAMENTO_CONCILIADO','RECIBO_EMITIDO','VENDA_AVULSA_REGISTRADA',
      'FECHO_DECLARADO','FECHO_CAIXA_ABERTO','FECHO_CAIXA_FECHADO','FECHO_CAIXA_APROVADO','FECHO_CAIXA_REPROVADO',
      'ESTORNO_REGISTRADO','ESTORNO_APROVADO','ESTORNO_REJEITADO'
    ) then 'financeiro'
    when upper(coalesce(p_action, '')) in (
      'NOTA_LANCADA_BATCH','PAUTA_FECHADA','FREQUENCIA_FECHADA','FREQUENCIA_LANCADA_BATCH',
      'AVALIACAO_CRIADA','AVALIACAO_EDITADA'
    ) then 'academico'
    when upper(coalesce(p_action, '')) in ('DOCUMENTO_EMITIDO') then 'documentos'
    when upper(coalesce(p_action, '')) like 'MATRICULA_%'
      or upper(coalesce(p_action, '')) like 'ADMISSAO_%'
      or upper(coalesce(p_action, '')) in ('CANDIDATURA_CRIADA','TURMAS_GERADAS_FROM_CURRICULO')
    then 'secretaria'
    else 'operacional'
  end;
$$;

create or replace function public.ingest_admin_activity_event_from_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := upper(coalesce(new.action, new.acao, ''));
  v_details jsonb := coalesce(new.details, new.meta, '{}'::jsonb);
  v_payload jsonb;
  v_dedupe_key text;
  v_critical boolean := false;
begin
  if new.escola_id is null then
    return new;
  end if;

  if v_action = '' then
    return new;
  end if;

  if not (
    v_action in (
      'PAGAMENTO_REGISTRADO','PAGAMENTO_CONCILIADO','RECIBO_EMITIDO','VENDA_AVULSA_REGISTRADA',
      'NOTA_LANCADA_BATCH','PAUTA_FECHADA','FREQUENCIA_FECHADA','FREQUENCIA_LANCADA_BATCH',
      'DOCUMENTO_EMITIDO','CANDIDATURA_CRIADA','TURMAS_GERADAS_FROM_CURRICULO',
      'MATRICULA_MASSA','MATRICULA_MASSA_TURMA','MATRICULA_STATUS_ATUALIZADO','MATRICULA_TRANSFERIDA',
      'ADMISSAO_CONVERTIDA_MATRICULA','ADMISSION_RESERVED_48H'
    )
    or v_action like 'MATRICULA_%'
    or v_action like 'ADMISSAO_%'
    or v_action like 'FECHO_CAIXA_%'
  ) then
    return new;
  end if;

  v_critical := v_action in ('ESTORNO_REGISTRADO','ESTORNO_APROVADO','ESTORNO_REJEITADO')
    or v_action like 'SNAPSHOT_%';

  v_payload := jsonb_strip_nulls(
    coalesce(v_details, '{}'::jsonb)
    || jsonb_build_object(
      'aluno_id', coalesce(v_details->>'aluno_id', v_details#>>'{aluno,id}'),
      'turma_id', coalesce(v_details->>'turma_id', v_details#>>'{turma,id}'),
      'periodo_id', coalesce(v_details->>'periodo_id', v_details#>>'{periodo,id}'),
      'tipo_documento', coalesce(v_details->>'tipo_documento', v_details->>'documento', v_details->>'documento_nome'),
      'mes_referencia', coalesce(v_details->>'mes_referencia', v_details->>'referencia'),
      'critical', v_critical
    )
  );

  v_dedupe_key := concat_ws(
    ':',
    v_action,
    coalesce(new.actor_id::text, 'anon'),
    coalesce(v_payload->>'aluno_id', ''),
    coalesce(v_payload->>'turma_id', ''),
    coalesce(v_payload->>'mes_referencia', ''),
    to_char(date_trunc('minute', coalesce(new.created_at, now())), 'YYYYMMDDHH24MI')
  );

  insert into public.admin_activity_events (
    escola_id,
    occurred_at,
    event_type,
    event_family,
    actor_id,
    actor_role,
    entity_type,
    entity_id,
    payload,
    source_audit_log_id,
    dedupe_key
  ) values (
    new.escola_id,
    coalesce(new.created_at, now()),
    v_action,
    public.map_admin_activity_family(v_action),
    new.actor_id,
    new.actor_role,
    coalesce(new.entity, new.tabela),
    coalesce(new.entity_id, new.registro_id),
    left(v_payload::text, 2000)::jsonb,
    new.id,
    v_dedupe_key
  )
  on conflict (escola_id, dedupe_key)
  where dedupe_key is not null
  do nothing;

  return new;
end;
$$;

drop trigger if exists trg_ingest_admin_activity_events_from_audit on public.audit_logs;
create trigger trg_ingest_admin_activity_events_from_audit
after insert on public.audit_logs
for each row
execute function public.ingest_admin_activity_event_from_audit();

create or replace view public.vw_admin_activity_feed_enriched as
select
  e.id,
  e.escola_id,
  e.occurred_at,
  e.event_family,
  e.event_type,
  coalesce(nullif(p.nome, ''), nullif((au.raw_user_meta_data->>'full_name'), ''), 'Sistema') as actor_name,
  coalesce(
    nullif(e.payload->>'headline', ''),
    case
      when e.event_type = 'PAGAMENTO_REGISTRADO' then 'Pagamento confirmado'
      when e.event_type = 'NOTA_LANCADA_BATCH' then 'Lançamento de notas concluído'
      when e.event_type = 'DOCUMENTO_EMITIDO' then 'Documento emitido'
      when e.event_type like 'MATRICULA_%' then 'Actualização de matrícula'
      when e.event_type like 'ADMISSAO_%' then 'Actualização de admissão'
      else initcap(replace(lower(e.event_type), '_', ' '))
    end
  ) as headline,
  coalesce(
    nullif(e.payload->>'subline', ''),
    e.payload->>'turma_nome',
    e.payload->>'aluno_nome',
    e.payload->>'documento_nome'
  ) as subline,
  nullif(e.payload->>'valor_numeric', '')::numeric(14,2) as amount_kz,
  nullif(coalesce(e.payload->>'turma_nome', t.nome), '') as turma_nome,
  nullif(coalesce(e.payload->>'aluno_nome', a.nome_completo, a.nome), '') as aluno_nome,
  e.payload
from public.admin_activity_events e
left join public.profiles p on p.id = e.actor_id
left join auth.users au on au.id = e.actor_id
left join public.alunos a on a.id::text = coalesce(e.payload->>'aluno_id', e.entity_id)
left join public.turmas t on t.id::text = coalesce(e.payload->>'turma_id', e.payload#>>'{turma,id}');

grant select on public.vw_admin_activity_feed_enriched to authenticated;
