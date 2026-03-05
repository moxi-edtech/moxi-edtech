-- Decisão de produto: substituir "declaracao_notas" por "boletim_trimestral" no catálogo oficial.
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'boletim_trimestral';
