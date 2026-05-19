create or replace function public.get_escola_document_branding(p_escola_id uuid)
returns table (
  escola_id uuid,
  validation_base_url text,
  logo_url text,
  dados_pagamento jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    e.id as escola_id,
    null::text as validation_base_url,
    e.logo_url,
    e.dados_pagamento
  from public.escolas e
  where e.id = p_escola_id
    and (
      public.has_access_to_escola(e.id)
      or public.check_super_admin_role()
    );
$$;

grant execute on function public.get_escola_document_branding(uuid) to authenticated;
