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
    <header className="sticky top-0 z-30 w-full border-b border-border border-t-[3px] border-t-klasse-green bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 w-full max-w-[1200px] items-center justify-between gap-2 px-4 md:px-6">
        <Link
          href={homeHref}
          aria-label="Ir para o início do Portal do Aluno"
          className="group flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
            <Image src="/logo-klasse-ui.png" alt="KLASSE" width={24} height={24} className="h-6 w-6 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] leading-4 text-muted-foreground">Portal do Aluno</span>
            <span className="block max-w-[32vw] truncate text-sm font-semibold leading-5 text-primary sm:max-w-72" title={schoolLabel}>
              {schoolLabel}
            </span>
          </span>
        </Link>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 sm:px-3">
            <UserCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {hasMultiple ? (
              <div className="relative min-w-0">
                <select
                  aria-label="Escolher educando"
                  value={alunoSelecionadoId ?? ""}
                  onChange={(event) => onSelectAluno(event.target.value)}
                  className="min-h-11 max-w-[100px] appearance-none truncate bg-transparent py-2 pr-5 text-xs font-medium text-foreground outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 sm:max-w-52"
                >
                  <option value="" disabled>Selecionar aluno</option>
                  {educandos.map((aluno) => (
                    <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
            ) : (
              <span className="max-w-[72px] truncate py-3 text-xs font-medium text-foreground sm:max-w-48" title={alunoSelecionadoNome}>
                {alunoSelecionadoNome || "Aluno"}
              </span>
            )}
          </div>
          {actions && <div className="hidden items-center gap-2 sm:flex">{actions}</div>}
          <SignOutButton
            label="Sair"
            title="Sair da conta"
            variant="ghost"
            className="min-h-11 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-klasse-gold/20 sm:px-3"
          />
        </div>
      </div>
    </header>
  );
}
