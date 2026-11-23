"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarCheck, Users, ChevronRight } from "lucide-react";
import { DossierAcoes, type DossierRole } from "@/components/aluno/DossierAcoes";
import { formatDate } from "@/lib/formatters";
import type { AlunoNormalizado } from "@/lib/aluno/types";
import { useEscolaId } from "@/hooks/useEscolaId";
import {
  buildContextualPortalHref,
  isOperacoesContext,
} from "@/lib/navigation";

const currencyFormatter = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

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
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const pathname = usePathname();
  const isOperacoes = isOperacoesContext(pathname);
  const breadcrumbPath =
    role === "admin" ? "/admin/alunos" : "/secretaria/alunos";
  const breadcrumbLabel = isOperacoes
    ? "Operações"
    : role === "admin"
      ? "Admin"
      : "Secretaria";

  const status = (perfil.status ?? "pendente").toLowerCase();
  const statusLabel = status.replace(/_/g, " ");
  const statusClasses =
    status === "ativo"
      ? "bg-klasse-green/10 text-klasse-green dark:text-emerald-300"
      : status === "arquivado" || status === "inativo"
      ? "bg-muted text-muted-foreground"
      : "bg-klasse-gold/10 text-klasse-gold-900 dark:text-klasse-gold-300";

  const isInadimplente = ["inadimplente", "em_atraso", "atrasado"].includes(
    (aluno.financeiro.situacao ?? "").toLowerCase()
  );
  const valorEmDivida = aluno.financeiro.total_em_atraso ?? 0;

  const renderMetaValue = (value?: string | null) =>
    value ? (
      <span className="font-medium text-foreground">{value}</span>
    ) : (
      <span className="text-muted-foreground italic text-[11px]">Não preenchido</span>
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
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-5 md:px-8 md:py-6 space-y-4">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 rounded-xl bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
          <Link
            href={buildContextualPortalHref(
              escolaParam,
              breadcrumbPath,
              pathname
            )}
            className="hover:text-muted-foreground transition-colors"
          >
            {breadcrumbLabel}
          </Link>
          <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">Alunos</span>
          <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground font-medium truncate max-w-[180px]">
            {perfil.nome}
          </span>
        </nav>

        {/* Corpo do header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2.5">

            {/* Nome + badges — hierarquia clara: nome domina */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-foreground leading-tight">
                {perfil.nome}
              </h1>
              {/* Status (ativo/arquivado) — peso leve */}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5
                text-[10px] font-semibold uppercase tracking-wide ${statusClasses}`}>
                {statusLabel}
              </span>
              {/* Inadimplente — badge secundário, não compete com o nome */}
              {isInadimplente && (
                <span className="inline-flex items-center gap-1 rounded-full
                  bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700">
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
                  <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="text-muted-foreground">{icon}</span>
                    <span className="text-muted-foreground">{label}:</span>
                    {renderMetaValue(value)}
                  </span>
                ))}
              </div>
              {/* Grupo 2: académico */}
              <div className="flex flex-wrap gap-4">
                {metaAcademico.map(({ icon, label, value }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="text-muted-foreground">{icon}</span>
                    <span className="text-muted-foreground">{label}:</span>
                    {renderMetaValue(value)}
                  </span>
                ))}
              </div>
            </div>
            </div>

            {/* Acções */}
            <div className="lg:flex lg:justify-end">
              <DossierAcoes role={role} aluno={aluno} escolaId={escolaId} />
            </div>
          </div>
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
            <span className="text-sm font-bold text-rose-700 flex-shrink-0">
              {currencyFormatter.format(valorEmDivida)}{" "}
              em dívida
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
