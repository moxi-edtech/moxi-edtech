
-- POLÍTICA DE LEITURA (SELECT) PARA ALUNOS
-- Corrige a política de RLS para alunos, garantindo que mesmo os alunos
-- que não possuem o campo `escola_id` preenchido (por serem registros antigos)
-- ainda possam ser acessados.
-- A correção utiliza `COALESCE` para buscar o `escola_id` do perfil do aluno
-- como fallback, mantendo a compatibilidade e a segurança.

DROP POLICY IF EXISTS alunos_select_staff ON public.alunos;

CREATE POLICY alunos_select_staff
ON public.alunos
FOR SELECT
TO authenticated
USING (
  public.is_staff_escola(
    COALESCE(
      escola_id,
      (SELECT p.escola_id FROM public.profiles p WHERE p.user_id = public.alunos.profile_id LIMIT 1)
    )
  )
);
