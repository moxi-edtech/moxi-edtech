-- Migration to create the 'classes' table and add 'classe_id' to the 'turmas' table.

-- Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordem INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS to classes table
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_classes"
ON public.classes
FOR SELECT
USING (
  escola_id = (
    SELECT escola_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "insert_own_classes"
ON public.classes
FOR INSERT
WITH CHECK (
  escola_id = (
    SELECT escola_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "update_own_classes"
ON public.classes
FOR UPDATE
USING (
  escola_id = (
    SELECT escola_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "delete_own_classes"
ON public.classes
FOR DELETE
USING (
  escola_id = (
    SELECT escola_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

GRANT ALL ON public.classes TO authenticated;
GRANT SELECT ON public.classes TO anon;

-- Add classe_id to turmas table
ALTER TABLE public.turmas
ADD COLUMN IF NOT EXISTS classe_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- Add index for classe_id
CREATE INDEX IF NOT EXISTS idx_turmas_classe_id ON public.turmas(classe_id);
