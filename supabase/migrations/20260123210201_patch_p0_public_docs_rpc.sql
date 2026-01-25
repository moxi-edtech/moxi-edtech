begin;

-- ============================================================
-- PATCH P0.4: "Public Document Access" via RPC
-- ============================================================

-- 1) Adiciona a coluna hash_validacao e a indexa
alter table public.documentos_emitidos
  add column if not exists hash_validacao text;

create index if not exists documentos_emitidos_public_id_hash_idx
  on public.documentos_emitidos (public_id, hash_validacao);

-- 2) Backfill da nova coluna a partir do JSONB
update public.documentos_emitidos de
set
  hash_validacao = coalesce(de.hash_validacao, de.dados_snapshot->>'hash_validacao')
where de.hash_validacao is null;

-- 3) Torna a coluna NOT NULL após o backfill
alter table public.documentos_emitidos alter column hash_validacao set not null;

-- 4) Cria a função RPC SECURITY DEFINER
create or replace function public.public_get_documento_by_token(
  p_public_id uuid,
  p_hash text
)
returns table (
  id uuid,
  escola_id uuid,
  tipo text,
  emitted_at timestamptz,
  payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- validação básica anti-lixo
  if p_public_id is null then
    raise exception 'invalid token';
  end if;
  if p_hash is null or length(p_hash) < 16 then
    raise exception 'invalid token';
  end if;

  return query
  select
    de.id,
    de.escola_id,
    de.tipo,
    de.created_at as emitted_at,
    de.dados_snapshot as payload
  from public.documentos_emitidos de
  where de.public_id = p_public_id
    and de.hash_validacao = p_hash
  limit 1;
end;
$$;

-- 5) Permissões para a role 'anon'
revoke all on function public.public_get_documento_by_token(uuid, text) from public;
grant execute on function public.public_get_documento_by_token(uuid, text) to anon, authenticated;

commit;
