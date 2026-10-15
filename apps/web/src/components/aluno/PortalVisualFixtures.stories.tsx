"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider } from "@/components/feedback/FeedbackSystem";
import { TabDocumentos } from "@/components/aluno/tabs/TabDocumentos";
import { TabNotas } from "@/components/aluno/tabs/TabNotas";
import ProfessorPage from "@/app/professor/page";

// Storybook/CI only. These UUIDs and labels are synthetic; no Supabase credentials,
// production students, payment evidence, or network calls are used as fixture data.
const SCHOOL = "00000000-0000-4000-8000-000000000401";
const STUDENT = "00000000-0000-4000-8000-000000000402";
const INTENT = "00000000-0000-4000-8000-000000000403";
type FixtureMode = "pending" | "rejected" | "paid" | "professor";
declare global {
  interface Window { __klasseVisualFixture?: FixtureMode; __klasseVisualFetchInstalled?: boolean }
}

if (typeof window !== "undefined" && !window.__klasseVisualFetchInstalled) {
  window.__klasseVisualFetchInstalled = true;
  const liveFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = target.startsWith("/") ? target.split("?")[0] : new URL(target).pathname;
    const mode = window.__klasseVisualFixture ?? "pending";
    const doc = {
      id: "fixture-service", codigo: "DOC_BOLETIM_TRIMESTRAL",
      nome: "Boletim de notas trimestral", descricao: "Notas efetivamente lançadas.",
      valor: 1500, status: mode === "paid" ? "granted" : mode === "rejected" ? "rejected" : "pending",
      pedido_id: "fixture-order", pagamento_intent_id: INTENT,
      exige_pagamento_antes_de_liberar: true, pagamento_configurado: true,
      reject_reason: mode === "rejected" ? "O ficheiro enviado não estava legível." : null,
    };
    const replies: Record<string, object> = {
      "/api/aluno/documentos/catalogo": { ok: true, documentos: [doc], dados_pagamento: { banco: "Banco de Teste", iban: "AO00 0000 0000 0000 0000 0000 0" }, boletim_pago: mode === "paid" },
      "/api/aluno/boletim": { ok: true, matricula_encontrada: true, is_liberado: mode === "paid", nome_aluno: "Aluno de Teste", disciplinas: mode === "paid" ? [
        { id: "disc-1", nome: "Matemática", avaliacoes: [{ nome: "Prova trimestral", tipo: "prova", trimestre: 1, nota: 16 }] },
        { id: "disc-2", nome: "Língua Portuguesa", avaliacoes: [{ nome: "Trabalho prático", tipo: "trabalho", trimestre: 1, nota: 17 }] },
      ] : [] },
      "/api/aluno/raa/dependencias": { ok: true, summary: { total: 0, abertas: 0, resolvidas: 0 }, items: [] },
      "/api/aluno/disciplinas": { ok: true, disciplinas: [] },
      "/api/professor/atribuicoes": { ok: true, items: [
        { turma: { id: "turma-fixture", nome: "7ª Classe A" }, disciplina: { id: "disc-mat", nome: "Matemática" } },
        { turma: { id: "turma-fixture", nome: "7ª Classe A" }, disciplina: { id: "disc-por", nome: "Língua Portuguesa" } },
      ] },
      "/api/professor/agenda": { ok: true, items: [] },
      "/api/professor/aulas": { ok: true, items: [] },
      "/api/professor/dashboard/pendencias": { ok: true, avaliacoes_pendentes: 2, faltas_a_lancar: 0 },
      "/api/professor/dashboard/overview": { ok: true, escola_nome: "Escola Fictícia de Testes", primeiro_nome: "Professor" },
    };
    const responseKey = Object.keys(replies).find(key => path === key);
    if (responseKey) {
      return Promise.resolve(new Response(JSON.stringify(replies[responseKey]), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    // Allow Storybook's internal requests. Never redirect fixtures to production APIs.
    return liveFetch(input, init);
  };
}

const Surface = ({ children }: { mode: FixtureMode; children: React.ReactNode }) => {
  return <ToastProvider><main className="mx-auto min-h-screen max-w-6xl bg-slate-50 p-3 sm:p-6">{children}</main></ToastProvider>;
};

const meta: Meta = { title: "KLASSE/Portal Visual Fixtures", parameters: { nextjs: { appDirectory: true }, layout: "fullscreen" } };
export default meta;
type Story = StoryObj;

export const DocumentosPendentes: Story = { render: () => <Surface mode="pending"><TabDocumentos /></Surface> };
export const DocumentosRejeitados: Story = { render: () => <Surface mode="rejected"><TabDocumentos /></Surface> };
export const NotasPagas: Story = { render: () => <Surface mode="paid"><TabNotas /></Surface> };
export const ProfessorComTurmas: Story = { render: () => <Surface mode="professor"><ProfessorPage /></Surface> };
