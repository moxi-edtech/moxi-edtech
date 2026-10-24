/** Safe client-facing classification for the paginated Course RPC.
 * SQLSTATE 42501 comes from a deliberate school/role denial in PostgreSQL;
 * it must never be misreported as an unexpected server failure.
 */
export function classifyCourseTurmasRpcError(error: { code?: string | null }): {
  status: number;
  message: string;
} {
  switch (error.code) {
    case "42501":
      return { status: 403, message: "Sem autorização para consultar as turmas deste curso." };
    case "PGRST202":
    case "42883":
      return { status: 503, message: "A paginação do curso ainda não está instalada neste ambiente." };
    case "22023":
      return { status: 400, message: "Classe ou janela inválida." };
    default:
      return { status: 500, message: "Não foi possível carregar as turmas." };
  }
}
