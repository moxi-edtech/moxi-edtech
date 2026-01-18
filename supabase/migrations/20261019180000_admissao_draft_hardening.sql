-- ============================================================
-- KLASSE — Admissão Draft Hardening (Draft parcial de verdade)
-- - Permite curso_id/ano_letivo NULL quando status='rascunho'
-- - Adiciona source + updated_at (compatível com tua API/RPC)
-- - RPC segura: admissao_upsert_draft (SECURITY INVOKER)
-- ============================================================

begin;

-- 1) Colunas faltantes (pra bater com tua API/RPC)
alter table public.candidaturas
  add column if not exists source text,
  add column if not exists updated_at timestamptz;

-- Preenche updated_at pra linhas antigas
update public.candidaturas
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- Default de updated_at
alter table public.candidaturas
  alter column updated_at set default now();

-- 2) Ajuste de defaults (draft como default é o mais seguro pro “rascunho parcial”)
-- Se você tiver fluxos que criam candidatura já como pendente/submetida, eles devem setar status explicitamente.
alter table public.candidaturas
  alter column status set default 'rascunho';

-- 3) Draft parcial: liberar NULL onde precisa
-- (FKs aceitam NULL; isso não quebra integridade referencial)
alter table public.candidaturas
  alter column curso_id drop not null,
  alter column ano_letivo drop not null;

-- Default de ano_letivo (quando fizer sentido)
alter table public.candidaturas
  alter column ano_letivo set default extract(year from current_date)::int;

-- 4) Constraint condicional: obrigar campos quando NÃO for rascunho
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'candidaturas_required_when_not_draft'
      and conrelid = 'public.candidaturas'::regclass
  ) then
    alter table public.candidaturas
      add constraint candidaturas_required_when_not_draft
      check (
        status = 'rascunho'
        or (
          curso_id is not null
          and ano_letivo is not null
        )
      );
  end if;
end $$;

-- 5) Trigger updated_at (idempotente)
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_candidaturas_set_updated_at'
  ) then
    create trigger trg_candidaturas_set_updated_at
    before update on public.candidaturas
    for each row execute function public.tg_set_updated_at();
  end if;
end $$;

-- 6) RPC segura: upsert draft
-- Assumindo que você já tem current_tenant_escola_id() e RLS por escola_id.
create or replace function public.admissao_upsert_draft(
  p_escola_id uuid,
  p_candidatura_id uuid default null,
  p_source text default 'walkin',
  p_dados_candidato jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_tenant_escola_id uuid := public.current_tenant_escola_id();

  v_nome text := nullif(trim(p_dados_candidato->>'nome_candidato'), '');
  v_turno text := nullif(trim(p_dados_candidato->>'turno'), '');

  v_curso_id uuid := null;
  v_classe_id uuid := null;
  v_turma_pref_id uuid := null;

  v_clean jsonb;
begin
  -- Tenant guard hard (defense-in-depth contra qualquer bypass de contexto)
  if p_escola_id is null or p_escola_id <> v_tenant_escola_id then
    raise exception 'Acesso negado: escola inválida';
  end if;

  -- Casts seguros pra uuid (evita 500 por "" / lixo)
  begin
    if nullif(p_dados_candidato->>'curso_id','') is not null then
      v_curso_id := (p_dados_candidato->>'curso_id')::uuid;
    end if;
    if nullif(p_dados_candidato->>'classe_id','') is not null then
      v_classe_id := (p_dados_candidato->>'classe_id')::uuid;
    end if;
    if nullif(p_dados_candidato->>'turma_preferencial_id','') is not null then
      v_turma_pref_id := (p_dados_candidato->>'turma_preferencial_id')::uuid;
    end if;
  exception when invalid_text_representation then
    raise exception 'Payload inválido: UUID malformado';
  end;

  -- Whitelist do JSON (não grava qualquer chave arbitrária)
  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'nome_candidato', v_nome,
    'bi_numero', nullif(trim(p_dados_candidato->>'bi_numero'), ''),
    'telefone', nullif(trim(p_dados_candidato->>'telefone'), ''),
    'email', nullif(lower(trim(p_dados_candidato->>'email')), ''),
    'curso_id', v_curso_id,
    'classe_id', v_classe_id,
    'turma_preferencial_id', v_turma_pref_id,
    'turno', v_turno
  ));

  if p_candidatura_id is null then
    insert into public.candidaturas (
      escola_id,
      status,
      ano_letivo,
      source,
      nome_candidato,
      curso_id,
      classe_id,
      turma_preferencial_id,
      turno,
      dados_candidato
    ) values (
      p_escola_id,
      'rascunho',
      coalesce(extract(year from current_date)::int, null),
      coalesce(nullif(p_source,''), 'walkin'),
      v_nome,
      v_curso_id,
      v_classe_id,
      v_turma_pref_id,
      v_turno,
      coalesce(v_clean, '{}'::jsonb)
    )
    returning id into v_id;

  else
    update public.candidaturas c
    set
      source = coalesce(nullif(p_source,''), c.source),
      nome_candidato = coalesce(v_nome, c.nome_candidato),
      curso_id = coalesce(v_curso_id, c.curso_id),
      classe_id = coalesce(v_classe_id, c.classe_id),
      turma_preferencial_id = coalesce(v_turma_pref_id, c.turma_preferencial_id),
      turno = coalesce(v_turno, c.turno),
      dados_candidato = coalesce(c.dados_candidato,'{}'::jsonb) || coalesce(v_clean,'{}'::jsonb)
    where c.id = p_candidatura_id
      and c.escola_id = v_tenant_escola_id
    returning c.id into v_id;

    if not found then
      raise exception 'Candidatura não encontrada ou acesso negado';
    end if;
  end if;

  return v_id;
end;
$$;

commit;
