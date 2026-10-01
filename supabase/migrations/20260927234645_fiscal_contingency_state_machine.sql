ALTER TABLE public.fiscal_series
  ADD COLUMN IF NOT EXISTS contingency_state text,
  ADD COLUMN IF NOT EXISTS contingency_state_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contingency_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS contingency_last_deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS contingency_closed_at timestamptz;

ALTER TABLE public.fiscal_series
  DROP CONSTRAINT IF EXISTS fiscal_series_contingency_state_chk;
ALTER TABLE public.fiscal_series
  ADD CONSTRAINT fiscal_series_contingency_state_chk
  CHECK (
    contingency_state IS NULL
    OR contingency_state IN ('ready','active','closed','exhausted')
  );

CREATE TABLE IF NOT EXISTS public.fiscal_series_contingency_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  serie_id uuid NOT NULL REFERENCES public.fiscal_series(id) ON DELETE RESTRICT,
  state_from text,
  state_to text NOT NULL CHECK (state_to IN ('ready','active','closed','exhausted')),
  reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_series_cont_eventos_serie
  ON public.fiscal_series_contingency_eventos(serie_id,created_at,id);

ALTER TABLE public.fiscal_series_contingency_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_series_contingency_eventos_select
  ON public.fiscal_series_contingency_eventos;
CREATE POLICY fiscal_series_contingency_eventos_select
ON public.fiscal_series_contingency_eventos
FOR SELECT
TO authenticated
USING (public.user_has_role_in_empresa(empresa_id,ARRAY['owner','admin','operator']));

REVOKE ALL ON TABLE public.fiscal_series_contingency_eventos
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.fiscal_series_contingency_eventos TO authenticated;
GRANT SELECT,INSERT ON TABLE public.fiscal_series_contingency_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_block_contingency_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $function$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: eventos de contingência são append-only';
END;
$function$;

DROP TRIGGER IF EXISTS trg_fiscal_series_cont_eventos_immutable
  ON public.fiscal_series_contingency_eventos;
CREATE TRIGGER trg_fiscal_series_cont_eventos_immutable
BEFORE UPDATE OR DELETE
ON public.fiscal_series_contingency_eventos
FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_contingency_event_mutation();

DROP TRIGGER IF EXISTS trg_fiscal_series_cont_eventos_no_truncate
  ON public.fiscal_series_contingency_eventos;
CREATE TRIGGER trg_fiscal_series_cont_eventos_no_truncate
BEFORE TRUNCATE
ON public.fiscal_series_contingency_eventos
FOR EACH STATEMENT EXECUTE FUNCTION public.fiscal_block_contingency_event_mutation();

CREATE OR REPLACE FUNCTION public.fiscal_guard_contingency_series()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_last bigint;
BEGIN
  IF NEW.series_contingency_indicator='C' THEN
    IF NEW.origem_documento IS DISTINCT FROM 'contingencia' THEN
      RAISE EXCEPTION 'STATE: série C deve usar origem_documento=contingencia';
    END IF;

    IF NEW.agt_status='provisioned' AND NEW.contingency_state IS NULL THEN
      NEW.contingency_state := 'ready';
      NEW.contingency_state_changed_at := now();
    END IF;

    IF TG_OP='UPDATE'
       AND NEW.ultimo_numero IS DISTINCT FROM OLD.ultimo_numero THEN
      IF OLD.contingency_state IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'STATE: série de contingência precisa estar active antes de reservar número';
      END IF;

      IF NEW.last_document_no IS NOT NULL THEN
        BEGIN
          v_last := NEW.last_document_no::bigint;
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'STATE: last_document_no da série de contingência não é numérico';
        END;

        IF NEW.ultimo_numero >= v_last THEN
          NEW.contingency_state := 'exhausted';
          NEW.contingency_state_changed_at := now();
          NEW.contingency_closed_at := now();
          NEW.ativa := false;
        END IF;
      END IF;
    END IF;
  ELSE
    IF NEW.origem_documento='contingencia' THEN
      RAISE EXCEPTION 'STATE: origem_documento=contingencia exige seriesContingencyIndicator=C';
    END IF;
    IF NEW.contingency_state IS NOT NULL THEN
      RAISE EXCEPTION 'STATE: série normal não pode transportar contingency_state';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fiscal_series_contingency_guard
  ON public.fiscal_series;
CREATE TRIGGER trg_fiscal_series_contingency_guard
BEFORE INSERT OR UPDATE
ON public.fiscal_series
FOR EACH ROW EXECUTE FUNCTION public.fiscal_guard_contingency_series();

CREATE OR REPLACE FUNCTION public.fiscal_capture_contingency_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_reason text := nullif(current_setting('app.fiscal_contingency_reason',true),'');
  v_uid uuid := public.safe_auth_uid();
