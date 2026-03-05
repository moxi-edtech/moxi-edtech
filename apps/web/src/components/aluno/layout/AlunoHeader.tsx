import type { ReactNode } from "react";

type Educando = { id: string; nome: string };

type Props = {
  escolaNome: string | null;
  alunoSelecionadoNome: string;
  educandos: Educando[];
  alunoSelecionadoId: string | null;
  onSelectAluno: (id: string) => void;
  actions?: ReactNode;
};

function shortSchoolName(nome: string | null): string {
  if (!nome) return "Portal Aluno";
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
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-klasse-green-600 text-sm font-semibold text-white">
            KL
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Portal do aluno</p>
            <p className="text-sm font-semibold text-slate-900">{shortSchoolName(escolaNome)}</p>
            {alunoSelecionadoNome && (
              <p className="text-xs text-slate-500">Aluno: {alunoSelecionadoNome}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {educandos.map((aluno) => {
            const active = aluno.id === alunoSelecionadoId;
            return (
              <button
                key={aluno.id}
                onClick={() => onSelectAluno(aluno.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-klasse-green-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-klasse-green-200 hover:text-klasse-green-700"
                }`}
                type="button"
              >
                {aluno.nome.split(" ")[0]}
              </button>
            );
          })}
          {actions}
        </div>
      </div>
    </header>
  );
}
