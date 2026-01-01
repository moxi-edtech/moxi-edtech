-- supabase/migrations/20251114130000_generate_matricula_number.sql

-- Create sequence first if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public.matricula_seq START 1;

-- Grant usage on the sequence to authenticated users
GRANT USAGE ON SEQUENCE public.matricula_seq TO authenticated;

-- Function to generate a unique matricula number per school
CREATE OR REPLACE FUNCTION public.generate_matricula_number()
RETURNS TRIGGER AS $$
DECLARE
    next_seq_val BIGINT;
    escola_prefix TEXT;
BEGIN
    IF NEW.numero_matricula IS NULL THEN
        -- Get a prefix for the school (e.g., first 3 letters of school name, or a generated code)
        -- For simplicity, let's use a fixed prefix for now, or derive from escola_id
        -- A more robust solution might involve a school-specific configuration table for prefixes
        SELECT SUBSTRING(MD5(NEW.escola_id::text) FOR 3) INTO escola_prefix;

        -- Get the next value from the sequence
        SELECT nextval('public.matricula_seq') INTO next_seq_val;

        NEW.numero_matricula = CONCAT(escola_prefix, '-', LPAD(next_seq_val::text, 6, '0'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function before inserting a new matricula
DROP TRIGGER IF EXISTS trg_generate_matricula_number ON public.matriculas;
CREATE TRIGGER trg_generate_matricula_number
BEFORE INSERT ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.generate_matricula_number();