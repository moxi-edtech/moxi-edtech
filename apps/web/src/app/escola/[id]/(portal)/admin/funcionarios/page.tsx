"use client";

"use client";

import { useState } from "react";
import FuncionariosPage from "../../funcionarios/page";
import NovoFuncionarioPage from "../../funcionarios/novo/page";

export default function AdminFuncionariosPage() {
  const [tab, setTab] = useState<"listar" | "cadastrar">("listar");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("listar")}
          className={`px-6 py-3 font-medium relative ${
            tab === "listar" ? "text-klasse-gold" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Funcionários
          {tab === "listar" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-klasse-gold" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("cadastrar")}
          className={`px-6 py-3 font-medium relative ${
            tab === "cadastrar" ? "text-klasse-gold" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Cadastrar
          {tab === "cadastrar" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-klasse-gold" />
          )}
        </button>
      </div>

      {tab === "listar" ? <FuncionariosPage embedded /> : <NovoFuncionarioPage embedded />}
    </div>
  );
}
