-- Synthetic CURTUME only: never execute against a customer database.
\ir finalist_guard_fixture.sql

CREATE TABLE public.alunos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, numero_processo text
);
CREATE TABLE public.historico_disciplinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  historico_ano_id uuid NOT NULL REFERENCES public.historico_anos(id),
  disciplina_id uuid NOT NULL,disciplina_nome text NOT NULL,
  nota_final numeric NOT NULL,notas_detalhe jsonb NOT NULL
);

-- Mimic the existing lifecycle lock's verified, server-owned history FK.
CREATE FUNCTION public.fixture_pauta_legal_history_link()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='fechado' THEN
   SELECT h.id INTO NEW.historico_ano_id
   FROM public.historico_anos h WHERE h.escola_id=NEW.escola_id
     AND h.matricula_id=NEW.matricula_id AND h.ano_letivo_id=NEW.ano_letivo_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_pauta_history_link
BEFORE INSERT OR UPDATE ON public.historico_snapshot_locks
FOR EACH ROW EXECUTE FUNCTION public.fixture_pauta_legal_history_link();

\ir ../../../migrations/20271117190000_curtume_fechar_pautas_2025_lote.sql
GRANT SELECT ON public.historico_anos,public.historico_disciplinas,
  public.historico_snapshot_locks,public.matriculas,public.audit_logs TO authenticated;
