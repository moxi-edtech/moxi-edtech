"use client";

import { useEffect, useState } from "react";
import { ASSESSMENT_POLICIES, FINANCE_MODELS, SCHOOL_SECTORS, type AssessmentPolicyKey, type FinanceModel, type SchoolSector } from "@/lib/school-profile/types";

type Profile = {
  status?: string;
  school_sector: SchoolSector;
  regulatory_profile: string;
  finance_model: FinanceModel;
  assessment_policy: AssessmentPolicyKey;
  document_profile: string;
  effective_from: string;
};

const labels: Record<string, string> = {
  private: "Privada",
  public: "Pública",
  tuition: "Propinas / mensalidades",
  budget: "Orçamento",
  emoluments_only: "Emolumentos pontuais",
  mixed: "Misto",
  custom: "Custom atual",
  med_angola_pending: "MED Angola (pendente)",
  med_angola_primary_pending: "MED Angola primário (pendente)",
  med_angola_secondary_pending: "MED Angola secundário (pendente)",
};

export default function SchoolOperatingProfileSettings({ schoolId }: { schoolId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/super-admin/escolas/${schoolId}/operating-profile`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const current = payload?.profiles?.find((item: Profile) => item.status === "active") ?? payload?.profiles?.[0];
        if (current) setProfile(current);
      })
      .catch(() => active && setMessage("Não foi possível carregar o perfil institucional."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [schoolId]);

  async function save() {
    if (!profile || !reason.trim() || !confirm) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/super-admin/escolas/${schoolId}/operating-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolSector: profile.school_sector,
          regulatoryProfile: profile.regulatory_profile,
          financeModel: profile.finance_model,
          assessmentPolicy: profile.assessment_policy,
          documentProfile: profile.document_profile,
          effectiveFrom: profile.effective_from,
          reason,
          confirm: true,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Falha ao guardar perfil.");
      setReason("");
      setConfirm(false);
      setMessage("Perfil atualizado e auditado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao guardar perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">A carregar perfil institucional…</div>;
  if (!profile) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Perfil institucional indisponível.</div>;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Perfil institucional</h3>
        <p className="mt-1 text-xs text-gray-600">Área exclusiva do Super Admin. Alterações criam uma nova versão e ficam auditadas.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">Setor
          <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2" value={profile.school_sector} onChange={(event) => setProfile({ ...profile, school_sector: event.target.value as SchoolSector })}>
            {SCHOOL_SECTORS.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">Modelo financeiro
          <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2" value={profile.finance_model} onChange={(event) => setProfile({ ...profile, finance_model: event.target.value as FinanceModel })}>
            {FINANCE_MODELS.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">Perfil regulatório
          <input className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2" value={profile.regulatory_profile} onChange={(event) => setProfile({ ...profile, regulatory_profile: event.target.value })} />
        </label>
        <label className="text-sm font-medium text-gray-700">Política de avaliação
          <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2" value={profile.assessment_policy} onChange={(event) => setProfile({ ...profile, assessment_policy: event.target.value as AssessmentPolicyKey })}>
            {ASSESSMENT_POLICIES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">Perfil documental
          <input className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2" value={profile.document_profile} onChange={(event) => setProfile({ ...profile, document_profile: event.target.value })} />
        </label>
        <label className="text-sm font-medium text-gray-700">Data de vigência
          <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2" value={profile.effective_from} onChange={(event) => setProfile({ ...profile, effective_from: event.target.value })} />
        </label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="text-sm font-medium text-gray-700">Motivo obrigatório
          <textarea className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 bg-white p-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Descreva a autorização e o motivo da alteração" />
        </label>
        <div className="space-y-3">
          <label className="flex max-w-xs gap-2 text-xs text-gray-700"><input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} /> Confirmo a alteração institucional.</label>
          <button type="button" disabled={saving || !confirm || reason.trim().length < 3} onClick={() => void save()} className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "A guardar…" : "Guardar perfil"}</button>
        </div>
      </div>
      {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
    </section>
  );
}
