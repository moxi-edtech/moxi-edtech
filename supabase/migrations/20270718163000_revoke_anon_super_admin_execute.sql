BEGIN;

DO $migration$
DECLARE signature regprocedure;
BEGIN
  FOR signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'create_afiliado_admin','create_afiliado_membro_admin','create_influencer_admin',
        'create_influencer_member_admin','list_afiliado_membros_admin','list_afiliados_admin',
        'list_influencer_members_admin','list_influencers_admin','toggle_afiliado_admin',
        'toggle_afiliado_membro_admin','toggle_influencer_admin','toggle_influencer_member_admin',
        'create_and_provision_escola_from_onboarding','create_escola_with_admin',
        'provisionar_escola_from_onboarding','update_escola_slug',
        'super_admin_reclassificar_aluno_turma'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
