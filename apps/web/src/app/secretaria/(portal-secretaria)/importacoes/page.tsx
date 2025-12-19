import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, Clock, FileText, RefreshCw, Upload } from "lucide-react";
import RowActions from "./RowActions";

type ImportItem = {
  id: string;
  escola_id: string;
  file_name: string | null;
  status: string | null;
  total_rows: number | null;
  imported_rows: number | null;
  error_rows: number | null;
  processed_at: string | null;
  created_at: string | null;
};

async function getHistorico(): Promise<ImportItem[]> {
  const cookieStore = await cookies();
  const cookie = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ');
  
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;
  
  const res = await fetch(`${baseUrl}/api/migracao/historico`, {
    cache: 'no-store',
    headers: { cookie },
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return json?.items ?? [];
}

export default async function ImportacoesPage() {
  const items = await getHistorico();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Importações recentes</h1>
          <p className="text-sm text-slate-500">Últimas 50 importações efetuadas nesta escola.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/migracao/alunos"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-white hover:bg-teal-700"
          >
            <Upload size={18} />
            Nova importação
          </Link>
          <Link
            href="/secretaria/importacoes"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-slate-700 border border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw size={18} />
            Atualizar
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Arquivo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Registos</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Processado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Nenhuma importação encontrada.
                </td>
              </tr>
            )}
            {items.map((it) => {
              const counts = [
                `${it.imported_rows ?? 0} importados`,
                `${it.error_rows ?? 0} erros`,
                `${(it.total_rows ?? 0) - (it.imported_rows ?? 0) - (it.error_rows ?? 0)} restantes`,
              ].join(' · ');
              const processed = it.processed_at
                ? new Date(it.processed_at).toLocaleString()
                : it.created_at
                ? new Date(it.created_at).toLocaleString()
                : "—";
              return (
                <tr key={it.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 truncate max-w-[360px]">
                          {it.file_name ?? it.id}
                        </div>
                        <div className="text-xs text-slate-500">ID: {it.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      it.status === 'imported' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                      it.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                      it.status === 'failed' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' :
                      'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                    }`}>
                      {it.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{counts}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="inline-flex items-center gap-1 text-slate-600">
                      <Clock size={16} />
                      {processed}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/secretaria/importacoes/${it.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-teal-700 border border-teal-200 hover:bg-teal-50"
                    >
                      Visualizar
                      <ArrowRight size={16} />
                    </Link>
                    <RowActions id={it.id} currentName={it.file_name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
