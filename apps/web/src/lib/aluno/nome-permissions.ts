// O papel efetivo vem de escola_users (SSOT), não de profiles ou do cliente.
export const NOME_ALUNO_EDICAO_PAPEIS = [
  "diretor",
  "admin",
  "admin_escola",
  "staff_admin",
  "admin_financeiro",
  "admin_secretaria",
  "secretaria",
] as const;

export function canCorrigirNomeAluno(papel: unknown): boolean {
  return typeof papel === "string"
    && (NOME_ALUNO_EDICAO_PAPEIS as readonly string[]).includes(papel);
}
