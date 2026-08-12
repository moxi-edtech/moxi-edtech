import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import SignOutButton from "@/components/auth/SignOutButton";
import { UserCircle2, ChevronDown } from "lucide-react";

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

// --- Helpers Estáticos ---
function shortSchoolName(nome: string | null): string {
  if (!nome) return "Colégio KLASSE";
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return nome;
  return parts.slice(0, 2).join(" ");
}

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

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm font-sans">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        
        {/* --- Lado Esquerdo: Marca e Contexto --- */}
        <div className="flex items-center gap-3">
          <Link href={homeHref} className="flex items-center gap-2.5 transition active:scale-95 group" aria-label="Ir para a home do aluno">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-slate-200/70 shadow-sm transition-transform group-hover:scale-105">
              <Image src="/logo-klasse-ui.png" alt="KLASSE" width={24} height={24} className="h-6 w-6 object-contain" />
            </div>
            <div className="hidden min-[400px]:block">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none mb-1">
                Portal do Aluno
              </p>
              <h1 className="text-sm font-black text-slate-900 leading-none tracking-tight">
                {shortSchoolName(escolaNome)}
              </h1>
            </div>
          </Link>

          <div className="h-8 w-px bg-slate-200/70 hidden sm:block mx-1" />

          {/* Contexto do Aluno Selecionado */}
          <div className="flex items-center gap-2.5 bg-slate-50/90 border border-slate-200/60 rounded-2xl px-3 py-1.5 transition-all hover:bg-slate-100/90 shadow-2xs">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white border border-slate-200/80 text-emerald-700 shadow-2xs">
              <UserCircle2 className="h-4 w-4" />
            </div>
            <div className="max-w-[130px] sm:max-w-none">
              <p className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-emerald-700 leading-none mb-0.5">
                Utilizador
              </p>
              <p className="text-xs font-black text-slate-900 truncate">
                {alunoSelecionadoNome || "—"}
              </p>
            </div>

            {hasMultiple && (
              <div className="relative group ml-1 flex items-center">
                <div className="h-4 w-px bg-slate-200 mx-1.5" />
                <div className="relative flex items-center">
                  <select
                    value={alunoSelecionadoId ?? ""}
                    onChange={(e) => onSelectAluno(e.target.value)}
                    className="appearance-none rounded-full border-none bg-emerald-50 px-2 py-0.5 pr-6 text-[10px] font-black text-emerald-800 focus:ring-0 cursor-pointer hover:bg-emerald-100 transition-colors uppercase tracking-tight"
                  >
                    <option value="" disabled>Trocar</option>
                    {educandos.map((aluno) => (
                      <option key={aluno.id} value={aluno.id} className="font-semibold text-slate-900 bg-white">
                        {aluno.nome}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-700" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- Lado Direito: Ações --- */}
        <div className="flex items-center gap-3">
          {actions && <div className="hidden sm:flex items-center gap-2">{actions}</div>}
          
          <SignOutButton
            label="Sair"
            title="Sair"
            variant="ghost"
            className="h-9 px-3.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 transition-all text-xs font-black uppercase tracking-widest"
          />
        </div>

      </div>
    </header>
  );
}

