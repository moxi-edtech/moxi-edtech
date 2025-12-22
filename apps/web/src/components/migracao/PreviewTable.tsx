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
            <th className="px-3 py-2 text-left">Data Nasc.</th>
            <th className="px-3 py-2 text-left">Gênero</th>
            <th className="px-3 py-2 text-left">BI</th>
            <th className="px-3 py-2 text-left">NIF</th>
            <th className="px-3 py-2 text-left">Telefone Enc.</th>
            <th className="px-3 py-2 text-left">Email Enc.</th>
            <th className="px-3 py-2 text-left">Turma Código</th>
            <th className="px-3 py-2 text-left">Ano Letivo</th>
            <th className="px-3 py-2 text-left">Nº Processo</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, idx) => (
            <tr key={idx} className="border-t">
              <td className="px-3 py-2">{record.nome || "-"}</td>
              <td className="px-3 py-2">{record.data_nascimento || "-"}</td>
              <td className="px-3 py-2">{record.sexo || "-"}</td>
              <td className="px-3 py-2">{record.bi_numero || record.bi || "-"}</td>
              <td className="px-3 py-2">{record.nif || "-"}</td>
              <td className="px-3 py-2">{record.encarregado_telefone || record.telefone || "-"}</td>
              <td className="px-3 py-2">{record.encarregado_email || record.email || "-"}</td>
              <td className="px-3 py-2">{record.turma_codigo || "-"}</td>
              <td className="px-3 py-2">{record.ano_letivo || "-"}</td>
              <td className="px-3 py-2">{record.numero_processo || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
