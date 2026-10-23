"use client";

import { ArrowUpRight, Loader2, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { buildPortalHref } from "@/lib/navigation";
import { useFuncionarioContext } from "@/hooks/useFuncionarioContext";
import type { EntityContext } from "@/lib/command-center/entity-context";

const PAPEL_LABELS: Record<string, string> = {
  admin: "Administrador",
  admin_escola: "Administrador da escola",
  staff_admin: "Administrador",
  diretor: "Direção",
  secretaria: "Secretaria",
  admin_secretaria: "Administração da secretaria",
  secretaria_financeiro: "Secretaria e financeiro",
  admin_financeiro: "Administração financeira",
  financeiro: "Financeiro",
};

export function FuncionarioContextView({
  context, portal, onNavigate,
}: {
  context: EntityContext;
  portal?: string;
  onNavigate: (href: string) => void;
}) {
  const { data, error, status, loading, refreshing, retry } = useFuncionarioContext(context);

  if (loading) return (
    <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar o funcionário…
    </div>
  );

  if (error || !data) return (
    <div className="space-y-3 p-3 text-sm" role="alert">
      <h2 className="text-lg font-semibold text-slate-900">Funcionário · {context.label}</h2>
      <p className="text-rose-700">{error || "Não foi possível consultar o funcionário."}</p>
      {status !== 400 && status !== 401 && status !== 403 && status !== 404 && (
        <button type="button" onClick={() => void retry()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
          <RefreshCw className="h-4 w-4" aria-hidden /> Tentar novamente
        </button>
      )}
    </div>
  );

  const funcionario = data.funcionario;
  const papel = PAPEL_LABELS[funcionario.papel] || funcionario.papel;
  return (
    <div className="min-w-0 space-y-5 px-1 pb-3 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Explorador · Equipa da escola</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{funcionario.nome}</h2>
          {refreshing && <p role="status" className="mt-1 text-xs text-slate-500">A atualizar…</p>}
        </div>
        {portal === "admin" && (
          <button type="button"
            onClick={() => onNavigate(buildPortalHref(context.escolaId, "/admin/funcionarios"))}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
            Gerir funcionários <ArrowUpRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Vínculo funcional">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <UserRound className="h-4 w-4 text-emerald-700" aria-hidden /> Vínculo com a escola
        </h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Função</dt>
            <dd className="mt-1 font-medium text-slate-900">{papel}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Tipo de vínculo</dt>
            <dd className="mt-1 flex items-center gap-2 font-medium text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
              Funcionário vinculado à escola
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-xs text-slate-500">
        Consulta operacional. Dados de contacto, credenciais e permissões detalhadas
        não são apresentados neste explorador.
      </p>
    </div>
  );
}
