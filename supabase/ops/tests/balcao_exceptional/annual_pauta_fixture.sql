-- Synthetic database only. Loads the actual grade writer, nonce and triggers.
\ir fixture.sql
CREATE TABLE public.modelos_avaliacao(id uuid);
-- The journey migration only needs this relation's rowtype to compile functions
-- unrelated to this test. Their runtime paths are not invoked here.
\ir ../../../migrations/20271112050000_balcao_percurso_academico.sql
\ir ../../../migrations/20271112080000_balcao_pauta_anual_batch.sql
