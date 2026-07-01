-- Fix log_crm_lead_activity trigger function to resolve uuid/text type mismatch
-- Created at: 2026-07-01

CREATE OR REPLACE FUNCTION public.log_crm_lead_activity()
RETURNS trigger AS $$
BEGIN
    -- Log pipeline movements
    IF TG_OP = 'UPDATE' AND OLD.etapa <> NEW.etapa THEN
        INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
        VALUES (
            NULL,
            NEW.membro_id,
            'CRM_LEAD_STAGE_MOVE',
            'crm_leads',
            NEW.id::text,
            jsonb_build_object(
                'lead_nome', NEW.nome_escola,
                'afiliado_codigo', NEW.afiliado_codigo,
                'origem_etapa', OLD.etapa,
                'nova_etapa', NEW.etapa,
                'motivo_perda', NEW.motivo_perda
            )
        );
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
        VALUES (
            NULL,
            NEW.membro_id,
            'CRM_LEAD_CREATED',
            'crm_leads',
            NEW.id::text,
            jsonb_build_object(
                'lead_nome', NEW.nome_escola,
                'afiliado_codigo', NEW.afiliado_codigo,
                'etapa', NEW.etapa
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