BEGIN
  IF NEW.contingency_state IS NOT NULL
     AND (
       TG_OP='INSERT'
       OR NEW.contingency_state IS DISTINCT FROM OLD.contingency_state
     ) THEN
    INSERT INTO public.fiscal_series_contingency_eventos(
      empresa_id,serie_id,state_from,state_to,reason,snapshot,created_by
    )
    VALUES(
      NEW.empresa_id,
      NEW.id,
      CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.contingency_state END,
      NEW.contingency_state,
      COALESCE(
        v_reason,
        CASE NEW.contingency_state
          WHEN 'ready' THEN 'Série de contingência disponível'
          WHEN 'exhausted' THEN 'Intervalo autorizado esgotado'
          ELSE NULL
        END
      ),
      jsonb_build_object(
        'agt_series_code',NEW.agt_series_code,
        'series_year',NEW.series_year,
        'document_type',NEW.tipo_documento,
        'ultimo_numero',NEW.ultimo_numero,
        'last_document_no',NEW.last_document_no,
        'agt_status',NEW.agt_status
      ),
      v_uid
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fiscal_series_contingency_event
  ON public.fiscal_series;
CREATE TRIGGER trg_fiscal_series_contingency_event
AFTER INSERT OR UPDATE
ON public.fiscal_series
FOR EACH ROW EXECUTE FUNCTION public.fiscal_capture_contingency_transition();

CREATE OR REPLACE FUNCTION public.fiscal_set_contingency_state(
  p_serie_id uuid,
  p_state text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role',true),'');
  v_serie public.fiscal_series%ROWTYPE;
  v_state text := lower(btrim(coalesce(p_state,'')));
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
BEGIN
  SELECT * INTO v_serie
  FROM public.fiscal_series
  WHERE id=p_serie_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série não encontrada';
  END IF;

  IF v_claim_role <> 'service_role'
     AND session_user <> 'postgres'
     AND (
       v_uid IS NULL
       OR NOT public.user_has_role_in_empresa(
         v_serie.empresa_id,ARRAY['owner','admin','operator']
       )
     ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para gerir contingência';
  END IF;

  IF v_serie.series_contingency_indicator IS DISTINCT FROM 'C'
     OR v_serie.origem_documento IS DISTINCT FROM 'contingencia'
     OR v_serie.agt_status IS DISTINCT FROM 'provisioned' THEN
    RAISE EXCEPTION 'STATE: apenas série C provisionada pela AGT pode gerir contingência';
  END IF;

  IF v_state NOT IN ('ready','active','closed') THEN
    RAISE EXCEPTION 'DATA: estado de contingência inválido';
  END IF;

  IF v_serie.contingency_state IN ('closed','exhausted') THEN
    IF v_state=v_serie.contingency_state THEN
      RETURN jsonb_build_object(
        'ok',true,'idempotent',true,'serie_id',v_serie.id,'state',v_serie.contingency_state
      );
    END IF;
    RAISE EXCEPTION 'STATE: série de contingência terminal não pode ser reaberta';
  END IF;

  IF v_serie.contingency_state=v_state THEN
    RETURN jsonb_build_object(
      'ok',true,'idempotent',true,'serie_id',v_serie.id,'state',v_state
    );
  END IF;

  IF v_state='closed' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'DATA: motivo é obrigatório para encerrar série de contingência';
  END IF;

  PERFORM set_config('app.fiscal_contingency_reason',coalesce(v_reason,''),true);

  UPDATE public.fiscal_series
  SET
    contingency_state=v_state,
    contingency_state_changed_at=now(),
    contingency_activated_at=CASE
      WHEN v_state='active' THEN now()
      ELSE contingency_activated_at
    END,
    contingency_last_deactivated_at=CASE
      WHEN v_state='ready' AND contingency_state='active' THEN now()
      ELSE contingency_last_deactivated_at
    END,
    contingency_closed_at=CASE
      WHEN v_state='closed' THEN now()
      ELSE contingency_closed_at
    END,
    ativa=CASE WHEN v_state='closed' THEN false ELSE ativa END,
    descontinuada_em=CASE
      WHEN v_state='closed' THEN coalesce(descontinuada_em,now())
      ELSE descontinuada_em
    END,
    updated_at=now()
  WHERE id=v_serie.id;

  RETURN jsonb_build_object(
    'ok',true,'idempotent',false,'serie_id',v_serie.id,'state',v_state
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fiscal_block_contingency_event_mutation()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.fiscal_guard_contingency_series()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.fiscal_capture_contingency_transition()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.fiscal_set_contingency_state(uuid,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fiscal_set_contingency_state(uuid,text,text)
  TO authenticated,service_role;
