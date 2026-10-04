create or replace function public.fiscal_block_key_delete_or_truncate()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public'
as $$
begin
  raise exception 'IMMUTABILITY: chaves fiscais não podem ser apagadas ou truncadas; use rotação/retirement';
end;
$$;

drop trigger if exists trg_fiscal_chaves_no_delete on public.fiscal_chaves;
create trigger trg_fiscal_chaves_no_delete
before delete on public.fiscal_chaves
for each row execute function public.fiscal_block_key_delete_or_truncate();

drop trigger if exists trg_fiscal_chaves_no_truncate on public.fiscal_chaves;
create trigger trg_fiscal_chaves_no_truncate
before truncate on public.fiscal_chaves
for each statement execute function public.fiscal_block_key_delete_or_truncate();

create or replace function public.fiscal_register_key_ref(
  p_empresa_id uuid,
  p_key_version integer,
  p_public_key_pem text,
  p_private_key_ref text,
  p_key_fingerprint text,
  p_status text default 'active',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $$
declare
  v_row public.fiscal_chaves%rowtype;
begin
  if p_empresa_id is null then raise exception 'DATA: empresa_id é obrigatório'; end if;
  if p_key_version is null or p_key_version <= 0 then raise exception 'DATA: key_version inválido'; end if;
  if nullif(btrim(coalesce(p_public_key_pem,'')),'') is null
     or p_public_key_pem !~ '^-----BEGIN PUBLIC KEY-----' then
    raise exception 'DATA: public_key_pem inválida';
  end if;
  if nullif(btrim(coalesce(p_private_key_ref,'')),'') is null
     or p_private_key_ref !~ '^(kms://.+|arn:aws:kms:.+)$'
     or p_private_key_ref ~ '-----BEGIN'
     or p_private_key_ref ~* '(private[_ -]?key|secret|password)[=:]' then
    raise exception 'DATA: private_key_ref deve referenciar KMS e nunca conter material secreto';
  end if;
  if nullif(btrim(coalesce(p_key_fingerprint,'')),'') is null then
    raise exception 'DATA: key_fingerprint é obrigatório';
  end if;
  if p_status not in ('pending','active','retired') then
    raise exception 'DATA: status de chave inválido';
  end if;

  insert into public.fiscal_chaves(
    empresa_id,key_version,algorithm,public_key_pem,private_key_ref,
    key_fingerprint,status,activated_at,retired_at,metadata
  )
  values(
    p_empresa_id,p_key_version,'RSA-SHA256',btrim(p_public_key_pem),
    btrim(p_private_key_ref),btrim(p_key_fingerprint),p_status,
    case when p_status='active' then now() else null end,
    case when p_status='retired' then now() else null end,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,
    'empresa_id',v_row.empresa_id,
    'key_version',v_row.key_version,
    'status',v_row.status,
    'key_fingerprint',v_row.key_fingerprint,
    'created_at',v_row.created_at
  );
end;
$$;

revoke all on function public.fiscal_register_key_ref(uuid,integer,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.fiscal_register_key_ref(uuid,integer,text,text,text,text,jsonb)
  to service_role;
revoke all on function public.fiscal_block_key_delete_or_truncate()
  from public,anon,authenticated,service_role;
