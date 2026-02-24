"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import { useToast } from "@/components/feedback/FeedbackSystem";

export default function AvancadoConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  const menuItems = buildConfigMenuItems(base);
  const { success, error } = useToast();

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ changes: { avancado: true } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        error(json?.error || "Erro ao aplicar configurações avançadas.");
        return;
      }
      success("Configurações avançadas atualizadas.");
    } catch (err) {
      error("Erro ao aplicar configurações avançadas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Avançado · Governança e Auditoria"
      subtitle="Ajustes críticos e políticas de segurança."
      menuItems={menuItems}
      embedded
      backHref={`${base}?tab=avancado`}
      prevHref={`${base}/fluxos`}
      nextHref={`${base}/sandbox`}
      testHref={`${base}/sandbox`}
      onSave={handleSave}
      saveDisabled={saving}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          Logs imutáveis, permissões e políticas RLS são configuradas aqui.
        </div>
      </div>
    </ConfigSystemShell>
  );
}
