import { Check, UserCheck, X } from "lucide-react";
import { EstadoVazio } from "@/components/harmonia";

export function TaskList({
  items,
}: {
  items: Array<{
    id: string;
    created_at: string;
    aluno: { nome: string };
    turma: { nome: string };
  }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {items.length === 0 ? (
        <div className="p-6">
          <EstadoVazio tipo="notificacoes.nenhuma" />
        </div>
      ) : (
        items.map((item) => <TaskItem key={item.id} item={item} />)
      )}
    </div>
  );
}

function TaskItem({
  item,
}: {
  item: {
    created_at: string;
    aluno: { nome: string };
    turma: { nome: string };
  };
}) {
  return (
    <div className="group flex items-center gap-4 p-4 border-b border-border last:border-0 hover:bg-muted transition">
      <div className="h-10 w-10 rounded-xl bg-amber/10 text-foreground ring-1 ring-amber/30 flex items-center justify-center shrink-0">
        <UserCheck className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground truncate">Matrícula registada</p>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          Aluno <span className="font-medium text-foreground">{item.aluno.nome}</span> • {item.turma.nome}
        </p>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          className="h-9 w-9 rounded-lg border border-emerald/30 bg-card text-foreground hover:bg-emerald/10 hover:border-emerald/40 focus:outline-none focus:ring-4 focus:ring-emerald/20"
          aria-label="Aprovar"
        >
          <Check className="h-4 w-4 mx-auto" />
        </button>
        <button
          className="h-9 w-9 rounded-lg border border-destructive/30 bg-card text-foreground hover:bg-destructive/10 hover:border-destructive/40 focus:outline-none focus:ring-4 focus:ring-destructive/20"
          aria-label="Rejeitar"
        >
          <X className="h-4 w-4 mx-auto" />
        </button>
      </div>
    </div>
  );
}
