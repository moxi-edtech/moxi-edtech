BEGIN;

ALTER TABLE public.historico_anos
  ADD COLUMN IF NOT EXISTS ano_letivo_id uuid,
  ADD COLUMN IF NOT EXISTS matricula_id uuid,
  ADD COLUMN IF NOT EXISTS snapshot_status text NOT NULL DEFAULT 'aberto' CHECK (snapshot_status IN ('aberto','fechado','reaberto')),
  ADD COLUMN IF NOT EXISTS snapshot_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_reopen_reason text,
  ADD COLUMN IF NOT EXISTS snapshot_reopened_by uuid,
  ADD COLUMN IF NOT EXISTS snapshot_lock_run_id uuid;

CREATE TABLE IF NOT EXISTS public.historico_snapshot_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id) ON DELETE CASCADE,
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  historico_ano_id uuid REFERENCES public.historico_anos(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','reaberto')),
  lock_run_id uuid,
  lock_job_id uuid,
  lock_step text,
  lock_source text NOT NULL DEFAULT 'orquestrador_fechamento',
  lock_reason text,
  locked_at timestamptz,
  reopened_at timestamptz,
  reopened_by uuid,
  reopened_reason text,
  allow_reopen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escola_id, ano_letivo_id, matricula_id)
);

CREATE INDEX IF NOT EXISTS idx_historico_snapshot_locks_status
  ON public.historico_snapshot_locks (escola_id, ano_letivo_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS trg_historico_snapshot_locks_updated_at ON public.historico_snapshot_locks;
CREATE TRIGGER trg_historico_snapshot_locks_updated_at
  BEFORE UPDATE ON public.historico_snapshot_locks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.historico_snapshot_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historico_snapshot_locks_select ON public.historico_snapshot_locks;
CREATE POLICY historico_snapshot_locks_select
  ON public.historico_snapshot_locks FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS historico_snapshot_locks_insert ON public.historico_snapshot_locks;
CREATE POLICY historico_snapshot_locks_insert
  ON public.historico_snapshot_locks FOR INSERT TO authenticated
  WITH CHECK (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS historico_snapshot_locks_update ON public.historico_snapshot_locks;
CREATE POLICY historico_snapshot_locks_update
  ON public.historico_snapshot_locks FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id())
  WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE OR REPLACE FUNCTION public.historico_set_snapshot_state(
  p_escola_id uuid,
  p_matricula_ids uuid[],
  p_ano_letivo_id uuid,
  p_novo_estado text,
  p_motivo text,
  p_run_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_row record;
  v_updated int := 0;
  v_new_status text := lower(trim(p_novo_estado));
  v_current_lock record;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola', 'staff_admin', 'secretaria'])
    INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada para alterar estado de snapshot histórico.';
  END IF;

  IF v_new_status NOT IN ('aberto', 'fechado', 'reaberto') THEN
    RAISE EXCEPTION 'LOGIC: estado inválido (%). Use aberto|fechado|reaberto.', p_novo_estado;
  END IF;

  IF v_new_status = 'reaberto' AND (p_motivo IS NULL OR btrim(p_motivo) = '') THEN
    RAISE EXCEPTION 'LOGIC: motivo é obrigatório para reabertura.';
  END IF;

  FOR v_row IN
    SELECT m.id AS matricula_id, m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id = v_escola_id
      AND m.id = ANY(p_matricula_ids)
  LOOP
    SELECT * INTO v_current_lock
    FROM public.historico_snapshot_locks hsl
    WHERE hsl.escola_id = v_escola_id
      AND hsl.ano_letivo_id = p_ano_letivo_id
      AND hsl.matricula_id = v_row.matricula_id
    FOR UPDATE;

    INSERT INTO public.historico_snapshot_locks (
      escola_id,
      ano_letivo_id,
      matricula_id,
      status,
      lock_run_id,
      lock_job_id,
      lock_step,
      lock_reason,
      locked_at,
      reopened_at,
      reopened_by,
      reopened_reason,
      allow_reopen
    )
    VALUES (
      v_escola_id,
      p_ano_letivo_id,
      v_row.matricula_id,
      v_new_status,
      p_run_id,
      p_run_id,
      CASE WHEN v_new_status = 'fechado' THEN 'GENERATING_HISTORY' ELSE NULL END,
      CASE WHEN v_new_status = 'fechado' THEN p_motivo ELSE NULL END,
      CASE WHEN v_new_status = 'fechado' THEN now() ELSE v_current_lock.locked_at END,
      CASE WHEN v_new_status = 'reaberto' THEN now() ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN v_actor_id ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN p_motivo ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN true ELSE false END
    )
    ON CONFLICT (escola_id, ano_letivo_id, matricula_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      lock_run_id = EXCLUDED.lock_run_id,
      lock_job_id = EXCLUDED.lock_job_id,
      lock_step = EXCLUDED.lock_step,
      lock_reason = COALESCE(EXCLUDED.lock_reason, public.historico_snapshot_locks.lock_reason),
      locked_at = COALESCE(EXCLUDED.locked_at, public.historico_snapshot_locks.locked_at),
      reopened_at = EXCLUDED.reopened_at,
      reopened_by = EXCLUDED.reopened_by,
      reopened_reason = EXCLUDED.reopened_reason,
      allow_reopen = EXCLUDED.allow_reopen,
      updated_at = now();

    UPDATE public.historico_anos ha
      SET snapshot_status = v_new_status,
          snapshot_lock_run_id = p_run_id,
          snapshot_locked_at = CASE WHEN v_new_status = 'fechado' THEN now() ELSE ha.snapshot_locked_at END,
          snapshot_reopened_at = CASE WHEN v_new_status = 'reaberto' THEN now() ELSE ha.snapshot_reopened_at END,
          snapshot_reopened_by = CASE WHEN v_new_status = 'reaberto' THEN v_actor_id ELSE ha.snapshot_reopened_by END,
          snapshot_reopen_reason = CASE WHEN v_new_status = 'reaberto' THEN p_motivo ELSE ha.snapshot_reopen_reason END
    WHERE ha.escola_id = v_escola_id
      AND ha.ano_letivo_id = p_ano_letivo_id
      AND ha.matricula_id = v_row.matricula_id;

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      v_escola_id,
      v_actor_id,
      CASE WHEN v_new_status = 'reaberto' THEN 'HISTORICO_SNAPSHOT_REABERTO' ELSE 'HISTORICO_SNAPSHOT_ESTADO_ALTERADO' END,
      'historico_snapshot_locks',
      v_row.matricula_id::text,
      'secretaria',
      jsonb_build_object(
        'ano_letivo_id', p_ano_letivo_id,
        'matricula_id', v_row.matricula_id,
        'novo_estado', v_new_status,
        'run_id', p_run_id,
        'motivo', p_motivo
      )
    );

    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'novo_estado', v_new_status);
END;
$$;

CREATE OR REPLACE VIEW public.vw_historico_snapshot_status AS
SELECT
  hsl.escola_id,
  hsl.ano_letivo_id,
  hsl.matricula_id,
  hsl.historico_ano_id,
  hsl.status,
  hsl.lock_run_id,
  hsl.lock_step,
  hsl.lock_reason,
  hsl.locked_at,
  hsl.reopened_at,
  hsl.reopened_by,
  hsl.reopened_reason,
  hsl.allow_reopen,
  hsl.updated_at
FROM public.historico_snapshot_locks hsl;

GRANT SELECT ON public.vw_historico_snapshot_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.historico_set_snapshot_state(uuid, uuid[], uuid, text, text, uuid) TO authenticated;

COMMIT;
