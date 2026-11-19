/**
 * Permissões de confirmação de desistência em K12.
 * Fonte do papel: escola_users.papel. Um endereço /operacoes ou /admin
 * não concede por si só autoridade para alterar matrículas.
 *
 * Manter os valores alinhados com a RPC registar_desistencia_matricula.
 */
export const DESISTENCIA_CONFIRMACAO_PAPEIS = [
  "diretor",
  "admin",
  "admin_escola",
  "staff_admin",
  "admin_secretaria",
  "secretaria",
  "secretaria_financeiro",
  "admin_financeiro",
] as const;

export function canConfirmarDesistencia(papel: unknown): boolean {
  return typeof papel === "string"
    && (DESISTENCIA_CONFIRMACAO_PAPEIS as readonly string[]).includes(papel.trim().toLowerCase());
}
