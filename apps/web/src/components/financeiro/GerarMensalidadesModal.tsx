"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Calendar, CheckCircle, AlertCircle } from "lucide-react";

type Status = "idle" | "success" | "error";
type TurmaOption = { id: string; nome: string };

export function GerarMensalidadesModal({ escolaId }: { escolaId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [turmaId, setTurmaId] = useState<string>("todas");

  const today = new Date();
  const defaultMes = today.getMonth() + 2;
  const [ano, setAno] = useState(
    defaultMes > 12 ? today.getFullYear() + 1 : today.getFullYear()
  );
  const [mes, setMes] = useState(defaultMes > 12 ? 1 : defaultMes);

  async function loadTurmas() {
    try {
      const res = await fetch("/api/secretaria/turmas?status=ativo", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) return;
      const items = (json.items || []).map((t: any) => ({
        id: String(t.id),
        nome: String(t.nome ?? "Turma"),
      }));
      setTurmas(items);
    } catch {
      setTurmas([]);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadTurmas();
    }
  }, [isOpen]);

  async function handleGerar() {
    setLoading(true);
    setStatus("idle");
    setMsg("");

    try {
      const res = await fetch("/api/financeiro/mensalidades/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escolaId,
          ano,
          mes,
          diaVencimento: 10,
          turmaId: turmaId === "todas" ? null : turmaId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao gerar mensalidades");

      setStatus("success");
      setMsg(`Sucesso! ${data?.geradas ?? 0} mensalidades geradas/atualizadas.`);
      router.refresh();
      setTimeout(() => {
        setIsOpen(false);
        setStatus("idle");
      }, 2000);
    } catch (err: any) {
      setStatus("error");
      setMsg(err?.message || "Falha ao gerar mensalidades");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-klasse-gold-400 text-white hover:brightness-95 focus:ring-4 focus:ring-klasse-gold-400/20 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
      >
        <Calendar className="w-4 h-4" />
        Gerar Cobranças
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Gerar Mensalidades em Lote</h2>
        <p className="text-sm text-slate-500 mb-4">
          O sistema buscará alunos ativos e gerará a cobrança automaticamente (processo idempotente).
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Ano</label>
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-full border-slate-300 border rounded-xl p-2 text-sm focus:ring-4 focus:ring-klasse-gold-400/20 focus:border-klasse-gold-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
              Mês referência
            </label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="w-full border-slate-300 border rounded-xl p-2 text-sm bg-white focus:ring-4 focus:ring-klasse-gold-400/20 focus:border-klasse-gold-400"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(0, i).toLocaleString("pt-PT", { month: "long" })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
            Turma (opcional)
          </label>
          <select
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            onFocus={() => {
              if (turmas.length === 0) loadTurmas();
            }}
            className="w-full border-slate-300 border rounded-xl p-2 text-sm bg-white focus:ring-4 focus:ring-klasse-gold-400/20 focus:border-klasse-gold-400"
          >
            <option value="todas">Todas as turmas</option>
            {turmas.map((turma) => (
              <option key={turma.id} value={turma.id}>
                {turma.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Selecione uma turma para gerar apenas para esse grupo.
          </p>
        </div>

        {status === "success" && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {msg}
          </div>
        )}
        {status === "error" && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {msg}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            onClick={() => setIsOpen(false)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={handleGerar}
            disabled={loading || status === "success"}
            className="bg-klasse-gold-400 hover:brightness-95 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar geração"}
          </button>
        </div>
      </div>
    </div>
  );
}
