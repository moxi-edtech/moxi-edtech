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
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm font-sora">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        
        {/* --- Lado Esquerdo: Marca e Contexto --- */}
        <div className="flex items-center gap-3">
          <Link href={homeHref} className="flex items-center gap-2" aria-label="Ir para a home do aluno">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1F6B3B] text-white shadow-sm ring-4 ring-[#1F6B3B]/10">
              <Image src="/logo-klasse-ui.png" alt="KLASSE" width={18} height={18} className="h-4.5 w-4.5 object-contain" />
            </div>
            <div className="hidden min-[400px]:block">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 font-geist leading-none mb-0.5">
                Portal do Aluno
              </p>
              <h1 className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px] sm:max-w-[200px]">
                {shortSchoolName(escolaNome)}
              </h1>
            </div>
          </Link>

          <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1" />

          {/* Contexto do Aluno Selecionado */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-2 py-1 pr-1 sm:pr-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm">
              <UserCircle2 className="h-3.5 w-3.5" />
            </div>
            <div className="max-w-[100px] sm:max-w-none">
              <p className="hidden sm:block text-[8px] font-bold uppercase tracking-widest text-[#1F6B3B] font-geist leading-none">
                A Visualizar
              </p>
              <p className="text-[11px] font-bold text-slate-900 truncate">
                {alunoSelecionadoNome || "—"}
              </p>
            </div>

            {hasMultiple && (
              <div className="relative group ml-1">
                <select
                  value={alunoSelecionadoId ?? ""}
                  onChange={(e) => onSelectAluno(e.target.value)}
                  className="appearance-none rounded-full border-none bg-transparent pl-1 pr-6 py-0.5 text-[10px] font-bold text-[#1F6B3B] focus:ring-0 cursor-pointer hover:underline"
                >
                  <option value="" disabled>Trocar...</option>
                  {educandos.map((aluno) => (
                    <option key={aluno.id} value={aluno.id} className="font-semibold text-slate-900 bg-white">
                      {aluno.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-[#1F6B3B]" />
              </div>
            )}
          </div>
        </div>

        {/* --- Lado Direito: Ações --- */}
        <div className="flex items-center gap-2">
          {actions && <div className="hidden sm:flex items-center gap-2">{actions}</div>}
          
          <SignOutButton
            label="Sair"
            title="Sair"
            variant="ghost"
            className="h-8 px-2 sm:px-3 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-[10px] sm:text-xs font-semibold"
          />
        </div>

      </div>
    </header>
  );
}
