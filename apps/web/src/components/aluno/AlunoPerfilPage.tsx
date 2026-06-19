import { notFound } from "next/navigation";
import { AcoesRapidasBalcao } from "@/components/secretaria/AcoesRapidasBalcao";
import { DossierHeader } from "@/components/aluno/DossierHeader";
import { DossierTabs } from "@/components/aluno/DossierTabs";
import {
  DossierDocumentosSection,
  DossierFinanceiroSection,
  DossierHistoricoSection,
  DossierHistoricoTransitadoSection,
  DossierPerfilSection,
} from "@/components/aluno/DossierSeccoes";
import { normalizeDossier, toMensalidadeAcoes } from "@/lib/aluno";
import type { RawDossier, RawDossierMensalidade } from "@/lib/aluno/types";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { DossierRole } from "@/components/aluno/DossierAcoes";

export default async function AlunoPerfilPage({ escolaId, alunoId, role }: { escolaId?: string | null; alunoId: string; role: DossierRole }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
  if (!resolvedEscolaId) return notFound();

  const { data: raw, error } = await supabase.rpc("get_aluno_dossier", {
    p_escola_id: resolvedEscolaId,
    p_aluno_id: alunoId,
  });
  if (error) return notFound();

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

  const aluno = normalizeDossier(alunoId, enrichedRaw);
  if (!aluno) return notFound();
  const canEditHistoricoTransitado = role === "admin" || role === "secretaria";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        <DossierHeader aluno={aluno} role={role} escolaId={resolvedEscolaId} />
        <DossierTabs
          aluno={aluno}
          slotPerfil={<DossierPerfilSection aluno={aluno} />}
          slotFinanceiro={<DossierFinanceiroSection aluno={aluno} role={role} />}
          slotHistorico={<DossierHistoricoSection aluno={aluno} alunoId={alunoId} role={role} escolaId={resolvedEscolaId} />}
          slotHistoricoTransitado={<DossierHistoricoTransitadoSection alunoId={alunoId} canEdit={canEditHistoricoTransitado} />}
          slotDocumentos={<DossierDocumentosSection alunoId={alunoId} />}
        />
        {role === "secretaria" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <AcoesRapidasBalcao
              alunoId={alunoId}
              alunoNome={aluno.perfil.nome}
              alunoTurma={aluno.matricula_atual?.turma ?? null}
              alunoBI={aluno.perfil.bi_numero}
              mensalidades={aluno.financeiro.mensalidades.map(toMensalidadeAcoes)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
