DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'cursos'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_cursos') THEN
      CREATE TRIGGER trg_audit_cursos
      AFTER INSERT OR UPDATE OR DELETE ON public.cursos
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'turmas'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_turmas') THEN
      CREATE TRIGGER trg_audit_turmas
      AFTER INSERT OR UPDATE OR DELETE ON public.turmas
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'mensalidades'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_mensalidades') THEN
      CREATE TRIGGER trg_audit_mensalidades
      AFTER INSERT OR UPDATE OR DELETE ON public.mensalidades
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;
END $$;
