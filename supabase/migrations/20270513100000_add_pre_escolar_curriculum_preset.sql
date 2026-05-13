BEGIN;

INSERT INTO public.curriculum_presets (
  id,
  name,
  category,
  description,
  course_code,
  badge,
  recommended,
  class_min,
  class_max
)
VALUES (
  'pre_escolar',
  'Pré-Escolar',
  'PRIMARIO',
  'Educação infantil: 3, 4 e 5 anos.',
  'PRE',
  '3-5 anos',
  false,
  0,
  0
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  course_code = EXCLUDED.course_code,
  badge = EXCLUDED.badge,
  recommended = EXCLUDED.recommended,
  class_min = EXCLUDED.class_min,
  class_max = EXCLUDED.class_max,
  updated_at = now();

INSERT INTO public.curriculum_preset_subjects (
  preset_id,
  name,
  grade_level,
  component,
  weekly_hours,
  subject_type
)
VALUES
  ('pre_escolar', 'Comunicação linguística', '3 anos', 'GERAL', 2, 'core'),
  ('pre_escolar', 'Representação Matemática', '3 anos', 'GERAL', 1, 'core'),
  ('pre_escolar', 'Meio Físico e Social', '3 anos', 'GERAL', 1, 'core'),
  ('pre_escolar', 'Expressão Manual e Plástica', '3 anos', 'GERAL', 2, 'core'),
  ('pre_escolar', 'Expressão Musical', '3 anos', 'GERAL', 2, 'core'),
  ('pre_escolar', 'Expressão Motora/Psicomotricidade', '3 anos', 'GERAL', 1, 'core'),
  ('pre_escolar', 'Comunicação linguística', '4 anos', 'GERAL', 5, 'core'),
  ('pre_escolar', 'Representação Matemática', '4 anos', 'GERAL', 4, 'core'),
  ('pre_escolar', 'Meio Físico e Social', '4 anos', 'GERAL', 2, 'core'),
  ('pre_escolar', 'Expressão Manual e Plástica', '4 anos', 'GERAL', 4, 'core'),
  ('pre_escolar', 'Expressão Musical', '4 anos', 'GERAL', 2, 'core'),
  ('pre_escolar', 'Expressão Motora/Psicomotricidade', '4 anos', 'GERAL', 2, 'core'),
  ('pre_escolar', 'Comunicação linguística', '5 anos', 'GERAL', 5, 'core'),
  ('pre_escolar', 'Representação Matemática', '5 anos', 'GERAL', 5, 'core'),
  ('pre_escolar', 'Meio Físico e Social', '5 anos', 'GERAL', 4, 'core'),
  ('pre_escolar', 'Expressão Manual e Plástica', '5 anos', 'GERAL', 5, 'core'),
  ('pre_escolar', 'Expressão Musical', '5 anos', 'GERAL', 3, 'core'),
  ('pre_escolar', 'Expressão Motora/Psicomotricidade', '5 anos', 'GERAL', 3, 'core')
ON CONFLICT (preset_id, name, grade_level) DO UPDATE SET
  component = EXCLUDED.component,
  weekly_hours = EXCLUDED.weekly_hours,
  subject_type = EXCLUDED.subject_type,
  updated_at = now(),
  is_active = true;

DELETE FROM public.curriculum_preset_subjects
WHERE preset_id = 'pre_escolar'
  AND (name, grade_level) NOT IN (
    ('Comunicação linguística', '3 anos'),
    ('Representação Matemática', '3 anos'),
    ('Meio Físico e Social', '3 anos'),
    ('Expressão Manual e Plástica', '3 anos'),
    ('Expressão Musical', '3 anos'),
    ('Expressão Motora/Psicomotricidade', '3 anos'),
    ('Comunicação linguística', '4 anos'),
    ('Representação Matemática', '4 anos'),
    ('Meio Físico e Social', '4 anos'),
    ('Expressão Manual e Plástica', '4 anos'),
    ('Expressão Musical', '4 anos'),
    ('Expressão Motora/Psicomotricidade', '4 anos'),
    ('Comunicação linguística', '5 anos'),
    ('Representação Matemática', '5 anos'),
    ('Meio Físico e Social', '5 anos'),
    ('Expressão Manual e Plástica', '5 anos'),
    ('Expressão Musical', '5 anos'),
    ('Expressão Motora/Psicomotricidade', '5 anos')
  );

COMMIT;
