-- View e função helper para consultar auditoria por aluno/matrícula na Secretaria

create or replace view public.secretaria_audit_feed as
select
  l.created_at,
  l.portal,
  l.acao,
  l.tabela,
  l.entity_id,
  l.escola_id,
  l.user_id,
  pr.email as user_email,
  case
    when l.tabela = 'matriculas' and l.entity_id ~ '^[0-9a-fA-F-]{36}$' then l.entity_id::uuid
    when l.tabela in ('pagamentos','frequencias')
         and coalesce(l.details->'new'->>'matricula_id', l.details->'old'->>'matricula_id') ~ '^[0-9a-fA-F-]{36}$'
      then coalesce(l.details->'new'->>'matricula_id', l.details->'old'->>'matricula_id')::uuid
    else null
  end as matricula_id,
  m.aluno_id,
  a.nome as aluno_nome,
  l.details
from public.audit_logs l
left join public.profiles pr on pr.user_id = l.user_id
left join public.matriculas m on m.id = (
  case
    when l.tabela = 'matriculas' and l.entity_id ~ '^[0-9a-fA-F-]{36}$' then l.entity_id::uuid
    when l.tabela in ('pagamentos','frequencias')
         and coalesce(l.details->'new'->>'matricula_id', l.details->'old'->>'matricula_id') ~ '^[0-9a-fA-F-]{36}$'
      then coalesce(l.details->'new'->>'matricula_id', l.details->'old'->>'matricula_id')::uuid
    else null
  end)
left join public.alunos a on a.id = m.aluno_id
where
  -- Restringe feed ao tenant atual (via escola_id no log ou na matrícula relacionada)
  (
    l.escola_id = public.current_tenant_escola_id()
    or m.escola_id = public.current_tenant_escola_id()
  );

grant select on public.secretaria_audit_feed to authenticated;

-- Função de consulta filtrável por aluno/matrícula
create or replace function public.secretaria_audit_by_aluno_matricula(
  p_aluno_id uuid default null,
  p_matricula_id uuid default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  created_at timestamptz,
  portal text,
  acao text,
  tabela text,
  entity_id text,
  matricula_id uuid,
  aluno_id uuid,
  aluno_nome text,
  user_id uuid,
  user_email text,
  details jsonb
)
language sql
stable
as $$
  select
    created_at,
    portal,
    acao,
    tabela,
    entity_id,
    matricula_id,
    aluno_id,
    aluno_nome,
    user_id,
    user_email,
    details
  from public.secretaria_audit_feed
  where (p_matricula_id is null or matricula_id = p_matricula_id)
    and (p_aluno_id is null or aluno_id = p_aluno_id)
  order by created_at desc
  limit greatest(1, least(1000, coalesce(p_limit, 100)))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.secretaria_audit_by_aluno_matricula(uuid, uuid, int, int) to authenticated;

notify pgrst, 'reload schema';

