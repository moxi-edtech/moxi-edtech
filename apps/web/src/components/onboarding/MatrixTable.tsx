"use client";

import type { MatrixRow, TurnosState } from "@/components/escola/onboarding/academicSetupTypes";

type Props = {
  turnos: TurnosState;
  matrix: MatrixRow[];
  setMatrix: (rows: MatrixRow[]) => void;
};

export function MatrixTable({ turnos, matrix, setMatrix }: Props) {
  function updateRow(id: string | number, field: keyof MatrixRow, value: string) {
    const num = parseInt(value, 10);
    const next = matrix.map((row) =>
      row.id === id ? { ...row, [field]: Number.isNaN(num) ? 0 : num } : row,
    );
    setMatrix(next);
  }

  const total = matrix.reduce((acc, row) => {
    let sum = 0;
    if (turnos.Manhã) sum += row.manha || 0;
    if (turnos.Tarde) sum += row.tarde || 0;
    if (turnos.Noite) sum += row.noite || 0;
    return acc + sum;
  }, 0);

  if (!matrix.length) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm py-12 flex flex-col items-center text-center">
        <div className="p-3 bg-muted rounded-full mb-3 text-muted-foreground">
          ↑
        </div>
        <p className="text-muted-foreground text-sm font-medium">
          Selecione um curso acima
        </p>
        <p className="text-xs text-muted-foreground">
          A tabela de turmas aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-muted px-6 py-4 border-b border-border flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold">
            Matriz de Turmas
          </span>
        </div>
        <span className="text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/30 px-3 py-1 rounded-full border border-teal-100 dark:border-teal-900">
          {total} turmas a criar
        </span>
      </div>

      <div className="max-w-full overflow-x-auto" role="region" aria-label="Matriz de turmas por turno" tabIndex={0}>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-card border-b border-border">
            <tr>
              <th className="px-6 py-3 font-semibold text-muted-foreground">Classe</th>
              {turnos.Manhã && (
                <th className="px-6 py-3 font-semibold text-center w-32 bg-orange-50/50 dark:bg-orange-950/25 text-orange-700 dark:text-orange-300 border-l border-border">
                  Manhã
                </th>
              )}
              {turnos.Tarde && (
                <th className="px-6 py-3 font-semibold text-center w-32 bg-amber-50/50 dark:bg-amber-950/25 text-amber-700 dark:text-amber-300 border-l border-border">
                  Tarde
                </th>
              )}
              {turnos.Noite && (
                <th className="px-6 py-3 font-semibold text-center w-32 bg-indigo-50/50 dark:bg-indigo-950/25 text-indigo-700 dark:text-indigo-300 border-l border-border">
                  Noite
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {matrix.map((row) => (
              <tr key={row.id} className="hover:bg-muted transition group">
                <td className="px-6 py-4 font-bold text-foreground border-r border-transparent group-hover:border-border">
                  {row.nome}
                </td>

                {turnos.Manhã && (
                  <td className="px-6 py-2 text-center bg-orange-50/10 dark:bg-orange-950/10 border-l border-border">
                    <input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center font-bold text-foreground bg-card border border-border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                      value={row.manha || ""}
                      placeholder="0"
                      onChange={(e) => updateRow(row.id, "manha", e.target.value)}
                    />
                  </td>
                )}

                {turnos.Tarde && (
                  <td className="px-6 py-2 text-center bg-amber-50/10 dark:bg-amber-950/10 border-l border-border">
                    <input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center font-bold text-foreground bg-card border border-border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                      value={row.tarde || ""}
                      placeholder="0"
                      onChange={(e) => updateRow(row.id, "tarde", e.target.value)}
                    />
                  </td>
                )}

                {turnos.Noite && (
                  <td className="px-6 py-2 text-center bg-indigo-50/10 dark:bg-indigo-950/10 border-l border-border">
                    <input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center font-bold text-foreground bg-card border border-border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                      value={row.noite || ""}
                      placeholder="0"
                      onChange={(e) => updateRow(row.id, "noite", e.target.value)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
