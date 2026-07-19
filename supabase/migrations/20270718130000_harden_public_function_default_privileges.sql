BEGIN;

-- New functions must be private by default. Client-facing RPCs require an
-- explicit, signature-specific GRANT in the migration that creates them.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
