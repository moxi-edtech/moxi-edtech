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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-12 flex flex-col items-center text-center">
        <div className="p-3 bg-slate-50 rounded-full mb-3 text-slate-300">
          ↑
        </div>
        <p className="text-slate-500 text-sm font-medium">
          Selecione um curso acima
        </p>
        <p className="text-xs text-slate-400">
          A tabela de turmas aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold">
            Matriz de Turmas
          </span>
        </div>
        <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
          {total} turmas a criar
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-400 uppercase bg-white border-b border-slate-100">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-500">Classe</th>
              {turnos.Manhã && (
                <th className="px-6 py-3 font-semibold text-center w-32 bg-orange-50/50 text-orange-600 border-l border-slate-100">
                  Manhã
                </th>
              )}
              {turnos.Tarde && (
                <th className="px-6 py-3 font-semibold text-center w-32 bg-amber-50/50 text-amber-600 border-l border-slate-100">
                  Tarde
                </th>
              )}
              {turnos.Noite && (
                <th className="px-6 py-3 font-semibold text-center w-32 bg-indigo-50/50 text-indigo-600 border-l border-slate-100">
                  Noite
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matrix.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition group">
                <td className="px-6 py-4 font-bold text-slate-700 border-r border-transparent group-hover:border-slate-100">
                  {row.nome}
                </td>

                {turnos.Manhã && (
                  <td className="px-6 py-2 text-center bg-orange-50/10 border-l border-slate-100">
                    <input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                      value={row.manha || ""}
                      placeholder="0"
                      onChange={(e) => updateRow(row.id, "manha", e.target.value)}
                    />
                  </td>
                )}

                {turnos.Tarde && (
                  <td className="px-6 py-2 text-center bg-amber-50/10 border-l border-slate-100">
                    <input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                      value={row.tarde || ""}
                      placeholder="0"
                      onChange={(e) => updateRow(row.id, "tarde", e.target.value)}
                    />
                  </td>
                )}

                {turnos.Noite && (
                  <td className="px-6 py-2 text-center bg-indigo-50/10 border-l border-slate-100">
                    <input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
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
