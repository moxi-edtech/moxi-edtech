"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, DollarSign, FileCheck, FileText, KeyRound, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { AlunoNormalizado } from "@/lib/aluno/types";
import { useEscolaId } from "@/hooks/useEscolaId";
import { useToast } from "@/components/feedback/FeedbackSystem";

export type DossierRole = "admin" | "secretaria";

export function DossierAcoes({ role, aluno, escolaId }: { role: DossierRole; aluno: AlunoNormalizado; escolaId: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ login: string; senha: string } | null>(null);
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  async function run(url: string, body?: unknown) {
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha na operação.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSenha() {
    setLoading(true);
    setResetResult(null);
    try {
      const res = await fetch(`/api/secretaria/alunos/${aluno.id}/reset-senha`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao resetar senha.");
      if (json.login && json.senha) {
        setResetResult({ login: json.login, senha: json.senha });
        success("Senha redefinida", "Uma nova senha temporária foi gerada com sucesso.");
      }
    } catch (err: any) {
      error("Erro na redefinição", "Não conseguimos gerar uma nova senha no momento. Por favor, tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (role === "admin") {
    const isArquivado = aluno.perfil.status === "arquivado";
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/escola/${escolaParam}/admin/alunos/${aluno.id}/editar`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-[#1F6B3B] hover:text-[#1F6B3B]"><Pencil size={14} className="inline mr-1" />Editar</Link>
        {!isArquivado ? (
          <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/delete`, { reason: "Arquivado via Admin" })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-[#E3B23C]/40 hover:text-[#E3B23C]"><Archive size={14} className="inline mr-1" />Arquivar</button>
        ) : (
          <>
            <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/restore`)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-[#1F6B3B] hover:text-[#1F6B3B]"><RotateCcw size={14} className="inline mr-1" />Restaurar</button>
            <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/hard-delete`)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-rose-200 hover:text-rose-700"><Trash2 size={14} className="inline mr-1" />Eliminar</button>
          </>
        )}
        <button
          disabled={loading}
          onClick={handleResetSenha}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-[#1F6B3B] hover:text-[#1F6B3B]"
        >
          <KeyRound size={14} className="inline mr-1" />Resetar senha
        </button>
        </div>
        {resetResult && (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <div><span className="font-semibold">Login:</span> {resetResult.login}</div>
            <div><span className="font-semibold">Senha temporária:</span> {resetResult.senha}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
      <Link
        href={`/secretaria/alunos/${aluno.id}/pagamento`}
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
          aluno.financeiro.situacao === "inadimplente"
            ? "bg-[#E3B23C] hover:brightness-95"
            : "bg-[#1F6B3B] hover:bg-[#185830]"
        }`}
      >
        <DollarSign size={14} className="inline mr-1" />Registar pagamento
      </Link>
      <Link
        href={`/secretaria/alunos/${aluno.id}/editar`}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Pencil size={14} className="inline mr-1" />Editar
      </Link>
      <Link
        href={`/secretaria/alunos/${aluno.id}/documentos`}
        className="px-2 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <FileText size={14} className="inline mr-1" />Documentos
      </Link>
      {!aluno.matricula_atual?.is_atual && (
        <Link
          href={`/secretaria/admissoes/nova?alunoId=${aluno.id}`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FileCheck size={14} className="inline mr-1" />Matricular
        </Link>
      )}
      <button
        disabled={loading}
        onClick={handleResetSenha}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <KeyRound size={14} className="inline mr-1" />Resetar senha
      </button>
      </div>
      {resetResult && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <div><span className="font-semibold">Login:</span> {resetResult.login}</div>
          <div><span className="font-semibold">Senha temporária:</span> {resetResult.senha}</div>
        </div>
      )}
    </div>
  );
}
