create extension if not exists "pg_cron" with schema "pg_catalog";

create extension if not exists "btree_gin" with schema "extensions";

create extension if not exists "btree_gist" with schema "extensions";

create extension if not exists "unaccent" with schema "extensions";

drop extension if exists "pg_net";

drop policy "cursos_globais_read_v2" on "public"."cursos_globais_cache";

revoke delete on table "public"."audit_logs" from "authenticated";

revoke references on table "public"."audit_logs" from "authenticated";

revoke trigger on table "public"."audit_logs" from "authenticated";

revoke truncate on table "public"."audit_logs" from "authenticated";

revoke update on table "public"."audit_logs" from "authenticated";


  create policy "cursos_globais_read_v2"
  on "public"."cursos_globais_cache"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


