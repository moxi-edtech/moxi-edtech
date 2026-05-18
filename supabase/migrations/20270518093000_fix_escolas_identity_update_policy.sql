drop policy if exists admin_update_escola_details on public.escolas;

create policy admin_update_escola_details
on public.escolas
for update
to authenticated
using (
  public.user_has_role_in_school(id, array['admin', 'admin_escola']::text[])
)
with check (
  public.user_has_role_in_school(id, array['admin', 'admin_escola']::text[])
);
