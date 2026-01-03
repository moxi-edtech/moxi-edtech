BEGIN;

-- Corrige tipo dos cursos criados via onboarding conforme preset
UPDATE public.cursos c
SET tipo = CASE c.curriculum_key
  WHEN 'primario_base' THEN 'primario'
  WHEN 'primario_avancado' THEN 'primario'
  WHEN 'ciclo1' THEN 'ciclo1'
  WHEN 'puniv' THEN 'puniv'
  WHEN 'economicas' THEN 'puniv'
  WHEN 'tecnico_informatica' THEN 'tecnico'
  WHEN 'tecnico_gestao' THEN 'tecnico'
  WHEN 'tecnico_construcao' THEN 'tecnico'
  WHEN 'tecnico_base' THEN 'tecnico'
  WHEN 'saude_enfermagem' THEN 'tecnico'
  WHEN 'saude_farmacia_analises' THEN 'tecnico'
  ELSE tipo
END
WHERE c.curriculum_key IS NOT NULL
  AND (c.tipo IS NULL OR c.tipo <> CASE c.curriculum_key
    WHEN 'primario_base' THEN 'primario'
    WHEN 'primario_avancado' THEN 'primario'
    WHEN 'ciclo1' THEN 'ciclo1'
    WHEN 'puniv' THEN 'puniv'
    WHEN 'economicas' THEN 'puniv'
    WHEN 'tecnico_informatica' THEN 'tecnico'
    WHEN 'tecnico_gestao' THEN 'tecnico'
    WHEN 'tecnico_construcao' THEN 'tecnico'
    WHEN 'tecnico_base' THEN 'tecnico'
    WHEN 'saude_enfermagem' THEN 'tecnico'
    WHEN 'saude_farmacia_analises' THEN 'tecnico'
    ELSE c.tipo
  END);

COMMIT;
