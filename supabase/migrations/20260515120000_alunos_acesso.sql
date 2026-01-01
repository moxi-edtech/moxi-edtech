-- Liberação de acesso para alunos (códigos, outbox e métricas)

-- 1) Novas colunas na tabela alunos
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS acesso_liberado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS codigo_ativacao text,
  ADD COLUMN IF NOT EXISTS data_ativacao timestamptz,
  ADD COLUMN IF NOT EXISTS usuario_auth_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ultimo_reset_senha timestamptz;

-- Índices de apoio
CREATE UNIQUE INDEX IF NOT EXISTS uq_alunos_escola_codigo_ativacao
  ON public.alunos (escola_id, codigo_ativacao)
  WHERE codigo_ativacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alunos_escola_acesso_liberado
  ON public.alunos (escola_id, acesso_liberado)
  WHERE deleted_at IS NULL;

-- 2) Outbox de notificações (para WhatsApp/Email)
CREATE TABLE IF NOT EXISTS public.outbox_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,

  canal text NOT NULL CHECK (canal IN ('whatsapp','email')),
  destino text,
  mensagem text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','error')),
  error_message text,
  mensagem_id text,

  request_id uuid NOT NULL DEFAULT gen_random_uuid(),

  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON public.outbox_notificacoes (status, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_escola_status
  ON public.outbox_notificacoes (escola_id, status, created_at);

ALTER TABLE public.outbox_notificacoes ENABLE ROW LEVEL SECURITY;

-- 2b) Habilitar realtime (ignora se publicação já existir)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outbox_notificacoes;
  EXCEPTION WHEN undefined_object THEN
    -- cria publicação se não existir
    CREATE PUBLICATION supabase_realtime;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outbox_notificacoes;
  END;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

-- 3) Função geradora de código de ativação
CREATE OR REPLACE FUNCTION public.generate_activation_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem O/I/0/1
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN 'KLASSE-' || result;
END;
$$;

-- 4) Helper de permissão
CREATE OR REPLACE FUNCTION public.can_manage_school(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND (p.escola_id = p_escola_id OR p.current_escola_id = p_escola_id)
        AND p.role IN ('admin','secretaria','financeiro')
        AND p.deleted_at IS NULL
    );
$$;

-- 5) RPC: Libera acesso e enfileira notificação
CREATE OR REPLACE FUNCTION public.liberar_acesso_alunos_v2(
  p_escola_id uuid,
  p_aluno_ids uuid[],
  p_canal text DEFAULT 'whatsapp'
)
RETURNS TABLE(
  aluno_id uuid,
  codigo_ativacao text,
  request_id uuid,
  enfileirado boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_id uuid;
  v_code text;
  v_request_id uuid := gen_random_uuid();
  v_attempts int;
BEGIN
  IF p_canal NOT IN ('whatsapp','email') THEN
    RAISE EXCEPTION 'canal inválido: %', p_canal;
  END IF;

  IF NOT public.can_manage_school(p_escola_id) THEN
    RAISE EXCEPTION 'sem permissão para escola %', p_escola_id;
  END IF;

  FOREACH v_aluno_id IN ARRAY p_aluno_ids LOOP
    -- Confirma elegibilidade
    IF NOT EXISTS (
      SELECT 1 FROM public.alunos a
      WHERE a.id = v_aluno_id
        AND a.escola_id = p_escola_id
        AND a.deleted_at IS NULL
        AND COALESCE(a.status,'') <> 'inativo'
        AND COALESCE(a.acesso_liberado, false) = false
    ) THEN
      CONTINUE;
    END IF;

    -- Se já existir usuário vinculado, apenas reenfileira notificação (idempotência)
    PERFORM 1 FROM public.alunos a
     WHERE a.id = v_aluno_id
       AND a.escola_id = p_escola_id
       AND a.usuario_auth_id IS NOT NULL;
    IF FOUND THEN
      INSERT INTO public.outbox_notificacoes (escola_id, aluno_id, canal, status, request_id)
      VALUES (p_escola_id, v_aluno_id, p_canal, 'pending', v_request_id)
      ON CONFLICT DO NOTHING;

      aluno_id := v_aluno_id;
      codigo_ativacao := NULL;
      request_id := v_request_id;
      enfileirado := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      v_code := public.generate_activation_code();
      BEGIN
        UPDATE public.alunos
           SET codigo_ativacao = v_code,
               acesso_liberado = true,
               data_ativacao = now()
         WHERE id = v_aluno_id
           AND escola_id = p_escola_id
           AND COALESCE(acesso_liberado, false) = false;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF v_attempts >= 6 THEN
          RAISE EXCEPTION 'falha ao gerar código único para aluno %', v_aluno_id;
        END IF;
        -- tenta novamente
      END;
    END LOOP;

    INSERT INTO public.outbox_notificacoes (escola_id, aluno_id, canal, status, request_id)
    VALUES (p_escola_id, v_aluno_id, p_canal, 'pending', v_request_id);

    aluno_id := v_aluno_id;
    codigo_ativacao := v_code;
    request_id := v_request_id;
    enfileirado := true;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 6) Métricas básicas de acesso
CREATE OR REPLACE FUNCTION public.get_metricas_acesso_alunos(p_escola_id uuid)
RETURNS TABLE(
  total_alunos integer,
  acesso_liberado integer,
  sem_acesso integer,
  enviados_whatsapp integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int AS total_alunos,
    COUNT(*) FILTER (WHERE COALESCE(acesso_liberado,false) = true)::int AS acesso_liberado,
    COUNT(*) FILTER (WHERE COALESCE(acesso_liberado,false) = false)::int AS sem_acesso,
    (
      SELECT COUNT(*)::int FROM public.outbox_notificacoes o
      WHERE o.escola_id = p_escola_id AND o.canal = 'whatsapp'
    ) AS enviados_whatsapp
  FROM public.alunos a
  WHERE a.escola_id = p_escola_id
    AND a.deleted_at IS NULL;
$$;
