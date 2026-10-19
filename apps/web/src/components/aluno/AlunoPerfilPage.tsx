import { notFound } from "next/navigation";
import { AcoesRapidasBalcao } from "@/components/secretaria/AcoesRapidasBalcao";
import { RetificarMatriculaAction } from "@/components/aluno/RetificarMatriculaAction";
import { DossierHeader } from "@/components/aluno/DossierHeader";
import { DossierTabs } from "@/components/aluno/DossierTabs";
import {
  DossierDocumentosSection,
  DossierFinanceiroSection,
  DossierHistoricoSection,
  DossierHistoricoTransitadoSection,
  DossierPerfilSection,
} from "@/components/aluno/DossierSeccoes";
import { toMensalidadeAcoes } from "@/lib/aluno";
import { loadAlunoDossierData } from "@/lib/aluno/load-dossier-data";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { DossierRole } from "@/components/aluno/DossierAcoes";

export default async function AlunoPerfilPage({ escolaId, alunoId, role, selectedYear, embedded = false, workspace = false }: { escolaId?: string | null; alunoId: string; role: DossierRole; selectedYear?: number | null; embedded?: boolean; workspace?: boolean }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
  if (!resolvedEscolaId) return notFound();

  const loaded = await loadAlunoDossierData({
    supabase,
    escolaId: resolvedEscolaId,
    alunoId,
    selectedYear,
  });
  if (!loaded) return notFound();
  const { aluno, servicos } = loaded;
  const matriculaAtualId = aluno.matricula_atual?.matricula_id;
  const matriculaAtual = matriculaAtualId && role === "admin"
    ? await supabase.from("matriculas").select("turma_id, ano_letivo").eq("id", matriculaAtualId).eq("escola_id", resolvedEscolaId).eq("aluno_id", alunoId).maybeSingle()
    : null;
  const turmaAtualId = matriculaAtual?.data?.turma_id;
  const anoAtual = Number(String(matriculaAtual?.data?.ano_letivo ?? "").match(/20\d{2}/)?.[0]);
  const canEditHistoricoTransitado = role === "admin" || role === "secretaria";

  return (
    <div className={workspace ? "min-w-0" : embedded ? "bg-slate-50" : "min-h-screen bg-slate-50"}>
      <div className={workspace ? "min-w-0 space-y-4" : `max-w-6xl mx-auto space-y-5 ${embedded ? "p-4 sm:p-6" : "px-6 py-8"}`}>
        {!workspace && <DossierHeader aluno={aluno} role={role} escolaId={resolvedEscolaId} />}
        {role === "admin" && matriculaAtualId && turmaAtualId && Number.isFinite(anoAtual) && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-white px-5 py-4">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">Matrícula atual</p><p className="text-xs text-slate-500">Corrigir turma ou classe sem apagar o histórico académico e financeiro.</p></div>
            <RetificarMatriculaAction matriculaId={matriculaAtualId} turmaId={turmaAtualId} anoLetivo={anoAtual} />
          </div>
        )}
        <DossierTabs
          workspace={workspace}
          aluno={aluno}
          slotPerfil={<DossierPerfilSection aluno={aluno} />}
          slotFinanceiro={<DossierFinanceiroSection aluno={aluno} role={role} servicos={servicos} />}
          slotHistorico={<DossierHistoricoSection aluno={aluno} alunoId={alunoId} role={role} escolaId={resolvedEscolaId} />}
          slotHistoricoTransitado={<DossierHistoricoTransitadoSection alunoId={alunoId} canEdit={canEditHistoricoTransitado} />}
          slotDocumentos={<DossierDocumentosSection alunoId={alunoId} />}
        />
        {role === "secretaria" && !workspace && (
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
