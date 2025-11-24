"use client";

import type { ErroImportacao } from "~types/migracao";

interface ErrorListProps {
  errors: ErroImportacao[];
}

export function ErrorList({ errors }: ErrorListProps) {
  if (!errors.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Erros encontrados ({errors.length})</p>
      <div className="border rounded-md overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Linha</th>
              <th className="px-3 py-2 text-left">Coluna</th>
              <th className="px-3 py-2 text-left">Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((error, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-3 py-2">{error.row_number ?? "-"}</td>
                <td className="px-3 py-2">{error.column_name || "-"}</td>
                <td className="px-3 py-2">{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
