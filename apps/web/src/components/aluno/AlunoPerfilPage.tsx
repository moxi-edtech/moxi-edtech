import { notFound } from "next/navigation";
import { canCorrigirNomeAluno } from "@/lib/aluno/nome-permissions";
import { AcoesRapidasBalcao } from "@/components/secretaria/AcoesRapidasBalcao";
import { CurrentYearEnrollmentPanel } from "@/components/aluno/CurrentYearEnrollmentPanel";
import { canConfirmarDesistencia } from "@/lib/matriculas/desistencia-permissions";
import { DossierHeader } from "@/components/aluno/DossierHeader";
import { BolsaIntegralCard } from "@/components/aluno/BolsaIntegralCard";
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
  const canEditHistoricoTransitado = role === "admin" || role === "secretaria";
  const { data: member } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", resolvedEscolaId)
    .eq("user_id", user.id)
    .maybeSingle();
  const canEditNome = canCorrigirNomeAluno(member?.papel) && aluno.perfil.escola_id === resolvedEscolaId;
  const canManageDesistencia = canConfirmarDesistencia(member?.papel)
    && aluno.perfil.escola_id === resolvedEscolaId;
  const canManageBolsa = ["admin", "admin_escola", "admin_financeiro", "admin_secretaria",
    "admin_secretario", "secretaria", "financeiro", "diretor", "staff_admin"]
    .includes(member?.papel ?? "") && aluno.perfil.escola_id === resolvedEscolaId;

  return (
    <div className={workspace ? "min-w-0" : embedded ? "bg-muted" : "min-h-screen bg-muted"}>
      <div className={workspace ? "min-w-0 space-y-4" : `max-w-6xl mx-auto space-y-5 ${embedded ? "p-4 sm:p-6" : "px-6 py-8"}`}>
        {!workspace && <DossierHeader aluno={aluno} role={role} escolaId={resolvedEscolaId} />}
        <DossierTabs
          workspace={workspace}
          aluno={aluno}
          slotPerfil={(
            <div className="space-y-5">
              <DossierPerfilSection aluno={aluno} canEditNome={canEditNome} />
              {canManageBolsa && <BolsaIntegralCard alunoId={alunoId} escolaId={resolvedEscolaId}
                anoLetivo={selectedYear ?? undefined} />}
              <CurrentYearEnrollmentPanel alunoId={alunoId} escolaId={resolvedEscolaId}
                alunoNome={aluno.perfil.nome} canManageDesistencia={canManageDesistencia} />
            </div>
          )}
          slotMatricula={<CurrentYearEnrollmentPanel alunoId={alunoId} escolaId={resolvedEscolaId}
            alunoNome={aluno.perfil.nome} canManageDesistencia={canManageDesistencia} />}
          slotFinanceiro={<DossierFinanceiroSection aluno={aluno} role={role} escolaId={resolvedEscolaId} servicos={servicos} />}
          slotHistorico={<DossierHistoricoSection aluno={aluno} alunoId={alunoId} role={role} escolaId={resolvedEscolaId} />}
          slotHistoricoTransitado={<DossierHistoricoTransitadoSection alunoId={alunoId} canEdit={canEditHistoricoTransitado} />}
          slotDocumentos={<DossierDocumentosSection alunoId={alunoId} />}
        />
        {role === "secretaria" && !workspace && (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
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
