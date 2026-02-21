DO $$
BEGIN
  CREATE TYPE course_category AS ENUM ('PRIMARIO', 'ESG_CICLO1', 'ESG_PUNIV', 'TECNICO', 'TECNICO_SAUDE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE discipline_component AS ENUM ('GERAL', 'SOCIO_CULTURAL', 'CIENTIFICA', 'TECNICA', 'ESPECIFICA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.curriculum_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category course_category NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.curriculum_preset_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id TEXT REFERENCES public.curriculum_presets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  component discipline_component NOT NULL,
  weekly_hours INT NOT NULL DEFAULT 0,
  subject_type TEXT DEFAULT 'core',
  UNIQUE(preset_id, name, grade_level)
);

CREATE INDEX IF NOT EXISTS idx_preset_subjects_preset ON public.curriculum_preset_subjects(preset_id);
CREATE INDEX IF NOT EXISTS idx_preset_subjects_grade ON public.curriculum_preset_subjects(grade_level);

CREATE TABLE IF NOT EXISTS public.school_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  preset_subject_id UUID REFERENCES public.curriculum_preset_subjects(id) NOT NULL,
  custom_weekly_hours INT,
  custom_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(escola_id, preset_subject_id)
);

ALTER TABLE public.curriculum_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_preset_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "curriculum_presets_read" ON public.curriculum_presets
    FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "curriculum_preset_subjects_read" ON public.curriculum_preset_subjects
    FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "school_subjects_read" ON public.school_subjects
    FOR SELECT TO authenticated
    USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "school_subjects_write" ON public.school_subjects
    FOR INSERT TO authenticated
    WITH CHECK (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "school_subjects_update" ON public.school_subjects
    FOR UPDATE TO authenticated
    USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = auth.uid()))
    WITH CHECK (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
