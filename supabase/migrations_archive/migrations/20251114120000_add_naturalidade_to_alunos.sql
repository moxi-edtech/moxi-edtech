-- Add naturalidade to alunos table
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'alunos' 
        AND column_name = 'naturalidade'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.alunos ADD COLUMN naturalidade TEXT;
    END IF;
END $$;