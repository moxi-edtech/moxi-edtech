import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import SignOutButton from "@/components/auth/SignOutButton";
import { ChevronDown, UserCircle2 } from "lucide-react";

type Educando = { id: string; nome: string };

type Props = {
  escolaNome: string | null;
  alunoSelecionadoNome: string;
  educandos: Educando[];
  alunoSelecionadoId: string | null;
  onSelectAluno: (id: string) => void;
  homeHref?: string;
  actions?: ReactNode;
};

/** O contexto escolar acompanha toda a navegação, sem competir com a página. */
export function AlunoHeader({
  escolaNome,
  alunoSelecionadoNome,
  educandos,
  alunoSelecionadoId,
  onSelectAluno,
  homeHref = "/aluno/dashboard",
  actions,
}: Props) {
  const hasMultiple = educandos.length > 1;
  const schoolLabel = escolaNome?.trim() || "KLASSE";

  return (
    <header className="klasse-academic-topbar sticky top-0 z-30 w-full border-b border-border border-t-[3px] border-t-klasse-green bg-card">
      <div className="mx-auto flex min-h-16 w-full max-w-[1200px] items-center justify-between gap-2 px-3 md:px-6">
        <Link
          href={homeHref}
          aria-label="Ir para o início do Portal do Aluno"
          className="group flex min-w-0 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
            <Image src="/logo-klasse-ui.png" alt="KLASSE" width={32} height={32} className="h-8 w-8 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight tracking-tight text-primary">KLASSE</span>
            <span className="sr-only">Portal do Aluno</span>
            <span className="block max-w-[42vw] truncate text-[11px] leading-4 text-muted-foreground sm:max-w-72" title={schoolLabel}>
              {schoolLabel}
            </span>
          </span>
        </Link>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
          {actions && <div className="hidden items-center gap-2 sm:flex">{actions}</div>}
          <details className="group relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 [&::-webkit-details-marker]:hidden" aria-label="Menu da conta do aluno">
              <UserCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="max-w-[64px] truncate sm:max-w-36" title={alunoSelecionadoNome}>{alunoSelecionadoNome.trim().split(/\s+/)[0] || "Aluno"}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden="true"/>
            </summary>
            <div className="absolute right-0 top-full z-40 mt-2 w-60 max-w-[calc(100vw-2rem)] space-y-2 rounded-xl border border-border bg-card p-3 shadow-lg">
              <p className="break-words px-1 text-sm font-semibold text-foreground">{alunoSelecionadoNome || "Aluno"}</p>
              {hasMultiple && (
                <div className="space-y-1">
                  <label htmlFor="aluno-header-educando" className="block px-1 text-xs text-muted-foreground">Educando</label>
                  <select
                    id="aluno-header-educando"
                    aria-label="Escolher educando"
                    value={alunoSelecionadoId ?? ""}
                    onChange={(event) => onSelectAluno(event.target.value)}
                    className="min-h-11 w-full rounded-xl border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
                  >
                    <option value="" disabled>Selecionar aluno</option>
                    {educandos.map((aluno) => (
                      <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <SignOutButton
                label="Sair"
                title="Sair da conta"
                variant="ghost"
                className="min-h-11 w-full justify-start rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
              />
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
