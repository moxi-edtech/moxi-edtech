"use client";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

import { useState } from "react";
import FuncionariosPage from "../../funcionarios/page";
import NovoFuncionarioPage from "../../funcionarios/novo/page";

export default function AdminFuncionariosPage() {
  const [tab, setTab] = useState<"listar" | "cadastrar">("listar");

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-6`}>
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("listar")}
          className={`px-6 py-3 font-medium relative ${
            tab === "listar" ? "text-amber" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Funcionários
          {tab === "listar" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("cadastrar")}
          className={`px-6 py-3 font-medium relative ${
            tab === "cadastrar" ? "text-amber" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Cadastrar
          {tab === "cadastrar" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />
          )}
        </button>
      </div>

      {tab === "listar" ? <FuncionariosPage embedded /> : <NovoFuncionarioPage embedded />}
    </div>
  );
}
