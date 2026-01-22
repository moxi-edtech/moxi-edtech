import { getAbsoluteUrlServer } from "@/lib/serverUrl";

type ValidationResponse = {
  ok: boolean;
  valid?: boolean;
  tipo?: string;
  escola?: string;
  aluno?: string;
  created_at?: string;
  error?: string;
};

export const dynamic = "force-dynamic";

export default async function DocumentoValidationPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ hash?: string }>;
}) {
  const { publicId } = await params;
  const { hash } = await searchParams;

  if (!hash) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900">Validação de Documento</h1>
          <p className="mt-2 text-sm text-slate-500">Hash de validação não informado.</p>
        </div>
      </div>
    );
  }

  const url = await getAbsoluteUrlServer(`/api/public/documentos/${publicId}?hash=${hash}`);
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as ValidationResponse;

  const valid = Boolean(data.ok && data.valid);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-semibold">
            AO
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Validação de Documento</h1>
            <p className="text-xs text-slate-500">República de Angola · Ministério da Educação</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className={`text-sm font-semibold ${valid ? "text-emerald-600" : "text-red-600"}`}>
            {valid ? "Documento válido" : "Documento inválido ou não encontrado"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Este verificador confirma autenticidade por hash registrado no sistema.
          </p>
        </div>

        {valid && (
          <div className="mt-5 space-y-2 text-sm text-slate-700">
            <p><strong>Escola:</strong> {data.escola}</p>
            <p><strong>Aluno:</strong> {data.aluno}</p>
            <p><strong>Tipo:</strong> {data.tipo}</p>
            <p><strong>Emitido em:</strong> {data.created_at ? new Date(data.created_at).toLocaleString("pt-PT") : "—"}</p>
          </div>
        )}

        {!valid && data.error ? (
          <p className="mt-4 text-xs text-slate-400">{data.error}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
          <span>KLASSE · Documento Oficial</span>
          <span>Verificação segura</span>
        </div>
      </div>
    </div>
  );
}
