// O papel efetivo vem de escola_users (SSOT), não de profiles ou do cliente.
export const DIRECAO_NOME_PAPEIS = [
  "diretor",
  "admin",
  "admin_escola",
  "staff_admin",
] as const;

export function canCorrigirNomeAluno(papel: unknown): boolean {
  return typeof papel === "string"
    && (DIRECAO_NOME_PAPEIS as readonly string[]).includes(papel);
}
