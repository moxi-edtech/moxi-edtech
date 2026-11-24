-- Separate migration: PostgreSQL requires new enum values to commit before use.
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'secretaria.expediente.fechado';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'secretaria.expediente.lembrete';
