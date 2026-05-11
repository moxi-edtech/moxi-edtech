ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_events_insert ON public.outbox_events;
DROP POLICY IF EXISTS "outbox_events_insert" ON public.outbox_events;

CREATE POLICY outbox_events_insert
ON public.outbox_events
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.user_has_role_in_school(
    escola_id,
    ARRAY['admin','admin_escola','staff_admin','secretaria','financeiro']
  )
);
