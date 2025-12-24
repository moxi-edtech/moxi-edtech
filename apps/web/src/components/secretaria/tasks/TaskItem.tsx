import { UserCheck, Check, X } from "lucide-react";

export function TaskItem({
  item,
}: {
  item: {
    created_at: string;
    aluno: { nome: string };
    turma: { nome: string };
  };
}) {
  return (
    <div
      className="
        group flex items-center gap-4 p-4
        border-b border-slate-100 last:border-0
        hover:bg-slate-50 transition
      "
    >
      {/* Ícone */}
      <div
        className="
          h-10 w-10 rounded-xl
          bg-klasse-gold/10 text-klasse-gold
          ring-1 ring-klasse-gold/25
          flex items-center justify-center
          shrink-0
        "
      >
        <UserCheck className="h-5 w-5" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900 truncate">
            Aprovar matrícula online
          </p>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>

        <p className="text-xs text-slate-500 truncate mt-0.5">
          Aluno{" "}
          <span className="font-medium text-slate-700">
            {item.aluno.nome}
          </span>{" "}
          • {item.turma.nome}
        </p>
      </div>

      {/* Ações */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          className="
            h-9 w-9 rounded-lg
            border border-slate-200 bg-white
            text-emerald-600
            hover:bg-emerald-50 hover:border-emerald-200
            focus:outline-none focus:ring-4 focus:ring-emerald-200/40
          "
          aria-label="Aprovar"
        >
          <Check className="h-4 w-4 mx-auto" />
        </button>

        <button
          className="
            h-9 w-9 rounded-lg
            border border-slate-200 bg-white
            text-slate-400
            hover:text-red-600 hover:bg-red-50 hover:border-red-200
            focus:outline-none focus:ring-4 focus:ring-red-200/40
          "
          aria-label="Rejeitar"
        >
          <X className="h-4 w-4 mx-auto" />
        </button>
      </div>
    </div>
  );
}
