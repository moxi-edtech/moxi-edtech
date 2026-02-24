import { notFound } from "next/navigation";
import { AcoesRapidasBalcao } from "@/components/secretaria/AcoesRapidasBalcao";
import { DossierHeader } from "@/components/aluno/DossierHeader";
import { DossierTabs } from "@/components/aluno/DossierTabs";
import { DossierFinanceiroSection, DossierHistoricoSection, DossierPerfilSection } from "@/components/aluno/DossierSeccoes";
import { normalizeDossier, toMensalidadeAcoes } from "@/lib/aluno";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { DossierRole } from "@/components/aluno/DossierAcoes";

export default async function AlunoPerfilPage({ escolaId, alunoId, role }: { escolaId?: string | null; alunoId: string; role: DossierRole }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const resolvedEscolaId = escolaId ?? (await resolveEscolaIdForUser(supabase, user.id));
  if (!resolvedEscolaId) return notFound();

  const { data: raw, error } = await supabase.rpc("get_aluno_dossier", {
    p_escola_id: resolvedEscolaId,
    p_aluno_id: alunoId,
  });
  if (error) return notFound();

  const aluno = normalizeDossier(alunoId, raw);
  if (!aluno) return notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        <DossierHeader aluno={aluno} role={role} escolaId={resolvedEscolaId} />
        <DossierTabs
          aluno={aluno}
          slotPerfil={<DossierPerfilSection aluno={aluno} />}
          slotFinanceiro={<DossierFinanceiroSection aluno={aluno} />}
          slotHistorico={<DossierHistoricoSection aluno={aluno} />}
          slotDocumentos={<div className="text-sm text-slate-500">Documentos disponíveis no balcão.</div>}
        />
        {role === "secretaria" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Balcão Rápido</h2>
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
