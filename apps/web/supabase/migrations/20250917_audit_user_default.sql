-- apps/web/supabase/migrations/20250917_audit_user_default.sql
-- Define default user_id = auth.uid() para audit_logs

alter table public.audit_logs alter column user_id set default auth.uid();

notify pgrst, 'reload schema';

