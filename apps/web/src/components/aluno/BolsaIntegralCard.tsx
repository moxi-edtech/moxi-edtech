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
  isencao_outra_politica: boolean;
  motivo: string | null;
  vigencia_inicio: string | null;
  bolsa_ano_anterior: number | null;
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
  const [mesVigencia, setMesVigencia] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [avisoFiscal, setAvisoFiscal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const endpoint = `/api/secretaria/alunos/${alunoId}/bolsa?escola_id=${encodeURIComponent(escolaId)}${anoLetivo ? `&ano_letivo=${anoLetivo}` : ""}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setConfirmando(false);
    setAvisoFiscal(0);
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
    if (!confirmando) return;
    const next = !matricula.bolseiro;
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_id: matricula.id, bolseiro: next,
          motivo: next ? motivo.trim() || "Bolsa integral" : null,
          vigencia_inicio: mesVigencia ? `${mesVigencia}-01` : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao atualizar");
      const result = payload.bolsa;
      setMatricula((current) => current ? { ...current,
        bolseiro: next, bolsa_integral: next, motivo: next ? motivo : null,
        vigencia_inicio: next ? result.vigencia_inicio : null,
      } : null);
      setAvisoFiscal(Number(result.pendentes_revisao_fiscal ?? 0));
      setConfirmando(false);
      setMesVigencia("");
      success("Bolsa atualizada", next
        ? `Isenções: ${result.isentas ?? 0}. Saldos parciais quitados: ${result.quitadas_parciais ?? 0}.`
        : `Cobranças futuras reabertas: ${result.reabertas ?? 0}. Histórico preservado.`);
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
          <p className="text-xs text-muted-foreground">Isenção integral de propinas por matrícula e ano letivo.</p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground" role="status">A consultar a matrícula…</p>
      ) : failed ? (
        <p role="alert" className="text-sm text-destructive">Não foi possível consultar a bolsa. Atualize a página.</p>
      ) : !matricula ? (
        <p className="text-sm text-muted-foreground">Não existe matrícula neste ano letivo para atribuir uma bolsa.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="block text-sm font-medium text-foreground">
                {matricula.bolseiro ? "Bolseiro · Isento de propinas" : matricula.isencao_outra_politica ? "Isento por outra política" : "Sem bolsa integral"}
              </span>
              <span className="text-xs text-muted-foreground">
                Ano letivo {matricula.ano_letivo} · {matricula.status}
                {matricula.bolseiro && matricula.vigencia_inicio ? ` · Desde ${matricula.vigencia_inicio.slice(0,7)}` : ""}
              </span>
            </div>
            {!confirmando && <button type="button" onClick={() => setConfirmando(true)} disabled={saving || matricula.isencao_outra_politica}
              className={matricula.bolseiro
                ? "inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                : "inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"}
            >
              {matricula.bolseiro ? "Retirar bolsa" : "Marcar como bolseiro"}
            </button>}
          </div>
          {!matricula.bolseiro && matricula.bolsa_ano_anterior !== null && !matricula.isencao_outra_politica && (
            <p className="text-xs text-muted-foreground">
              Bolsa do ano {matricula.bolsa_ano_anterior}: a renovação não é automática. A escola deve confirmar a nova atribuição.
            </p>
          )}
          {matricula.isencao_outra_politica && (
            <p className="text-xs text-muted-foreground">Existe outra isenção de 100% nesta matrícula. Ajuste a política financeira existente antes de atribuir uma bolsa.</p>
          )}
          {confirmando && (
            <p className="text-xs text-muted-foreground">
              {matricula.bolseiro
                ? "A retirada vale desde o próximo mês, por padrão. Preserva os meses já isentos e os pagamentos."
                : "A atribuição vale desde o mês atual, por padrão. Meses anteriores continuam cobrados."}
            </p>
          )}
          {confirmando && !matricula.bolseiro && !matricula.isencao_outra_politica && (
            <div>
              <label htmlFor="bolsa-motivo" className="mb-1 block text-xs font-medium text-foreground">Motivo (opcional)</label>
              <input id="bolsa-motivo" value={motivo} maxLength={160}
                onChange={(event) => setMotivo(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              />
            </div>
          )}
          {confirmando && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <label htmlFor="bolsa-vigencia" className="block text-xs font-medium text-foreground">
                Mês de vigência (opcional)
              </label>
              <input id="bolsa-vigencia" type="month" value={mesVigencia}
                onChange={(event) => setMesVigencia(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20" />
              <p className="text-xs text-muted-foreground">Sem escolha: este mês para atribuição, próximo mês para retirada. Não permite retroativos.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={toggleBolsa} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {saving ? "A guardar…" : matricula.bolseiro ? "Confirmar retirada" : "Confirmar bolsa"}
                </button>
                <button type="button" disabled={saving} onClick={() => { setConfirmando(false); setMesVigencia(""); }}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground disabled:opacity-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {avisoFiscal > 0 && (
            <p role="alert" className="text-sm text-foreground">
              {avisoFiscal} cobrança(s) fiscalizada(s) requerem reconciliação financeira. Nenhum pagamento foi modificado.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Regra por matrícula e ano letivo, com auditoria. Recibos e pagamentos emitidos permanecem intactos.
          </p>
        </div>
      )}
    </section>
  );
}
