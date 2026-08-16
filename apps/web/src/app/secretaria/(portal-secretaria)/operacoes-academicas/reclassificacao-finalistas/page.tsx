import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { buildPortalHref } from "@/lib/navigation";
import type { Database } from "~types/supabase";
import { ReclassificacaoFinalistasClient } from "@/components/secretaria/virada-ano/ReclassificacaoFinalistasClient";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export default async function ReclassificacaoFinalistasPage({
  params,
}: {
  params?: Promise<{ id: string }>;
}) {
  const resolvedParams = params ? await params : null;
  const s = await supabaseServerTyped<Database>();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  let escolaId: string | null = null;
  let escolaSlug: string | null = resolvedParams?.id ?? null;

  if (user) {
    escolaId = await resolveEscolaIdForUser(s, user.id, resolvedParams?.id ?? null);
  }

  if (!escolaId && resolvedParams?.id) {
    const resolved = await resolveEscolaParam(s, resolvedParams.id);
    escolaId = resolved.escolaId;
    if (resolved.slug) escolaSlug = resolved.slug;
  }

  if (escolaId && !escolaSlug) {
    const resolved = await resolveEscolaParam(s, escolaId);
    escolaSlug = resolved.slug ?? escolaId;
  }

  const escolaParam = escolaSlug || escolaId;

  if (!escolaId) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          Escola não identificada para este utilizador.
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <AuditPageView
        portal="secretaria"
        acao="PAGE_VIEW"
        entity="reclassificacao_finalistas"
        entityId={null}
        escolaId={escolaId}
      />

      <DashboardHeader
        title="Reclassificação de Finalistas"
        description="Gerencie e reclassifique alunos que concluíram ciclos (Primário ou I Ciclo) para novos destinos académicos."
        breadcrumbs={[
          { label: "Início", href: buildPortalHref(escolaParam, "/") },
          { label: "Secretaria", href: buildPortalHref(escolaParam, "/secretaria") },
          { label: "Operações Académicas", href: buildPortalHref(escolaParam, "/secretaria/operacoes-academicas") },
          { label: "Finalistas" },
        ]}
      />

      <ReclassificacaoFinalistasClient />
    </main>
  );
}
