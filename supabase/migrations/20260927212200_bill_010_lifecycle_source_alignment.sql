drop trigger if exists fiscal_document_lifecycle_guard on public.fiscal_documentos;
drop trigger if exists trg_fiscal_documentos_lifecycle on public.fiscal_documentos;

create trigger fiscal_document_lifecycle_guard
before insert or update on public.fiscal_documentos
for each row execute function public.fiscal_validate_document_lifecycle();

create or replace function public.fiscal_anular_documento(
  p_documento_id uuid,
  p_motivo text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  v_uid uuid := public.safe_auth_uid();
  v_documento public.fiscal_documentos%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
begin
  if v_uid is null then raise exception 'AUTH: utilizador não autenticado'; end if;
  if v_motivo is null then raise exception 'DATA: motivo é obrigatório'; end if;

  select * into v_documento
  from public.fiscal_documentos
  where id=p_documento_id
  for update;

  if not found then raise exception 'DATA: documento fiscal não encontrado'; end if;

  if not public.user_has_role_in_empresa(
    v_documento.empresa_id,array['owner','admin','operator']
  ) then
    raise exception 'AUTH: permissão negada para anular documento fiscal';
  end if;

  if v_documento.status <> 'emitido' then
    raise exception 'STATE: apenas documento emitido pode ser anulado';
  end if;

  if exists (
    select 1
    from public.fiscal_agt_submission_documentos sd
    join public.fiscal_agt_submissions s on s.id=sd.submission_id
    where sd.documento_id=v_documento.id
      and s.status in (
        'prepared','submitting','submitted','processing','uncertain','accepted'
      )
  ) then
    raise exception
      'STATE: documento comunicado à AGT exige fluxo electrónico de anulação antes da anulação local';
  end if;

  update public.fiscal_documentos
  set status='anulado'
  where id=v_documento.id;

  insert into public.fiscal_documentos_eventos(
    empresa_id,documento_id,tipo_evento,payload,created_by
  ) values (
    v_documento.empresa_id,v_documento.id,'ANULADO',
    jsonb_build_object(
      'motivo',v_motivo,
      'status_anterior',v_documento.status,
      'status_novo','anulado',
      'numero_formatado',v_documento.numero_formatado,
      'metadata',coalesce(p_metadata,'{}'::jsonb)
    ),
    v_uid
  );

  return jsonb_build_object(
    'ok',true,
    'documento_id',v_documento.id,
    'empresa_id',v_documento.empresa_id,
    'status','anulado'
  );
end;
$function$;
