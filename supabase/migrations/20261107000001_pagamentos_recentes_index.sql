BEGIN;

CREATE INDEX IF NOT EXISTS idx_pagamentos_escola_day_created_at
  ON public.pagamentos (escola_id, day_key, created_at DESC);

COMMIT;
