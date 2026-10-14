import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// A declaração com notas é aceite apenas para pagamentos legados já liquidados.
// Um pedido gratuito/aprovado não pode desbloquear o boletim.
export const BOLETIM_SERVICE_CODES = ["DOC_BOLETIM_TRIMESTRAL", "DOC_DECLARACAO_NOTAS"] as const;
export const BOLETIM_SERVICE_CODE = "DOC_BOLETIM_TRIMESTRAL";
export const BOLETIM_LEGACY_SERVICE_CODE = "DOC_DECLARACAO_NOTAS";

export function isBoletimServiceCode(code: string | null | undefined): boolean {
  return code === BOLETIM_SERVICE_CODE || code === BOLETIM_LEGACY_SERVICE_CODE;
}


type PaymentOrder = {
  servico_codigo: string;
  valor_cobrado: number | null;
  status: string;
  pagamento_intents: { status: string }[] | null;
};

export function isBoletimPaid(orders: PaymentOrder[]): boolean {
  return orders.some((order) =>
    isBoletimServiceCode(order.servico_codigo) &&
    order.status === "granted" &&
    Number(order.valor_cobrado) > 0 &&
    (order.pagamento_intents ?? []).some((intent) => intent.status === "settled")
  );
}

export async function checkBoletimAccess(
  supabase: SupabaseClient<Database>,
  scope: { escolaId: string; alunoId: string; matriculaId: string },
): Promise<{ granted: boolean; error: boolean }> {
  const { data, error } = await supabase
    .from("servico_pedidos")
    .select("servico_codigo, valor_cobrado, status, pagamento_intents(status)")
    .eq("escola_id", scope.escolaId)
    .eq("aluno_id", scope.alunoId)
    .eq("matricula_id", scope.matriculaId)
    .in("servico_codigo", [...BOLETIM_SERVICE_CODES])
    .eq("status", "granted")
    .gt("valor_cobrado", 0)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return { granted: false, error: true };
  return { granted: isBoletimPaid((data ?? []) as PaymentOrder[]), error: false };
}

/** Emissão institucional: apenas o serviço exacto, concedido e liquidado.
 * Não confundir declaração oficial de notas com boletim dinâmico.
 */
export async function checkSpecificDocumentPaid(
  supabase: SupabaseClient<Database>,
  scope: { escolaId: string; alunoId: string; matriculaId: string },
  serviceCode: typeof BOLETIM_SERVICE_CODE | typeof BOLETIM_LEGACY_SERVICE_CODE,
): Promise<{ granted: boolean; error: boolean }> {
  const { data, error } = await supabase
    .from("servico_pedidos")
    .select("servico_codigo, valor_cobrado, status, pagamento_intents(status)")
    .eq("escola_id", scope.escolaId)
    .eq("aluno_id", scope.alunoId)
    .eq("matricula_id", scope.matriculaId)
    .eq("servico_codigo", serviceCode)
    .eq("status", "granted")
    .gt("valor_cobrado", 0)
    .limit(30);
  if (error) return { granted: false, error: true };
  return { granted: isBoletimPaid((data ?? []) as PaymentOrder[]), error: false };
}
