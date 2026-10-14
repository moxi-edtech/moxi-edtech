import Link from "next/link";
import AuditPageView from "@/components/audit/AuditPageView";
import DocumentosEmissaoHubClient from "@/components/secretaria/DocumentosEmissaoHubClient";
import DocumentosAprovacoesQueue from "@/components/secretaria/DocumentosAprovacoesQueue";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null;

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          Vincule seu perfil a uma escola para emitir documentos.
        </div>
      </>
    );
  }

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
      <div className="p-4 md:p-6">
        <DashboardHeader
          title="Documentos"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Secretaria", href: "/secretaria" },
            { label: "Documentos" },
          ]}
        />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-bold text-slate-900">Boletim de notas: pagamento e liberação</p>
            <p className="mt-1 text-xs text-slate-600">Os comprovativos pagos são confirmados em Recebimentos, não na fila de documentos gratuitos. Confira o valor antes de validar.</p>
            <p className="mt-1 text-xs text-slate-500">Se a taxa não aparecer para o aluno, a direção deve defini-la em Administração → Configurações → Emolumentos &amp; Serviços.</p>
          </div>
          <Link href="/secretaria/recebimentos" className="inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">Validar comprovativos</Link>
        </div>
        <DocumentosAprovacoesQueue />
        <DocumentosEmissaoHubClient escolaId={escolaId} />
      </div>
    </>
  );
}
