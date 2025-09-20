-- apps/web/supabase/migrations/20250917_audit_redaction.sql
-- Reduz e anonimiza 'details' na auditoria para tabelas sensíveis

create or replace function public.audit_dml_trigger()
returns trigger
language plpgsql
as $$
declare
  v_escola_id uuid;
  v_entity_id text;
  v_details jsonb := jsonb_build_object('op', tg_op);
  v_portal text;
  v_entity text := tg_table_name;
begin
  -- Determina portal por tabela
  v_portal := case tg_table_name when 'pagamentos' then 'financeiro' when 'matriculas' then 'secretaria' else 'outro' end;

  -- Extrai ids baseada no tipo de operação
  if tg_op in ('INSERT','UPDATE') then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
  end if;

  -- Detalhes curados por tabela, evitando snapshot completo
  if tg_table_name = 'pagamentos' then
    if tg_op in ('INSERT','UPDATE') then
      v_details := jsonb_strip_nulls(jsonb_build_object(
        'op', tg_op,
        'id', (new).id,
        'escola_id', v_escola_id,
        'status', (new).status,
        'valor', (new).valor,
        'metodo', (new).metodo,
        'referencia', (new).referencia,
        'created_at', (new).created_at
      ));
    else
      v_details := jsonb_strip_nulls(jsonb_build_object(
        'op', tg_op,
        'id', (old).id,
        'escola_id', v_escola_id,
        'status', (old).status,
        'valor', (old).valor,
        'metodo', (old).metodo,
        'referencia', (old).referencia,
        'created_at', (old).created_at
      ));
    end if;
  elsif tg_table_name = 'matriculas' then
    if tg_op in ('INSERT','UPDATE') then
      v_details := jsonb_strip_nulls(jsonb_build_object(
        'op', tg_op,
        'id', (new).id,
        'escola_id', v_escola_id,
        'aluno_id', (new).aluno_id,
        'turma_id', (new).turma_id,
        'status', (new).status,
        'created_at', (new).created_at
      ));
    else
      v_details := jsonb_strip_nulls(jsonb_build_object(
        'op', tg_op,
        'id', (old).id,
        'escola_id', v_escola_id,
        'aluno_id', (old).aluno_id,
        'turma_id', (old).turma_id,
        'status', (old).status,
        'created_at', (old).created_at
      ));
    end if;
  else
    -- Tabelas não sensíveis: manter apenas op e ids
    v_details := jsonb_strip_nulls(jsonb_build_object(
      'op', tg_op,
      'id', coalesce((case when tg_op in ('INSERT','UPDATE') then (new).id else (old).id end)::text, null),
      'escola_id', v_escola_id
    ));
  end if;

  insert into public.audit_logs (escola_id, user_id, portal, action, entity, entity_id, details)
  values (v_escola_id, auth.uid(), v_portal, case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' else 'DELETE' end, v_entity, v_entity_id, v_details);

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

notify pgrst, 'reload schema';

