# Diff proposto — Agent 3
run_id: 2AC1E3E1-C0EC-4714-BAA8-F81A8495F53A
timestamp: 2026-07-19T03:05:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Blindar o login público de influenciadores contra TTL arbitrária e brute force directo via PostgREST.

## Ficheiro proposto
`supabase/migrations/20270718180000_harden_influencer_portal_session_login.sql`

```diff
--- a/public.create_influencer_portal_session(text,uuid,text,integer)
+++ b/public.create_influencer_portal_session(text,uuid,text,integer)
@@
-  v_ttl_minutes integer := greatest(coalesce(p_ttl_minutes, 480), 5);
+  v_ttl_minutes integer := least(480, greatest(coalesce(p_ttl_minutes, 480), 5));
+  v_rate_limit jsonb;
 BEGIN
+  v_rate_limit := public.check_public_rate_limit(
+    'influencer_portal_login',
+    v_codigo || ':' || coalesce(v_member_id::text, 'missing'),
+    10,
+    900,
+    900
+  );
+
+  IF NOT coalesce((v_rate_limit->>'allowed')::boolean, false) THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
+  END IF;
```

## Conteúdo exacto proposto

```sql
CREATE OR REPLACE FUNCTION public.create_influencer_portal_session(
  p_codigo text,
  p_member_id uuid,
  p_pin text,
  p_ttl_minutes integer DEFAULT 480
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_member_id uuid := p_member_id;
  v_member_name text;
  v_session_id uuid;
  v_ttl_minutes integer := least(480, greatest(coalesce(p_ttl_minutes, 480), 5));
  v_rate_limit jsonb;
BEGIN
  v_rate_limit := public.check_public_rate_limit(
    'influencer_portal_login',
    v_codigo || ':' || coalesce(v_member_id::text, 'missing'),
    10,
    900,
    900
  );

  IF NOT coalesce((v_rate_limit->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  DELETE FROM public.influencer_portal_sessions
  WHERE expires_at <= now();

  SELECT m.nome INTO v_member_name
  FROM public.afiliados a
  JOIN public.afiliado_membros m ON m.afiliado_id = a.id
  WHERE a.codigo = v_codigo
    AND a.ativo = true
    AND m.id = v_member_id
    AND m.ativo = true
    AND m.pin_hash = extensions.crypt(coalesce(p_pin, ''), m.pin_hash)
  LIMIT 1;

  IF v_member_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  INSERT INTO public.influencer_portal_sessions (
    afiliado_codigo, member_id, member_name, expires_at
  ) VALUES (
    v_codigo, v_member_id, v_member_name,
    now() + make_interval(mins => v_ttl_minutes)
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'codigo', v_codigo,
    'member', jsonb_build_object('id', v_member_id, 'name', v_member_name)
  );
END;
$function$;
```

## Verificação pós-apply prevista

- Corpo contém limite máximo de 480 minutos.
- Corpo chama `check_public_rate_limit` antes da consulta do PIN.
- Assinatura e grants `anon/authenticated/service_role` permanecem inalterados.
- Teste transaccional confirma que TTL solicitada acima do máximo resulta em sessão de até 480 minutos e faz rollback.
