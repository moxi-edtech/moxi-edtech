BEGIN;

ALTER TABLE public.escolas
  ADD COLUMN IF NOT EXISTS login_sigla text;

COMMENT ON COLUMN public.escolas.login_sigla IS
  'Prefixo estável e globalmente único usado nos logins dos alunos.';

UPDATE public.escolas
SET login_sigla = 'CEPAC'
WHERE id = '3744879f-2e19-4671-8995-78604302d8c5'::uuid;

DO $$
DECLARE
  r record;
  v_base text;
  v_candidate text;
  v_suffix integer;
BEGIN
  FOR r IN
    SELECT id
    FROM public.escolas
    WHERE login_sigla IS NULL OR trim(login_sigla) = ''
    ORDER BY created_at NULLS LAST, id
  LOOP
    v_base := public.get_escola_sigla(r.id);
    v_candidate := v_base;
    v_suffix := 1;

    WHILE EXISTS (
      SELECT 1
      FROM public.escolas e
      WHERE e.id <> r.id
        AND upper(e.login_sigla) = upper(v_candidate)
    ) LOOP
      v_suffix := v_suffix + 1;
      v_candidate := v_base || v_suffix::text;
    END LOOP;

    UPDATE public.escolas
    SET login_sigla = v_candidate
    WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.escolas
  ALTER COLUMN login_sigla SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS escolas_login_sigla_uidx
  ON public.escolas (upper(login_sigla));

CREATE OR REPLACE FUNCTION public.assign_escola_login_sigla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean text;
  v_words text[];
  v_word text;
  v_base text := '';
  v_candidate text;
  v_suffix integer := 1;
  v_stopwords text[] := ARRAY['DE','DA','DO','DOS','DAS','E','A','O'];
BEGIN
  IF new.login_sigla IS NOT NULL AND trim(new.login_sigla) <> '' THEN
    new.login_sigla := upper(regexp_replace(new.login_sigla, '[^A-Za-z0-9]', '', 'g'));
    RETURN new;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('escolas:login_sigla'));

  v_clean := upper(translate(new.nome,
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
  ));
  v_clean := regexp_replace(v_clean, '[^A-Z ]', ' ', 'g');
  v_clean := regexp_replace(v_clean, '\s+', ' ', 'g');
  v_words := regexp_split_to_array(trim(v_clean), '\s+');

  FOREACH v_word IN ARRAY v_words LOOP
    IF v_word <> '' AND NOT v_word = ANY(v_stopwords) THEN
      v_base := v_base || left(v_word, 1);
      EXIT WHEN length(v_base) >= 3;
    END IF;
  END LOOP;

  IF length(v_base) < 3 THEN
    v_base := left(regexp_replace(v_clean, '\s+', '', 'g'), 3);
  END IF;
  IF v_base = '' THEN
    RAISE EXCEPTION 'Não foi possível gerar sigla de login para a escola.';
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (
    SELECT 1 FROM public.escolas e
    WHERE e.id IS DISTINCT FROM new.id
      AND upper(e.login_sigla) = upper(v_candidate)
  ) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_base || v_suffix::text;
  END LOOP;

  new.login_sigla := v_candidate;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_escola_login_sigla ON public.escolas;
CREATE TRIGGER trg_assign_escola_login_sigla
BEFORE INSERT ON public.escolas
FOR EACH ROW
EXECUTE FUNCTION public.assign_escola_login_sigla();

