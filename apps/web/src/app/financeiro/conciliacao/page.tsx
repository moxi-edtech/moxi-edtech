"use client";

import { Scale, Upload } from "lucide-react";

export default function ConciliacaoPage() {
  return (
    <main className="space-y-6 p-4 md:p-6">
      {/* Título */}
      <div>
        <h1 className="text-xl font-bold text-moxinexa-navy">Conciliação TPA</h1>
        <p className="text-sm text-slate-500">
          Compare os pagamentos no sistema com o extrato real da máquina TPA.
        </p>
      </div>

      {/* Upload TPA */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-4 text-center">
        <Scale className="h-8 w-8 mx-auto text-moxinexa-teal mb-2" />

        <h2 className="font-semibold text-moxinexa-navy">Importar Extrato TPA</h2>

        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Envie o ficheiro CSV ou PDF exportado do TPA/Multicaixa para identificar divergências automaticamente.
        </p>

        <label className="cursor-pointer inline-flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-moxinexa-teal transition-all">
          <Upload className="h-6 w-6 text-moxinexa-teal" />
          <span className="text-sm font-medium">Carregar extrato</span>
          <input type="file" accept=".csv,.pdf" className="hidden" />
        </label>

        <p className="text-xs text-slate-400">
          Suporta: .csv • .pdf • Multicaixa Express • TPA físico
        </p>
      </div>

      {/* Placeholder de conciliação */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-moxinexa-navy">Em breve:</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>✔ Comparação automática sistema × extrato</li>
          <li>✔ Identificação de pagamentos duplicados</li>
          <li>✔ Alertas sobre valores divergentes</li>
          <li>✔ Reconciliação automática com supabase functions</li>
        </ul>
      </section>
    </main>
  );
}
