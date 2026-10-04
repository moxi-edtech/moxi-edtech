BEGIN;

ALTER FUNCTION public.validar_lote_pagamentos(uuid,boolean,text)
SECURITY INVOKER;

ALTER FUNCTION public.aluno_submeter_comprovativo_pagamentos(uuid[],text,jsonb,text)
SECURITY INVOKER;

COMMIT;
