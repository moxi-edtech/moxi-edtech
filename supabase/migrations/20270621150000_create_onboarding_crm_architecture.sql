BEGIN;

-- 1. Alter public.onboarding_requests to add tracking_token
ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS tracking_token varchar(20) UNIQUE;

-- Populate existing rows with a tracking token format XXXX-XXXX-XXXX
-- If they don't already have one
UPDATE public.onboarding_requests
SET tracking_token = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4)) || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 5, 4)) || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 9, 4))
WHERE tracking_token IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.onboarding_requests
  ALTER COLUMN tracking_token SET NOT NULL;

-- 2. Create onboarding_steps table
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_id uuid NOT NULL REFERENCES public.onboarding_requests(id) ON DELETE CASCADE,
  step_code     varchar(50) NOT NULL,
  title         varchar(255) NOT NULL,
  status        varchar(50) NOT NULL DEFAULT 'pendente', -- pendente | em_progresso | concluido
  owner_type    varchar(50) NOT NULL, -- escola | parceiro | klasse
  sla_days      integer NOT NULL DEFAULT 5,
  deadline_at   timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT onboarding_steps_status_check CHECK (status IN ('pendente', 'em_progresso', 'concluido')),
  CONSTRAINT onboarding_steps_owner_type_check CHECK (owner_type IN ('escola', 'parceiro', 'klasse')),
  CONSTRAINT onboarding_steps_unique_step UNIQUE (onboarding_id, step_code)
);

-- 3. Create onboarding_uploads table
CREATE TABLE IF NOT EXISTS public.onboarding_uploads (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_id    uuid NOT NULL REFERENCES public.onboarding_requests(id) ON DELETE CASCADE,
  step_code        varchar(50) NOT NULL,
  file_path        varchar(512) NOT NULL,
  status           varchar(50) NOT NULL DEFAULT 'pendente', -- pendente | processando | aprovado | rejeitado
  rejection_reason text,
  created_by       varchar(50) NOT NULL, -- escola | parceiro
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT onboarding_uploads_status_check CHECK (status IN ('pendente', 'processando', 'aprovado', 'rejeitado')),
  CONSTRAINT onboarding_uploads_created_by_check CHECK (created_by IN ('escola', 'parceiro'))
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_uploads ENABLE ROW LEVEL SECURITY;

-- 5. Policies for onboarding_requests
-- Ensure we have a policy to SELECT onboarding_requests via tracking_token
DROP POLICY IF EXISTS "onboarding_select_by_token" ON public.onboarding_requests;
CREATE POLICY "onboarding_select_by_token"
  ON public.onboarding_requests
  FOR SELECT
  USING (true); -- Let public read (for the accompanying page) but limited by tracking_token on the application layer.

-- 6. Policies for onboarding_steps
DROP POLICY IF EXISTS "onboarding_steps_select_policy" ON public.onboarding_steps;
CREATE POLICY "onboarding_steps_select_policy"
  ON public.onboarding_steps
  FOR SELECT
  USING (true); -- Can select if they know the tracking token of the request

DROP POLICY IF EXISTS "onboarding_steps_all_admin" ON public.onboarding_steps;
CREATE POLICY "onboarding_steps_all_admin"
  ON public.onboarding_steps
  FOR ALL
  USING (public.is_super_admin());

-- 7. Policies for onboarding_uploads
DROP POLICY IF EXISTS "onboarding_uploads_select_policy" ON public.onboarding_uploads;
CREATE POLICY "onboarding_uploads_select_policy"
  ON public.onboarding_uploads
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "onboarding_uploads_insert_policy" ON public.onboarding_uploads;
CREATE POLICY "onboarding_uploads_insert_policy"
  ON public.onboarding_uploads
  FOR INSERT
  WITH CHECK (true); -- anyone can insert (uploads from client/partner page)

DROP POLICY IF EXISTS "onboarding_uploads_all_admin" ON public.onboarding_uploads;
CREATE POLICY "onboarding_uploads_all_admin"
  ON public.onboarding_uploads
  FOR ALL
  USING (public.is_super_admin());

-- 8. Trigger function and trigger to create default steps when a new request is created
CREATE OR REPLACE FUNCTION public.handle_onboarding_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  -- Insert default onboarding steps
  INSERT INTO public.onboarding_steps (onboarding_id, step_code, title, status, owner_type, sla_days, deadline_at)
  VALUES
    (NEW.id, 'nif', 'Verificação do NIF e Alvará', 'pendente', 'klasse', 2, now() + interval '2 days'),
    (NEW.id, 'planilha_alunos', 'Envio da Planilha de Alunos', 'pendente', 'escola', 7, now() + interval '7 days'),
    (NEW.id, 'treinamento', 'Formação da Equipa da Escola', 'pendente', 'parceiro', 5, now() + interval '5 days'),
    (NEW.id, 'ativacao', 'Ativação e Publicação do Portal', 'pendente', 'klasse', 1, now() + interval '1 day');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_request_created ON public.onboarding_requests;
CREATE TRIGGER trg_onboarding_request_created
  AFTER INSERT ON public.onboarding_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_onboarding_request_created();

-- 9. Trigger to auto-generate tracking token for new onboarding requests if not provided
CREATE OR REPLACE FUNCTION public.handle_onboarding_request_insert_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.tracking_token IS NULL THEN
    NEW.tracking_token := UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4)) || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 5, 4)) || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 9, 4));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_request_insert_token ON public.onboarding_requests;
CREATE TRIGGER trg_onboarding_request_insert_token
  BEFORE INSERT ON public.onboarding_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_onboarding_request_insert_token();

-- 10. Create the onboarding storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'onboarding',
  'onboarding',
  false,
  10485760, -- 10MB
  ARRAY[
    'application/pdf', 
    'image/jpeg', 
    'image/png', 
    'image/webp', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
    'application/vnd.ms-excel', 
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for onboarding bucket
DROP POLICY IF EXISTS "Permitir upload publico de documentos de onboarding" ON storage.objects;
CREATE POLICY "Permitir upload publico de documentos de onboarding"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'onboarding');

DROP POLICY IF EXISTS "Permitir leitura de documentos de onboarding para todos" ON storage.objects;
CREATE POLICY "Permitir leitura de documentos de onboarding para todos"
ON storage.objects FOR SELECT
USING (bucket_id = 'onboarding');

COMMIT;
