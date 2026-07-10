"use client";

import { useParams, usePathname } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import ExcecoesPautaPanel from "@/components/escola/settings/ExcecoesPautaPanel";
import { buildConfigMenuItems } from "../_shared/menuItems";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildContextualPortalHref } from "@/lib/navigation";

export default function ExcecoesConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const pathname = usePathname();
  const base = buildContextualPortalHref(escolaParam, "/admin/configuracoes", pathname);

  return (
    <ConfigSystemShell
      escolaId={escolaParam ?? ""}
      title="Exceções"
      subtitle="Defina exceções de pauta e regras específicas por disciplina/turma."
      menuItems={buildConfigMenuItems(base)}
      showInternalMenu={false}
      embedded
      backHref={base}
      prevHref={`${base}/fluxos`}
      nextHref={`${base}/avancado`}
    >
      <ExcecoesPautaPanel escolaId={escolaParam ?? ""} />
    </ConfigSystemShell>
  );
}
