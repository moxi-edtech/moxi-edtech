"use client";

import type { AlunoStagingRecord } from "~types/migracao";

interface PreviewTableProps {
  records: AlunoStagingRecord[];
}

export function PreviewTable({ records }: PreviewTableProps) {
  if (!records.length) {
    return <p className="text-sm text-muted-foreground">Nenhum registro para pré-visualizar.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="min-w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left">Nome</th>
            <th className="px-3 py-2 text-left">Data</th>
            <th className="px-3 py-2 text-left">Telefone</th>
            <th className="px-3 py-2 text-left">BI</th>
            <th className="px-3 py-2 text-left">Email</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, idx) => (
            <tr key={idx} className="border-t">
              <td className="px-3 py-2">{record.nome || "-"}</td>
              <td className="px-3 py-2">{record.data_nascimento || "-"}</td>
              <td className="px-3 py-2">{record.telefone || "-"}</td>
              <td className="px-3 py-2">{record.bi || "-"}</td>
              <td className="px-3 py-2">{record.email || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
