
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column to turmas
ALTER TABLE public.turmas
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Create a trigger to automatically update the updated_at timestamp on update
CREATE TRIGGER on_turmas_update
  BEFORE UPDATE ON public.turmas
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
