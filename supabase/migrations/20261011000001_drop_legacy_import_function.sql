-- Apaga a função de importação antiga e ambígua
DROP FUNCTION IF EXISTS public.importar_alunos(uuid, uuid);
