import { requireRoleInSchool } from "@/lib/authz";
import { K12_ADMIN_SECRETARIA_ROLE_GROUP } from "@/lib/roles";

/**
 * Arquivo académico é READ; não exige permissão de escrita em turmas.
 * A autorização é verificada pela pertença efectiva a cada escola, em vez
 * de comparar com profiles.escola_id (que pode ser a escola padrão do actor).
 */
export async function authorizeAcademicArchiveRead(
  supabase: any,
  escolaId: string,
) {
  return requireRoleInSchool({
    supabase, escolaId,
    roles: [
      ...K12_ADMIN_SECRETARIA_ROLE_GROUP,
      "diretor", "secretaria_financeiro", "admin_secretario",
    ],
  });
}
