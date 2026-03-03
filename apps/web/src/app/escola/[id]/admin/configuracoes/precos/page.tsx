"use client";

import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import PrecosClient from "@/app/escola/[id]/financeiro/configuracoes/precos/PrecosClient";

export default function PrecosMensalidadesConfigPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";

  if (!escolaId) return null;

  return (
    <ConfigSystemShell
      escolaId={escolaId}
      title="Preços de Mensalidades"
      subtitle="Defina as regras de cobrança e valores por curso/classe."
      menuItems={buildConfigMenuItems(base)}
      backHref={`/escola/${escolaId}/admin`}
    >
      <PrecosClient escolaId={escolaId} embedded />
    </ConfigSystemShell>
  );
}
