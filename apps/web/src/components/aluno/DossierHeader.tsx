"use client";

import Link from "next/link";
import { BookOpen, CalendarCheck, Users } from "lucide-react";
import { DossierAcoes, type DossierRole } from "@/components/aluno/DossierAcoes";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate, initials } from "@/lib/formatters";
import type { AlunoNormalizado } from "@/lib/aluno/types";

export function DossierHeader({ aluno, role, escolaId }: { aluno: AlunoNormalizado; role: DossierRole; escolaId: string }) {
  const { perfil, matricula_atual } = aluno;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 md:px-8 md:py-6 space-y-4">
        <nav className="text-xs text-slate-400">
          {role === "admin" ? <Link href={`/escola/${escolaId}/admin/alunos`}>Admin / Alunos</Link> : <Link href="/secretaria/alunos">Secretaria / Alunos</Link>} / <span className="text-slate-700">{perfil.nome}</span>
        </nav>
        <div className="flex flex-col md:flex-row gap-5">
          <div className="h-16 w-16 rounded-xl border border-slate-200 bg-[#1F6B3B]/10 overflow-hidden flex items-center justify-center">
            {perfil.foto_url ? <img src={perfil.foto_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xl font-black text-[#1F6B3B]">{initials(perfil.nome)}</span>}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-[#1F6B3B]">{perfil.nome}</h1>
              <StatusPill status={perfil.status} variant="matricula" />
              <StatusPill status={aluno.financeiro.situacao} variant="financeiro" size="xs" />
            </div>
            <div className="flex flex-wrap gap-5 text-xs text-slate-600">
              <span><BookOpen size={13} className="inline mr-1" />Proc: <b>{perfil.numero_processo ?? "—"}</b></span>
              <span><Users size={13} className="inline mr-1" />BI: <b>{perfil.bi_numero ?? "—"}</b></span>
              <span><CalendarCheck size={13} className="inline mr-1" />Nasc: <b>{formatDate(perfil.data_nascimento)}</b></span>
              {matricula_atual && <span><BookOpen size={13} className="inline mr-1" />Turma: <b>{matricula_atual.turma_codigo ?? matricula_atual.turma}</b></span>}
            </div>
          </div>
          <DossierAcoes role={role} aluno={aluno} escolaId={escolaId} />
        </div>
      </div>
    </div>
  );
}
