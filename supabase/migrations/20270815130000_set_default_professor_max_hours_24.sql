-- A carga semanal máxima padrão dos professores é de 24 horas.
ALTER TABLE public.teachers
  ALTER COLUMN carga_horaria_maxima SET DEFAULT 24;

-- Atualiza apenas o valor padrão anterior, preservando configurações
-- personalizadas que já sejam diferentes de 20.
UPDATE public.teachers
SET carga_horaria_maxima = 24
WHERE carga_horaria_maxima = 20;
