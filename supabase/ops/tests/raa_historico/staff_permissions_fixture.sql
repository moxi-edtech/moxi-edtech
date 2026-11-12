-- Disposable PostgreSQL fixture: verify the installed historic bridge with
-- the new Balcão operator grants. Never execute on an actual school.
\ir fixture.sql

ALTER TABLE public.escola_users ADD CONSTRAINT escola_users_papel_check
  CHECK (papel = ANY (ARRAY['secretaria','admin','admin_escola','staff_admin','diretor','admin_financeiro']::text[]));

CREATE TABLE public.balcao_historic_recovery_requests (
  escola_id uuid NOT NULL,
  matricula_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  solicitante_id uuid NOT NULL,
  motivo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
);
ALTER TABLE public.balcao_historic_recovery_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY balcao_historic_recovery_school_read
  ON public.balcao_historic_recovery_requests FOR SELECT TO authenticated
  USING (escola_id=public.current_tenant_escola_id());

\ir ../../../migrations/20271112010000_balcao_historic_full_staff_permissions.sql

-- Confirm the migration itself installed both canonical and alias roles.
DO $roles$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.escola_users'::regclass
      AND conname='escola_users_papel_check'
      AND pg_get_constraintdef(oid) LIKE '%admin_secretario%'
 ) THEN
   RAISE EXCEPTION 'The historic operator migration did not install admin_secretario';
 END IF;
END $roles$;
