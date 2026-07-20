# Apply diff — Audit request context grants
run_id:    a140af81-a1e7-4e21-bd77-b28a412ca979
timestamp: 2026-07-20T11:58:44Z

## Diff
```diff
--- /dev/null	2026-07-20 11:54:41.792194142 +0000
+++ supabase/migrations/20270720120000_fix_audit_request_context_execute.sql	2026-07-20 11:58:44.868751500 +0000
@@ -0,0 +1,45 @@
+-- Fix balcão pagamentos failure caused by audit trigger invoking audit_request_context
+-- as the authenticated request role.
+
+BEGIN;
+
+CREATE OR REPLACE FUNCTION public.audit_request_context()
+RETURNS jsonb
+LANGUAGE plpgsql
+STABLE
+SECURITY DEFINER
+SET search_path TO 'public'
+AS $$
+DECLARE
+  headers jsonb;
+  claims jsonb;
+  ip text;
+  ua text;
+  role text;
+BEGIN
+  headers := NULL;
+  BEGIN
+    headers := current_setting('request.headers', true)::jsonb;
+  EXCEPTION WHEN others THEN
+    headers := NULL;
+  END;
+
+  claims := NULL;
+  BEGIN
+    claims := current_setting('request.jwt.claims', true)::jsonb;
+  EXCEPTION WHEN others THEN
+    claims := NULL;
+  END;
+
+  ip := COALESCE(headers->>'x-forwarded-for', headers->>'x-real-ip');
+  ua := headers->>'user-agent';
+  role := COALESCE(claims->>'user_role', claims->>'role');
+
+  RETURN jsonb_build_object('ip', ip, 'user_agent', ua, 'actor_role', role);
+END;
+$$;
+
+REVOKE ALL ON FUNCTION public.audit_request_context() FROM PUBLIC;
+GRANT EXECUTE ON FUNCTION public.audit_request_context() TO anon, authenticated, service_role;
+
+COMMIT;
```
