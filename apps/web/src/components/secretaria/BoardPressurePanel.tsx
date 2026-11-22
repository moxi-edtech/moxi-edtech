"use client";

import { Target, Trophy } from "lucide-react";

type ExecutiveHighlight = {
  mesRef: string;
  classeId: string;
  classeLabel: string;
  totalEmAtraso: number;
};

type DiamondTurma = {
  turmaId: string;
  turmaNome: string;
};

type BoardPressurePanelProps = {
  diamondTurmas: DiamondTurma[];
  executiveHighlights: ExecutiveHighlight[];
  formatCurrency: (value: number) => string;
  totalAtraso: number;
};

export function BoardPressurePanel({
  diamondTurmas,
  executiveHighlights,
  formatCurrency,
  totalAtraso,
}: BoardPressurePanelProps) {
  return (
    <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Turmas sob pressao</p>
      <h3 className="mt-2 text-lg font-semibold text-foreground">Top classes em atraso</h3>
      <div className="mt-5 space-y-4">
        {executiveHighlights.length > 0 ? (
          executiveHighlights.map((item) => {
            const share = totalAtraso > 0 ? Math.max(10, Math.round((item.totalEmAtraso / totalAtraso) * 100)) : 10;

            return (
              <div key={`${item.mesRef}-${item.classeId}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{item.classeLabel}</span>
                  <span className="text-sm font-bold text-rose-700">{formatCurrency(item.totalEmAtraso)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300"
                    style={{ width: `${Math.min(share, 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
            Nao ha classes com inadimplencia para destacar neste recorte.
          </div>
        )}

        {diamondTurmas.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900">Turmas Diamante ({diamondTurmas.length})</p>
                <p className="text-xs text-emerald-700">Adimplência impecável detectada!</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {diamondTurmas.map((turma) => (
                <span
                  key={turma.turmaId}
                  className="rounded-lg border border-emerald-200 bg-card px-2 py-1 text-[10px] font-bold text-emerald-800 shadow-sm"
                >
                  {turma.turmaNome}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">Em busca do Diamante</p>
                <p className="text-xs text-amber-700">Nenhuma turma atingiu 100% ainda. Faltam pequenos ajustes!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
