-- Migration: Automatic Honorários from Aulas
-- Date: 05/05/2026

BEGIN;

-- 1. Add valor_hora to formacao_cohort_formadores if it doesn't exist
-- This allows setting a specific hourly rate for a formador in a specific cohort
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'formacao_cohort_formadores' AND column_name = 'valor_hora') THEN
        ALTER TABLE public.formacao_cohort_formadores ADD COLUMN valor_hora numeric(14,2) DEFAULT 0 CHECK (valor_hora >= 0);
    END IF;
END $$;

-- 2. Update RLS for honorarios to allow formadores to insert their own rascunhos
DROP POLICY IF EXISTS formacao_honorarios_lancamentos_insert_policy ON public.formacao_honorarios_lancamentos;
CREATE POLICY formacao_honorarios_lancamentos_insert_policy
ON public.formacao_honorarios_lancamentos
FOR INSERT TO public
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND (
    public.can_access_formacao_backoffice(escola_id)
    OR (
      formador_user_id = auth.uid()
      AND public.user_has_role_in_school(escola_id, ARRAY['formador'])
    )
  )
);

-- 3. Function to sync class to honorario
CREATE OR REPLACE FUNCTION public.fn_formacao_sync_aula_to_honorario()
RETURNS TRIGGER AS $$
DECLARE
    v_valor_hora numeric(14,2);
    v_referencia text;
BEGIN
    -- Only trigger when status changes to 'realizada'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'realizada' AND OLD.status <> 'realizada') OR
       (TG_OP = 'INSERT' AND NEW.status = 'realizada') THEN
        
        -- Get the hourly rate for this formador in this cohort
        SELECT valor_hora INTO v_valor_hora
        FROM public.formacao_cohort_formadores
        WHERE escola_id = NEW.escola_id
          AND cohort_id = NEW.cohort_id
          AND formador_user_id = NEW.formador_user_id
        LIMIT 1;

        -- Fallback to 0 if not found
        v_valor_hora := COALESCE(v_valor_hora, 0);

        -- Generate reference
        v_referencia := 'AUTO-' || NEW.id::text;

        -- Upsert honorario record
        -- We use upsert to avoid duplicate honorarios for the same class ID if it toggles status
        INSERT INTO public.formacao_honorarios_lancamentos (
            escola_id,
            cohort_id,
            formador_user_id,
            referencia,
            horas_ministradas,
            valor_hora,
            competencia,
            status,
            created_by
        )
        VALUES (
            NEW.escola_id,
            NEW.cohort_id,
            NEW.formador_user_id,
            v_referencia,
            NEW.horas_ministradas,
            v_valor_hora,
            NEW.data,
            'aberto',
            NEW.formador_user_id
        )
        ON CONFLICT (escola_id, referencia) DO UPDATE
        SET 
            horas_ministradas = EXCLUDED.horas_ministradas,
            valor_hora = EXCLUDED.valor_hora,
            competencia = EXCLUDED.competencia,
            updated_at = now();
            
    END IF;

    -- If class is moved from 'realizada' to something else, we should probably mark honorario as 'cancelado' 
    -- but usually it's better to keep it for manual review if it was already created.
    -- For now, we only focus on automatic creation.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger on formacao_aulas
DROP TRIGGER IF EXISTS tr_formacao_sync_aula_to_honorario ON public.formacao_aulas;
CREATE TRIGGER tr_formacao_sync_aula_to_honorario
AFTER INSERT OR UPDATE ON public.formacao_aulas
FOR EACH ROW
EXECUTE FUNCTION public.fn_formacao_sync_aula_to_honorario();

COMMIT;
