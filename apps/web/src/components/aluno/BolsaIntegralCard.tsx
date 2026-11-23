"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";

type MatriculaBolsa = {
  id: string;
  ano_letivo: number;
  status: string;
  bolseiro: boolean;
  bolsa_integral: boolean;
  motivo: string | null;
};

export function BolsaIntegralCard({ alunoId, escolaId, anoLetivo }: {
  alunoId: string;
  escolaId: string;
  anoLetivo?: number | null;
}) {
  const router = useRouter();
  const { success, error: notifyError } = useToast();
  const [matricula, setMatricula] = useState<MatriculaBolsa | null>(null);
  const [motivo, setMotivo] = useState("Bolsa integral");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const endpoint = `/api/secretaria/alunos/${alunoId}/bolsa?escola_id=${encodeURIComponent(escolaId)}${anoLetivo ? `&ano_letivo=${anoLetivo}` : ""}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Erro de consulta");
        return payload;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setMatricula(payload.matricula);
        setMotivo(payload.matricula?.motivo || "Bolsa integral");
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint]);

  async function toggleBolsa() {
    if (!matricula || saving) return;
    const next = !matricula.bolseiro;
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula_id: matricula.id, bolseiro: next, motivo: next ? motivo.trim() || "Bolsa integral" : null }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao atualizar");
      setMatricula((current) => current ? { ...current, bolseiro: next, bolsa_integral: next, motivo: next ? motivo : null } : null);
      success("Bolsa atualizada", next
        ? "Cobranças abertas sem pagamento foram isentadas; novas propinas ficam bloqueadas para esta matrícula."
        : "A bolsa foi retirada. Cobranças já isentadas e pagamentos históricos foram preservados.");
      router.refresh();
    } catch (e) {
      notifyError("Erro ao atualizar bolsa", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <GraduationCap className="h-5 w-5 text-klasse-green" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-klasse-green">Bolsa de estudo</h3>
          <p className="text-xs text-muted-foreground">Isenção integral de propinas por ano letivo.</p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground" role="status">A consultar a matrícula…</p>
      ) : failed ? (
        <p role="alert" className="text-sm text-red-600">Não foi possível consultar a bolsa. Atualize a página.</p>
      ) : !matricula ? (
        <p className="text-sm text-muted-foreground">Não existe matrícula neste ano letivo para atribuir uma bolsa.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="block text-sm font-medium text-foreground">
                {matricula.bolseiro ? "Bolseiro · Isento de propinas" : "Sem bolsa integral"}
              </span>
              <span className="text-xs text-muted-foreground">Ano letivo {matricula.ano_letivo} · {matricula.status}</span>
            </div>
            <button type="button" onClick={toggleBolsa} disabled={saving}
              className={matricula.bolseiro
                ? "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                : "inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? "A guardar…" : matricula.bolseiro ? "Retirar bolsa" : "Marcar como bolseiro"}
            </button>
          </div>
          {!matricula.bolseiro && (
            <div>
              <label htmlFor="bolsa-motivo" className="mb-1 block text-xs font-medium text-foreground">Motivo (opcional)</label>
              <input id="bolsa-motivo" value={motivo} maxLength={160}
                onChange={(event) => setMotivo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Abrange a matrícula selecionada. Cobranças não pagas são isentadas;
            recibos e pagamentos anteriores não são alterados.
          </p>
        </div>
      )}
    </section>
  );
}
