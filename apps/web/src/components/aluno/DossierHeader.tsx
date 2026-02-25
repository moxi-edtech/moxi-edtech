"use client";

import Link from "next/link";
import { BookOpen, CalendarCheck, Users, ChevronRight } from "lucide-react";
import { DossierAcoes, type DossierRole } from "@/components/aluno/DossierAcoes";
import { formatDate, initials } from "@/lib/formatters";
import type { AlunoNormalizado } from "@/lib/aluno/types";

export function DossierHeader({
  aluno,
  role,
  escolaId,
}: {
  aluno: AlunoNormalizado;
  role: DossierRole;
  escolaId: string;
}) {
  const { perfil, matricula_atual } = aluno;

  const status = (perfil.status ?? "pendente").toLowerCase();
  const statusLabel = status.replace(/_/g, " ");
  const statusClasses =
    status === "ativo"
      ? "bg-[#1F6B3B]/10 text-[#1F6B3B]"
      : status === "arquivado" || status === "inativo"
      ? "bg-slate-100 text-slate-500"
      : "bg-[#E3B23C]/10 text-[#9a7010]";

  const isInadimplente = ["inadimplente", "em_atraso", "atrasado"].includes(
    (aluno.financeiro.situacao ?? "").toLowerCase()
  );
  const valorEmDivida = aluno.financeiro.total_em_atraso ?? 0;

  const renderMetaValue = (value?: string | null) =>
    value ? (
      <span className="font-semibold text-slate-700">{value}</span>
    ) : (
      <span className="text-slate-400 italic text-[11px]">Não preenchido</span>
    );

  const birthValue = (() => {
    const label = formatDate(perfil.data_nascimento);
    return label === "—" ? null : label;
  })();

  const turmaLabel = matricula_atual
    ? (matricula_atual.turma_codigo ?? matricula_atual.turma)
    : null;

  // Metadata agrupada semanticamente
  const metaIdentificacao = [
    { icon: <BookOpen size={12} />,      label: "Proc",  value: perfil.numero_processo },
    { icon: <Users size={12} />,         label: "BI",    value: perfil.bi_numero },
    { icon: <CalendarCheck size={12} />, label: "Nasc.", value: birthValue },
  ];

  const metaAcademico = [
    { icon: <BookOpen size={12} />, label: "Turma", value: turmaLabel },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 md:px-8 md:py-6 space-y-4">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 rounded-xl bg-slate-50/70 px-3 py-2 text-xs text-slate-400">
          {role === "admin" ? (
            <Link
              href={`/escola/${escolaId}/admin/alunos`}
              className="hover:text-slate-600 transition-colors"
            >
              Admin
            </Link>
          ) : (
            <Link
              href="/secretaria/alunos"
              className="hover:text-slate-600 transition-colors"
            >
              Secretaria
            </Link>
          )}
          <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
          <span className="text-slate-400">Alunos</span>
          <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
          <span className="text-slate-600 font-medium truncate max-w-[180px]">
            {perfil.nome}
          </span>
        </nav>

        {/* Corpo do header */}
        <div className="flex flex-col md:flex-row gap-5">

          {/* Avatar */}
          <div className="h-16 w-16 flex-shrink-0 rounded-2xl bg-[#1F6B3B]/10
            border border-[#1F6B3B]/20 overflow-hidden flex items-center justify-center shadow-sm">
            {perfil.foto_url ? (
              <img
                src={perfil.foto_url}
                alt={perfil.nome ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xl font-black text-[#1F6B3B]">
                {initials(perfil.nome)}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2.5">

            {/* Nome + badges — hierarquia clara: nome domina */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 leading-tight">
                {perfil.nome}
              </h1>
              {/* Status (ativo/arquivado) — peso leve */}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5
                text-[10px] font-bold uppercase tracking-wide ${statusClasses}`}>
                {statusLabel}
              </span>
              {/* Inadimplente — badge secundário, não compete com o nome */}
              {isInadimplente && (
                <span className="inline-flex items-center gap-1 rounded-full
                  bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Inadimplente
                </span>
              )}
            </div>

            {/* Metadata — dois grupos separados semanticamente */}
            <div className="space-y-1.5">
              {/* Grupo 1: identificação */}
              <div className="flex flex-wrap gap-4">
                {metaIdentificacao.map(({ icon, label, value }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-slate-400">{icon}</span>
                    <span className="text-slate-400">{label}:</span>
                    {renderMetaValue(value)}
                  </span>
                ))}
              </div>
              {/* Grupo 2: académico */}
              <div className="flex flex-wrap gap-4">
                {metaAcademico.map(({ icon, label, value }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-slate-400">{icon}</span>
                    <span className="text-slate-400">{label}:</span>
                    {renderMetaValue(value)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Acções */}
          <DossierAcoes role={role} aluno={aluno} escolaId={escolaId} />
        </div>
      </div>

      {/* Faixa de aviso financeiro — só aparece quando inadimplente */}
      {isInadimplente && (
        <div className="border-t border-rose-100 bg-rose-50 px-6 py-2.5 md:px-8
          flex items-center justify-between gap-4">
          <p className="text-xs text-rose-600 font-medium">
            Este aluno tem propinas em atraso.
          </p>
          {valorEmDivida > 0 ? (
            <span className="text-sm font-black text-rose-700 flex-shrink-0">
              {new Intl.NumberFormat("pt-AO", {
                style: "currency",
                currency: "AOA",
                maximumFractionDigits: 0,
              }).format(valorEmDivida)}{" "}
              em dívida
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
