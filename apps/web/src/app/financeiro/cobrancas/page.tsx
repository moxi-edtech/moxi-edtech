"use client";

import { MessageCircle, Search } from "lucide-react";
import { useState } from "react";

export default function CobrancasPage() {
  const [search, setSearch] = useState("");

  return (
    <main className="space-y-6 p-4 md:p-6">
      {/* Título */}
      <div>
        <h1 className="text-xl font-bold text-moxinexa-navy">
          Histórico de Cobranças
        </h1>
        <p className="text-sm text-slate-500">
          Veja cobranças enviadas, respostas e pagamentos gerados.
        </p>
      </div>

      {/* Pesquisa */}
      <div className="relative w-full max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-lg focus:ring-2 focus:ring-moxinexa-teal"
          placeholder="Buscar por aluno ou responsável..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Placeholder */}
      <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center space-y-3">
        <MessageCircle className="h-8 w-8 mx-auto text-moxinexa-teal" />
        <h2 className="font-semibold text-moxinexa-navy">
          Em breve: Linha do Tempo de Cobranças
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Esta página mostrará cada cobrança enviada via WhatsApp, status, respostas, cliques e pagamentos gerados.
        </p>
      </section>
    </main>
  );
}
