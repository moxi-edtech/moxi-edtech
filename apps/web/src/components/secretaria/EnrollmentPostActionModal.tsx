"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, GraduationCap, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EnrollmentPostAction } from "./EnrollmentPostActions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: EnrollmentPostAction | null;
  escolaId: string;
  alunoId: string;
  alunoNome: string;
  turmaId?: string | null;
  onPayment: () => void;
};

export function EnrollmentPostActionModal({
  open, onOpenChange, action, escolaId, alunoId, alunoNome, turmaId, onPayment,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ login?: string | null; senha?: string | null; error?: string } | null>(null);
  const [disciplinas, setDisciplinas] = useState<Array<{ id: string; disciplina?: { id?: string; nome?: string } | null }>>([]);
  const [disciplinaId, setDisciplinaId] = useState("");
  const [turmaDisciplinaId, setTurmaDisciplinaId] = useState("");
  const [periodo, setPeriodo] = useState("1");
  const [nota, setNota] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setShowPassword(false);
      setCopied(false);
    }
  }, [open, action]);

  const title = action === "portal" ? "Liberar portal" : action === "notas" ? "Lançar nota" : "Pagar mensalidade";
  const Icon = action === "portal" ? KeyRound : action === "notas" ? GraduationCap : Wallet;

  useEffect(() => {
    if (!open || action !== "notas" || !turmaId) return;
    setDisciplinas([]);
    setDisciplinaId("");
    fetch(`/api/secretaria/turmas/${encodeURIComponent(turmaId)}/disciplinas`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => setDisciplinas(Array.isArray(json?.items) ? json.items : []))
      .catch(() => setDisciplinas([]));
  }, [open, action, turmaId]);

  const lancarNota = async () => {
    const selected = disciplinas.find((item) => item.disciplina?.id === disciplinaId);
    if (!turmaId || !selected?.disciplina?.id || !selected.id || !nota) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/secretaria/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          turma_id: turmaId,
          disciplina_id: selected.disciplina.id,
          turma_disciplina_id: selected.id,
          trimestre: Number(periodo),
          notas: [{ aluno_id: alunoId, valor: Number(nota) }],
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível lançar a nota.");
      setResult({ login: "Nota lançada", senha: null });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Não foi possível lançar a nota." });
    } finally {
      setLoading(false);
    }
  };

  const liberarPortal = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/secretaria/alunos/liberar-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escolaId, alunoIds: [alunoId], canal: "whatsapp", gerarCredenciais: true }),
      });
      const json = await response.json().catch(() => ({}));
      const detail = Array.isArray(json?.detalhes) ? json.detalhes[0] : null;
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível liberar o portal.");
      setResult({ login: detail?.login ?? null, senha: detail?.senha ?? null });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Não foi possível liberar o portal." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900"><Icon className="h-5 w-5 text-[#1F6B3B]" />{title}</DialogTitle>
          <DialogDescription>{alunoNome} · atendimento continua nesta ficha.</DialogDescription>
        </DialogHeader>

        {action === "portal" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Gere as credenciais agora e entregue-as ao encarregado.</p>
            {result?.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{result.error}</p>}
            {result?.login ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Portal liberado</div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div><span className="block text-xs text-emerald-700/70">Login</span><strong>{result.login}</strong></div>
                  <div><span className="block text-xs text-emerald-700/70">Senha temporária</span><strong>{result.senha ? (showPassword ? result.senha : "••••••••") : "Enviada por canal configurado"}</strong></div>
                </div>
                {result.senha && <div className="mt-3 flex gap-2"><button type="button" onClick={() => setShowPassword((value) => !value)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">{showPassword ? "Ocultar senha" : "Mostrar senha"}</button><button type="button" onClick={() => { void navigator.clipboard.writeText(`Login: ${result.login}\nSenha: ${result.senha}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">{copied ? "Copiado" : "Copiar credenciais"}</button></div>}
              </div>
            ) : (
              <button type="button" onClick={() => void liberarPortal()} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} {loading ? "A gerar credenciais…" : "Liberar portal agora"}
              </button>
            )}
          </div>
        )}

        {action === "notas" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Lance a nota de {alunoNome} sem sair do atendimento.</p>
            {!turmaId && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">A turma desta matrícula não foi identificada.</p>}
            <select value={disciplinaId} onChange={(event) => { setDisciplinaId(event.target.value); setTurmaDisciplinaId(disciplinas.find((item) => item.disciplina?.id === event.target.value)?.id ?? ""); }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={!turmaId || loading}>
              <option value="">Selecionar disciplina</option>
              {disciplinas.map((item) => <option key={item.id} value={item.disciplina?.id ?? ""}>{item.disciplina?.nome ?? "Disciplina"}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <select value={periodo} onChange={(event) => setPeriodo(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={loading}><option value="1">1.º período</option><option value="2">2.º período</option><option value="3">3.º período</option></select>
              <input type="number" min="0" max="100" step="0.01" value={nota} onChange={(event) => setNota(event.target.value)} placeholder="Nota" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={loading} />
            </div>
            {result?.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{result.error}</p>}
            {result?.login === "Nota lançada" ? <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Nota lançada com sucesso.</p> : <button type="button" onClick={() => void lancarNota()} disabled={loading || !turmaId || !disciplinaId || !turmaDisciplinaId || !nota} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Lançar nota</button>}
          </div>
        )}

        {action === "mensalidade" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">O pagamento será aberto mantendo o aluno e o atendimento em contexto.</p>
            <button type="button" onClick={onPayment} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E3B23C] px-4 py-3 text-sm font-bold text-slate-950">Adicionar ao pagamento do balcão</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
