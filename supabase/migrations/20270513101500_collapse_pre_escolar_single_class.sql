BEGIN;

UPDATE public.curriculum_presets
SET
  description = 'Educação infantil organizada como uma classe única.',
  badge = 'Classe única',
  class_min = 0,
  class_max = 0,
  updated_at = now()
WHERE id = 'pre_escolar';

INSERT INTO public.curriculum_preset_subjects (
  preset_id,
  name,
  grade_level,
  component,
  weekly_hours,
  subject_type
)
VALUES
  ('pre_escolar', 'Comunicação linguística', 'Pré-Escolar', 'GERAL', 5, 'core'),
  ('pre_escolar', 'Representação Matemática', 'Pré-Escolar', 'GERAL', 5, 'core'),
  ('pre_escolar', 'Meio Físico e Social', 'Pré-Escolar', 'GERAL', 4, 'core'),
  ('pre_escolar', 'Expressão Manual e Plástica', 'Pré-Escolar', 'GERAL', 5, 'core'),
  ('pre_escolar', 'Expressão Musical', 'Pré-Escolar', 'GERAL', 3, 'core'),
  ('pre_escolar', 'Expressão Motora/Psicomotricidade', 'Pré-Escolar', 'GERAL', 3, 'core')
ON CONFLICT (preset_id, name, grade_level) DO UPDATE SET
  component = EXCLUDED.component,
  weekly_hours = EXCLUDED.weekly_hours,
  subject_type = EXCLUDED.subject_type,
  updated_at = now(),
  is_active = true;

DELETE FROM public.curriculum_preset_subjects
WHERE preset_id = 'pre_escolar'
  AND grade_level <> 'Pré-Escolar';

COMMIT;
