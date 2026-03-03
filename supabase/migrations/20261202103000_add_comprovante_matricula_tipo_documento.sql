BEGIN;

ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'comprovante_matricula';

COMMIT;
