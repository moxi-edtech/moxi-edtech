"use client";

import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import ExcecoesPautaPanel from "@/components/escola/settings/ExcecoesPautaPanel";
import { buildConfigMenuItems } from "../_shared/menuItems";
import { useEscolaId } from "@/hooks/useEscolaId";

export default function ExcecoesConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const base = escolaParam ? `/escola/${escolaParam}/admin/configuracoes` : "";

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
