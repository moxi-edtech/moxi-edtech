-- Validations for finance module compatibility
-- Copy/paste each block into Supabase SQL editor to verify existing schema.

-- 1. Check required base tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'escolas',
    'alunos',
    'matriculas',
    'turmas',
    'classes',
    'cursos_oferta',
    'matriculas_cursos'
  )
ORDER BY table_name;

-- 2a. Inspect alunos columns (confirm absence of user_id, classe_id, curso_id)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'alunos'
ORDER BY ordinal_position;

-- 2b. Inspect matriculas columns and status type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'matriculas'
ORDER BY ordinal_position;

-- If status is an enum, list its values (adjust typname if different)
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'status_matricula'
ORDER BY e.enumsortorder;

-- 2c. Inspect turmas columns (confirm classe_id)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'turmas'
ORDER BY ordinal_position;

-- 2d. Inspect cursos_oferta and matriculas_cursos columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cursos_oferta'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'matriculas_cursos'
ORDER BY ordinal_position;

-- 3. Verify RLS helper functions exist
SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'check_super_admin_role',
    'is_escola_admin',
    'is_escola_member'
  )
ORDER BY proname;

-- 4. Check whether finance tables already exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tabelas_mensalidade', 'cobrancas')
ORDER BY table_name;
