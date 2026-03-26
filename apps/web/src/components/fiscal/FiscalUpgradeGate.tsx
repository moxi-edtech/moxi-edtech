"use client";

import { Vault } from "lucide-react";

export function FiscalUpgradeGate() {
  return (
    <section className="grid min-h-[65vh] place-items-center rounded-xl border border-slate-200 bg-white p-6">
      <div className="mx-auto max-w-md text-center">
        <Vault className="mx-auto h-12 w-12 text-slate-300" />
        <h2 className="mt-4 font-sora text-2xl font-semibold text-slate-900">Blindagem Fiscal AGT</h2>
        <p className="mt-2 text-sm text-slate-500">Disponível no Plano Premium.</p>
        <a
          href="/planos?highlight=premium"
          className="mt-5 inline-flex rounded-xl bg-[#E3B23C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c99c31]"
        >
          Fazer Upgrade
        </a>
      </div>
    </section>
  );
}