CREATE OR REPLACE FUNCTION public.get_escola_sigla(p_escola_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.login_sigla
  FROM public.escolas e
  WHERE e.id = p_escola_id;
$$;

CREATE OR REPLACE FUNCTION public.next_student_login(p_escola_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sigla text;
  v_next bigint;
BEGIN
  SELECT e.login_sigla INTO v_sigla
  FROM public.escolas e
  WHERE e.id = p_escola_id;

  IF v_sigla IS NULL OR v_sigla = '' THEN
    RAISE EXCEPTION 'Escola sem sigla de login.';
  END IF;

  v_next := public.next_numero_counter(p_escola_id, 'student_login', 1);
  IF v_next > 99999 THEN
    RAISE EXCEPTION 'Limite de logins de aluno atingido para a escola.';
  END IF;

  RETURN upper(v_sigla) || lpad(v_next::text, 5, '0');
END;
$$;

ALTER FUNCTION public.next_student_login(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.next_student_login(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_student_login(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT normalized
    FROM (
      SELECT regexp_replace(upper(numero_processo_login), '[^A-Z0-9]', '', 'g') AS normalized
      FROM public.profiles
      WHERE numero_processo_login IS NOT NULL
    ) s
    GROUP BY normalized
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem logins normalizados duplicados; migração abortada.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_numero_processo_login_normalized_uidx
  ON public.profiles (
    regexp_replace(upper(numero_processo_login), '[^A-Z0-9]', '', 'g')
  )
  WHERE numero_processo_login IS NOT NULL;

CREATE TEMP TABLE curtume_login_migration (
  user_id uuid PRIMARY KEY,
  old_login text NOT NULL,
  new_login text NOT NULL,
  old_email text NOT NULL,
  new_email text NOT NULL
) ON COMMIT DROP;

INSERT INTO curtume_login_migration (user_id, old_login, new_login, old_email, new_email)
VALUES
  ('9613360e-f70c-414b-a28b-a4692636ab52', 'CEP-000041', 'CEPAC00001', 'cep-000041@klasse.ao', 'cepac00001@klasse.ao'),
  ('08ad67a6-83d9-40c4-aa79-bf4aea06afe7', 'CEP-000083', 'CEPAC00002', 'cep-000083@klasse.ao', 'cepac00002@klasse.ao'),
  ('efb8b6eb-0521-4f62-b067-94054088c0c9', 'CEP-000130', 'CEPAC00003', 'cep-000130@klasse.ao', 'cepac00003@klasse.ao'),
  ('97dd7720-1f15-47ef-94fa-affd3c6408ce', 'CEP-000428', 'CEPAC00004', 'cep-000428@klasse.ao', 'cepac00004@klasse.ao'),
  ('1e539c76-c8f3-4cb9-8baa-be9d990ca3ea', 'CEP-000443', 'CEPAC00005', 'cep-000443@klasse.ao', 'cepac00005@klasse.ao'),
  ('78af0925-720f-4e4f-915f-ca4826c80a87', 'CEP-000444', 'CEPAC00006', 'cep-000444@klasse.ao', 'cepac00006@klasse.ao'),
  ('4d369a54-f4c3-48b5-995b-becb0a2cad7b', 'CEP-000509', 'CEPAC00007', 'cep-000509@klasse.ao', 'cepac00007@klasse.ao'),
  ('322c226f-a3bd-4d4f-9d6c-0ed97335257e', 'CEP-000526', 'CEPAC00008', 'cep-000526@klasse.ao', 'cepac00008@klasse.ao'),
  ('b7ed7fa4-9c4d-44da-bdea-83c7112e1deb', 'CEP-000533', 'CEPAC00009', 'cep-000533@klasse.ao', 'cepac00009@klasse.ao');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM curtume_login_migration m
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE p.numero_processo_login IS DISTINCT FROM m.old_login
       OR lower(p.email_auth) IS DISTINCT FROM lower(m.old_email)
       OR lower(p.email) IS DISTINCT FROM lower(m.old_email)
       OR lower(u.email) IS DISTINCT FROM lower(m.old_email)
  ) THEN
    RAISE EXCEPTION 'Estado dos logins Curtume mudou; migração abortada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM curtume_login_migration m
    JOIN public.profiles p
      ON p.user_id <> m.user_id
     AND (
       regexp_replace(upper(p.numero_processo_login), '[^A-Z0-9]', '', 'g') = m.new_login
       OR lower(p.email) = lower(m.new_email)
       OR lower(p.email_auth) = lower(m.new_email)
     )
  ) OR EXISTS (
    SELECT 1
    FROM curtume_login_migration m
    JOIN auth.users u ON u.id <> m.user_id AND lower(u.email) = lower(m.new_email)
  ) THEN
    RAISE EXCEPTION 'Um login CEPAC de destino já existe; migração abortada.';
  END IF;
END;
$$;

UPDATE public.profiles p
SET numero_processo_login = m.new_login,
    email = m.new_email,
    email_auth = m.new_email
FROM curtume_login_migration m
WHERE p.user_id = m.user_id;

UPDATE auth.users u
SET email = m.new_email,
    updated_at = now()
FROM curtume_login_migration m
WHERE u.id = m.user_id;

UPDATE auth.identities i
SET identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email}', to_jsonb(m.new_email), true),
    updated_at = now()
FROM curtume_login_migration m
WHERE i.user_id = m.user_id
  AND i.provider = 'email';

INSERT INTO public.numero_counters (escola_id, tipo, last_value, updated_at)
VALUES ('3744879f-2e19-4671-8995-78604302d8c5'::uuid, 'student_login', 9, now())
ON CONFLICT (escola_id, tipo)
DO UPDATE SET
  last_value = greatest(public.numero_counters.last_value, excluded.last_value),
  updated_at = now();

COMMIT;
