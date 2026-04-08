BEGIN;

ALTER TABLE public.escola_users
  DROP CONSTRAINT IF EXISTS escola_users_papel_check;

ALTER TABLE public.escola_users
  ADD CONSTRAINT escola_users_papel_check
  CHECK (
    papel = ANY (
      ARRAY[
        'admin',
        'staff_admin',
        'financeiro',
        'secretaria',
        'aluno',
        'professor',
        'admin_escola',
        'admin_financeiro',
        'secretaria_financeiro',
        'formacao_admin',
        'formacao_secretaria',
        'formacao_financeiro',
        'formador',
        'formando'
      ]::text[]
    )
  );

COMMIT;

