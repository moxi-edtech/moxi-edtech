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
  actions,
}: Props) {
  const hasMultiple = educandos.length > 1;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm font-sora">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4">
        
        {/* --- LINHA SUPERIOR: Marca e Ações Globais --- */}
        <div className="flex items-center justify-between">
          
          {/* Identidade da Escola */}
          <Link href="/aluno/dashboard" className="flex items-center gap-3" aria-label="Ir para a home do aluno">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B] text-white shadow-sm ring-4 ring-[#1F6B3B]/10">
              <Image src="/logo-klasse-ui.png" alt="KLASSE" width={20} height={20} className="h-5 w-5 object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-geist">
                Portal do Aluno
              </p>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                {shortSchoolName(escolaNome)}
              </h1>
            </div>
          </Link>

          {/* Ações (Notificações, etc.) e SignOut */}
          <div className="flex items-center gap-3">
            {actions && <div className="hidden sm:flex items-center gap-2">{actions}</div>}
            
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            
            <SignOutButton
              label="Terminar Sessão"
              title="Sair"
              variant="ghost"
              className="px-3 py-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-semibold"
            />
          </div>
        </div>

        {/* --- LINHA INFERIOR: Contexto do Aluno Atual --- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-100 p-3">
          
          {/* Aluno Ativo */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B] font-geist">
                A Visualizar
              </p>
              <p className="text-sm font-bold text-slate-900">
                {alunoSelecionadoNome || "—"}
              </p>
            </div>
          </div>

          {/* Seletor de Educandos (Parental Control) */}
          <div className="flex items-center">
            {hasMultiple ? (
              <div className="relative group w-full sm:w-auto">
                <select
                  value={alunoSelecionadoId ?? ""}
                  onChange={(e) => onSelectAluno(e.target.value)}
                  className="w-full sm:w-auto appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2 pr-10 text-xs font-bold text-slate-700 shadow-sm focus:border-[#E3B23C] focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20 transition-all cursor-pointer hover:bg-slate-50"
                >
                  <option value="" disabled className="text-slate-400">Trocar perfil...</option>
                  {educandos.map((aluno) => (
                    <option key={aluno.id} value={aluno.id} className="font-semibold text-slate-900">
                      {aluno.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </div>
            ) : (
              <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 shadow-sm">
                Conta Única
              </span>
            )}
          </div>
          
        </div>
      </div>
    </header>
  );
}
