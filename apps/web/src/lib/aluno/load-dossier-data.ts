import type { supabaseServer } from "@/lib/supabaseServer";
import { normalizeDossier } from "@/lib/aluno/normalize";
import type { RawDossier, RawDossierMensalidade } from "@/lib/aluno/types";
import { extractServicosFromPagamentos, extractServicosFromPedidos } from "@/lib/financeiro/servicosPagamento";

/**
 * Same authoritative dossier pipeline for the full student route and
 * Command Center's inline profile. No edit-only model or separate
 * student-finance implementation.
 */
export async function loadAlunoDossierData({
  supabase,
  escolaId: resolvedEscolaId,
  alunoId,
  selectedYear,
}: {
  supabase: Awaited<ReturnType<typeof supabaseServer>>;
  escolaId: string;
  alunoId: string;
  selectedYear?: number | null;
}) {
  const { data: raw, error } = await (supabase as any).rpc(selectedYear != null ? "get_aluno_dossier_contextual" : "get_aluno_dossier", {
    p_escola_id: resolvedEscolaId,
    p_aluno_id: alunoId,
    ...(selectedYear != null ? { p_ano_letivo: selectedYear } : {}),
  });
  if (error) return null;

  const dossier = raw as RawDossier | null;
  let enrichedRaw: RawDossier | unknown = raw;
  const rawMensalidades = Array.isArray(dossier?.financeiro?.mensalidades)
    ? (dossier?.financeiro?.mensalidades as RawDossierMensalidade[])
    : [];
  const mensalidadeIds = rawMensalidades
    .map((item) => (typeof item?.id === "string" ? item.id : null))
    .filter((item): item is string => Boolean(item));

  if (mensalidadeIds.length > 0) {
    const [{ data: recibos }, { data: pagamentos }] = await Promise.all([
      supabase
        .from("documentos_emitidos")
        .select("id, mensalidade_id, created_at")
        .eq("escola_id", resolvedEscolaId)
        .eq("tipo", "recibo")
        .in("mensalidade_id", mensalidadeIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("pagamentos")
        .select("id, mensalidade_id, status, created_at")
        .eq("escola_id", resolvedEscolaId)
        .in("mensalidade_id", mensalidadeIds)
        .in("status", ["settled", "concluido", "pago"])
        .order("created_at", { ascending: false }),
    ]);

    const reciboByMensalidadeId = new Map<string, string>();
    for (const recibo of recibos ?? []) {
      const mensalidadeId =
        typeof recibo.mensalidade_id === "string" ? recibo.mensalidade_id : null;
      if (mensalidadeId && !reciboByMensalidadeId.has(mensalidadeId)) {
        reciboByMensalidadeId.set(mensalidadeId, recibo.id);
      }
    }

    const pagamentoByMensalidadeId = new Map<string, string>();
    for (const pagamento of pagamentos ?? []) {
      const mensalidadeId =
        typeof pagamento.mensalidade_id === "string" ? pagamento.mensalidade_id : null;
      if (mensalidadeId && !pagamentoByMensalidadeId.has(mensalidadeId)) {
        pagamentoByMensalidadeId.set(mensalidadeId, pagamento.id);
      }
    }

    enrichedRaw = {
      ...(dossier as RawDossier),
      financeiro: {
        ...(dossier?.financeiro ?? {}),
        mensalidades: rawMensalidades.map((mensalidade) => {
          const mensalidadeId = typeof mensalidade?.id === "string" ? mensalidade.id : null;
          return {
            ...mensalidade,
            recibo_id: mensalidadeId ? reciboByMensalidadeId.get(mensalidadeId) ?? null : null,
            pagamento_reversivel_id: mensalidadeId ? pagamentoByMensalidadeId.get(mensalidadeId) ?? null : null,
          };
        }),
      },
    };
  }

  const aluno = normalizeDossier(alunoId, enrichedRaw, selectedYear);
  if (!aluno) return null;
  const { data: pagamentosServicos } = await supabase
    .from("pagamentos")
    .select("id, status, created_at, meta")
    .eq("escola_id", resolvedEscolaId)
    .eq("aluno_id", alunoId)
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: pedidosServicos } = await supabase
    .from("servico_pedidos")
    .select("id, status, servico_codigo, servico_nome, valor_cobrado, created_at")
    .eq("escola_id", resolvedEscolaId)
    .eq("aluno_id", alunoId)
    .order("created_at", { ascending: false })
    .limit(100);
  const servicosPagamentos = extractServicosFromPagamentos(pagamentosServicos ?? []);
  const codigosRegistados = new Set(servicosPagamentos.map((servico) => servico.servico_codigo).filter(Boolean));
  const servicos = [
    ...servicosPagamentos,
    ...extractServicosFromPedidos(pedidosServicos ?? []).filter((servico) => !servico.servico_codigo || !codigosRegistados.has(servico.servico_codigo)),
  ];
  return { aluno, servicos };
}
