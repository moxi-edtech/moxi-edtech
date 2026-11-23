/**
 * Permissões de gestão de bolsa integral no KLASSE (por escola).
 * Alinhar com a RPC klasse_definir_bolsa_integral e o endpoint de bolsa.
 *
 * Este helper só determina visibilidade/roles. A autorização efetiva de escrita
 * continua no endpoint autenticado, no RLS e na RPC transacional do Supabase.
 */
export const BOLSA_GESTAO_PAPEIS = [
  "admin",
  "admin_escola",
  "admin_financeiro",
  "admin_secretaria",
  "admin_secretario",
  "secretaria",
  "financeiro",
  "diretor",
  "staff_admin",
] as const;

export function canManageBolsa(papel: unknown): boolean {
  return typeof papel === "string"
    && (BOLSA_GESTAO_PAPEIS as readonly string[]).includes(papel.trim().toLowerCase());
}
