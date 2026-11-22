import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { AlertTriangle, ArrowLeft, FileText, List, Table } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

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

type ErrorRow = {
  row_number: number;
  column_name: string | null;
  message: string | null;
  raw_value: string | null;
};

async function getImportacao(importId: string, escolaId?: string): Promise<ImportItem | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ');

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;

  const res = await fetch(`${baseUrl}/api/migracao/${importId}${escolaId ? `?escola_id=${encodeURIComponent(escolaId)}` : ""}`, {
    cache: 'no-store',
    headers: { cookie },
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => ({}));
  return json?.item ?? null;
}

async function getErros(importId: string, escolaId?: string): Promise<ErrorRow[]> {
  const cookieStore = await cookies();
  const cookie = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ');

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;

  const res = await fetch(`${baseUrl}/api/migracao/${importId}/erros${escolaId ? `?escola_id=${encodeURIComponent(escolaId)}` : ""}`, {
    cache: 'no-store',
    headers: { cookie },
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return json?.errors ?? [];
}

export default async function ImportacaoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ escola_id?: string }>;
}) {
  const { id: importId } = await params;
  const escolaId = (await searchParams)?.escola_id;
  const [item, erros] = await Promise.all([getImportacao(importId, escolaId), getErros(importId, escolaId)]);
  if (!item) {
    // Se o histórico não contém, ainda assim mostramos erros com cabeçalho simples
    if (erros.length === 0) return notFound();
  }

  const counts = item
    ? {
        total: item.total_rows ?? 0,
        imported: item.imported_rows ?? 0,
        errors: item.error_rows ?? 0,
        remaining: (item.total_rows ?? 0) - (item.imported_rows ?? 0) - (item.error_rows ?? 0),
      }
    : { total: 0, imported: 0, errors: erros.length, remaining: 0 };

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="../" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-teal-700">
            <ArrowLeft size={16} /> Voltar
          </Link>
        </div>
      </div>
      <DashboardHeader
        title="Detalhes da importação"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Importações", href: "/secretaria/importacoes" },
          { label: "Detalhe" },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-foreground"><FileText size={18} /> Arquivo</div>
          <div className="mt-1 text-foreground font-medium break-words">{item?.file_name ?? importId}</div>
          <div className="mt-1 text-xs text-muted-foreground">ID: {importId}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-foreground"><Table size={18} /> Registos</div>
          <div className="mt-1 text-foreground font-medium">
            {counts.imported} importados · {counts.errors} erros · {counts.remaining} restantes
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-foreground"><List size={18} /> Status</div>
          <div className="mt-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              item?.status === 'imported' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
              item?.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
              item?.status === 'failed' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' :
              'bg-muted text-foreground ring-1 ring-ring'
            }`}>
              {item?.status ?? '—'}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {item?.processed_at ? new Date(item.processed_at).toLocaleString() : item?.created_at ? new Date(item.created_at).toLocaleString() : ''}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Erros da importação</h2>
        {erros.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Nenhum erro registrado para esta importação.
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Linha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Coluna</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensagem</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor bruto</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {erros.map((e, idx) => (
                  <tr key={`${e.row_number}-${idx}`} className="hover:bg-muted/60">
                    <td className="px-3 py-2 text-sm text-foreground">{e.row_number}</td>
                    <td className="px-3 py-2 text-sm text-foreground">{e.column_name ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-foreground">{e.message ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">{e.raw_value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
