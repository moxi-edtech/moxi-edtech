-- Migration: 20270509000000_calendario_eventos_med_686_25.sql
-- Description: Create calendario_eventos table for Angolan academic calendar evolution

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_evento_calendario') THEN
        CREATE TYPE tipo_evento_calendario AS ENUM (
          'FERIADO', 
          'PAUSA_PEDAGOGICA', 
          'PROVA_TRIMESTRAL', 
          'EXAME_NACIONAL', 
          'EVENTO_ESCOLA'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.calendario_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
    ano_letivo_id UUID NOT NULL REFERENCES anos_letivos(id) ON DELETE CASCADE,
    tipo tipo_evento_calendario NOT NULL,
    nome VARCHAR(255) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    cor_hex VARCHAR(7) DEFAULT '#64748b',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT calendario_eventos_check_dates CHECK (data_fim >= data_inicio)
);

-- RLS
ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendario_eventos_select" ON public.calendario_eventos;
CREATE POLICY "calendario_eventos_select" ON public.calendario_eventos 
  FOR SELECT TO authenticated USING (escola_id = current_tenant_escola_id());

DROP POLICY IF EXISTS "calendario_eventos_insert" ON public.calendario_eventos;
CREATE POLICY "calendario_eventos_insert" ON public.calendario_eventos 
  FOR INSERT TO authenticated WITH CHECK (escola_id = current_tenant_escola_id());

DROP POLICY IF EXISTS "calendario_eventos_update" ON public.calendario_eventos;
CREATE POLICY "calendario_eventos_update" ON public.calendario_eventos 
  FOR UPDATE TO authenticated USING (escola_id = current_tenant_escola_id());

DROP POLICY IF EXISTS "calendario_eventos_delete" ON public.calendario_eventos;
CREATE POLICY "calendario_eventos_delete" ON public.calendario_eventos 
  FOR DELETE TO authenticated USING (escola_id = current_tenant_escola_id());

-- Updated At Trigger
DROP TRIGGER IF EXISTS trg_set_updated_at_calendario_eventos ON public.calendario_eventos;
CREATE TRIGGER trg_set_updated_at_calendario_eventos
BEFORE UPDATE ON public.calendario_eventos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
