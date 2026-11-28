BEGIN;

-- A current-state signal only: one row per account, not a history of behaviour.
CREATE SCHEMA IF NOT EXISTS klasse_presence_private;
REVOKE ALL ON SCHEMA klasse_presence_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA klasse_presence_private TO authenticated;
CREATE TABLE klasse_presence_private.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL
);
ALTER TABLE klasse_presence_private.user_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE klasse_presence_private.user_presence FROM PUBLIC, anon, authenticated;
CREATE INDEX user_presence_recent_idx ON klasse_presence_private.user_presence (last_seen_at DESC, user_id);

CREATE FUNCTION klasse_presence_private.touch_presence()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_now timestamptz := statement_timestamp();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_uid) THEN RETURN; END IF;
  INSERT INTO klasse_presence_private.user_presence AS presence (user_id, last_seen_at)
  VALUES (v_uid, v_now)
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
  WHERE presence.last_seen_at <= v_now - interval '2 minutes';
END;
$$;

CREATE FUNCTION klasse_presence_private.read_presence(p_limit integer, p_offset integer, p_search text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_now timestamptz := statement_timestamp();
  v_limit integer := greatest(0, least(coalesce(p_limit, 50), 50));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 100000));
  v_search text := left(btrim(coalesce(p_search, '')), 100);
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = v_uid
      AND p.role::text IN ('super_admin', 'global_admin', 'superadmin')
  ) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF v_limit = 0 THEN
    RETURN jsonb_build_object('total', (SELECT count(*) FROM klasse_presence_private.user_presence u
      WHERE u.last_seen_at >= v_now - interval '5 minutes' AND u.last_seen_at <= v_now
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.user_id)),
      'as_of', v_now, 'items', '[]'::jsonb);
  END IF;
  WITH active AS MATERIALIZED (
    SELECT u.user_id, u.last_seen_at, p.nome, p.role::text AS role, e.nome AS escola
    FROM klasse_presence_private.user_presence u
    JOIN public.profiles p ON p.user_id = u.user_id
    LEFT JOIN public.escolas e ON e.id = coalesce(p.current_escola_id,p.escola_id)
    WHERE u.last_seen_at >= v_now - interval '5 minutes' AND u.last_seen_at <= v_now
      AND (v_search = '' OR strpos(lower(concat_ws(' ',p.nome,p.role::text,e.nome)),lower(v_search)) > 0)
  ), page AS (
    SELECT * FROM active ORDER BY last_seen_at DESC, user_id LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM active), 'as_of', v_now,
    'items', coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.last_seen_at DESC, page.user_id) FROM page),'[]'::jsonb))
  INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION klasse_presence_private.touch_presence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION klasse_presence_private.read_presence(integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION klasse_presence_private.touch_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION klasse_presence_private.read_presence(integer,integer,text) TO authenticated;

CREATE FUNCTION public.klasse_touch_presence()
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT klasse_presence_private.touch_presence(); $$;
CREATE FUNCTION public.klasse_admin_active_users(p_limit integer DEFAULT 50,p_offset integer DEFAULT 0,p_search text DEFAULT '')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT klasse_presence_private.read_presence(p_limit,p_offset,p_search); $$;
REVOKE ALL ON FUNCTION public.klasse_touch_presence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.klasse_admin_active_users(integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.klasse_touch_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.klasse_admin_active_users(integer,integer,text) TO authenticated;
COMMIT;
