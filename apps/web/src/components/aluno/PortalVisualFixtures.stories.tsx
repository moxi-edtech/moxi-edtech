"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider } from "@/components/feedback/FeedbackSystem";
import { TabDocumentos } from "@/components/aluno/tabs/TabDocumentos";
import { AcademicoWorkspace } from "@/components/aluno/academico/AcademicoWorkspace";
import { TabNotas } from "@/components/aluno/tabs/TabNotas";
import ProfessorPage from "@/app/professor/page";
import DashboardLoader from "@/components/aluno/dashboard/DashboardLoader";
import { Notice } from "@/components/ui/alert";
import { FinanceAlertBanner } from "@/components/aluno/home/FinanceAlertBanner";
import { RematriculaBanner } from "@/components/aluno/home/RematriculaBanner";

// Storybook/CI only. These UUIDs and labels are synthetic; no Supabase credentials,
// production students, payment evidence, or network calls are used as fixture data.
const SCHOOL = "00000000-0000-4000-8000-000000000401";
const STUDENT = "00000000-0000-4000-8000-000000000402";
const INTENT = "00000000-0000-4000-8000-000000000403";
type FixtureMode = "academic-tabs" | "pending" | "rejected" | "paid" | "professor" | "dashboard-clean" | "dashboard-pending" | "dashboard-rejected" | "dashboard-rematricula" | "dashboard-overdue" | "dashboard-empty" | "dashboard-approved" | "grade-paid" | "grade-unpaid" | "grade-pending" | "grade-rejected" | "grade-empty" | "notice-info" | "notice-attention" | "notice-critical" | "notice-success" | "notice-rematricula" | "notice-finance";
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
      valor: 1500, status: ["paid", "grade-paid", "grade-empty"].includes(mode) ? "granted" : ["rejected", "grade-rejected"].includes(mode) ? "rejected" : mode === "grade-unpaid" ? "available" : "pending",
      pedido_id: "fixture-order", pagamento_intent_id: INTENT,
      exige_pagamento_antes_de_liberar: true, pagamento_configurado: true,
      reject_reason: ["rejected", "grade-rejected"].includes(mode) ? "O ficheiro enviado não estava legível." : null,
    };
    const dashboardMode = mode.startsWith("dashboard-");
    const docsStatus = mode === "dashboard-rejected" ? "rejected" : mode === "dashboard-pending" ? "pending" : "granted";
    const documents = dashboardMode && (mode === "dashboard-clean" || mode === "dashboard-rematricula" || mode === "dashboard-overdue" || mode === "dashboard-empty" || mode === "dashboard-approved") ? [] : [{ ...doc, status: dashboardMode ? docsStatus : doc.status, reject_reason: mode === "dashboard-rejected" ? "O comprovativo não está legível." : doc.reject_reason }];
    const replies: Record<string, object> = {
      "/api/aluno/dashboard": { ok: true, ano_letivo: mode === "dashboard-empty" ? null : 2026, turma_nome: mode === "dashboard-empty" ? null : "7.ª Classe A",
        proxima_aula: mode === "dashboard-empty" ? null : { weekday: 3, inicio: "08:00", fim: "09:00", sala: "04", slot_id: "slot-fixture" },
        status_financeiro: { pendentes: mode === "dashboard-overdue" ? 1 : 0 },
        avisos_recentes: mode === "dashboard-empty" ? [] : [{ id: "synthetic-notice", titulo: "Reunião de encarregados", resumo: "Comunicado de testes.", origem: "Secretaria", data: "2026-10-13T12:00:00Z" }] },
      "/api/aluno/home/raa-status": { ok: true, result: null },
      "/api/aluno/rematricula/status": { ok: true, eligible: ["dashboard-rematricula", "notice-rematricula"].includes(mode), alreadyDone: false, nextAno: 2027, hasDebt: false, rematricula: { service: { id: "fixture-enrol", nome: "Rematrícula", valor: 2500 }, services: [] } },

      "/api/aluno/documentos/catalogo": { ok: true, documentos: documents, dados_pagamento: { banco: "Banco de Teste", iban: "AO00 0000 0000 0000 0000 0000 0" }, boletim_pago: ["paid", "grade-paid", "grade-empty"].includes(mode) },
      "/api/aluno/boletim": { ok: true, matricula_encontrada: true, is_liberado: ["paid", "grade-paid", "grade-empty"].includes(mode), nome_aluno: mode === "dashboard-empty" ? null : "Aluno de Teste", disciplinas: mode === "grade-empty" ? [] : ["paid", "grade-paid"].includes(mode) ? [
        { id: "disc-1", nome: "Matemática", avaliacoes: [{ nome: "Prova trimestral", tipo: "prova", trimestre: 1, nota: 16 }, { nome: "Exame do período", tipo: "exame", trimestre: 2, nota: 15 }] },
        { id: "disc-2", nome: "Língua Portuguesa", avaliacoes: [{ nome: "Trabalho prático", tipo: "trabalho", trimestre: 1, nota: 17 }] },
      ] : [] },
      "/api/aluno/raa/melhoria": { ok: true, sessoes: [] },
      "/api/aluno/raa/dependencias": { ok: true, summary: { total: 0, abertas: 0, resolvidas: 0 }, items: [] },
      "/api/aluno/disciplinas": { ok: true, disciplinas: [{ id: "disc-1", nome: "Matemática" }, { id: "disc-2", nome: "Língua Portuguesa" }, { id: "disc-3", nome: "Biologia" }], context: { anoLetivoLabel: "2026" } },
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

export const AcademicoAcessivel: Story = { render: () => <Surface mode="academic-tabs"><AcademicoWorkspace /></Surface> };
export const DocumentosPendentes: Story = { render: () => <Surface mode="pending"><TabDocumentos /></Surface> };
export const DocumentosRejeitados: Story = { render: () => <Surface mode="rejected"><TabDocumentos /></Surface> };
export const NotasPagas: Story = { render: () => <Surface mode="paid"><TabNotas /></Surface> };
export const ProfessorComTurmas: Story = { render: () => <Surface mode="professor"><ProfessorPage /></Surface> };

export const DashboardClean: Story = { render: () => <Surface mode="dashboard-clean"><DashboardLoader /></Surface> };
export const DashboardPending: Story = { render: () => <Surface mode="dashboard-pending"><DashboardLoader /></Surface> };
export const DashboardRejected: Story = { render: () => <Surface mode="dashboard-rejected"><DashboardLoader /></Surface> };
export const DashboardRematricula: Story = { render: () => <Surface mode="dashboard-rematricula"><DashboardLoader /></Surface> };
export const DashboardOverdue: Story = { render: () => <Surface mode="dashboard-overdue"><DashboardLoader /></Surface> };
export const DashboardEmpty: Story = { render: () => <Surface mode="dashboard-empty"><DashboardLoader /></Surface> };
export const DashboardApproved: Story = { render: () => <Surface mode="dashboard-approved"><DashboardLoader /></Surface> };

export const GradePaid: Story = { render: () => <Surface mode="grade-paid"><TabNotas /></Surface> };
export const GradeUnpaid: Story = { render: () => <Surface mode="grade-unpaid"><TabNotas /></Surface> };
export const GradePending: Story = { render: () => <Surface mode="grade-pending"><TabNotas /></Surface> };
export const GradeRejected: Story = { render: () => <Surface mode="grade-rejected"><TabNotas /></Surface> };
export const GradeEmpty: Story = { render: () => <Surface mode="grade-empty"><TabNotas /></Surface> };

// All examples are synthetic. The same component powers the live portal consumers.
export const NoticeInformativo: Story = { render: () => <Surface mode="notice-info"><Notice title="Informação escolar" eyebrow="Secretaria" description="Comunicado fictício para validação visual." tone="neutral" action={<button type="button" className="rounded-xl bg-[#2B6044] px-4 py-3 text-white">Consultar</button>} /></Surface> };
export const NoticeAtencao: Story = { render: () => <Surface mode="notice-attention"><Notice title="Atenção ao prazo" eyebrow="Secretaria" description="Verifica os documentos pendentes." tone="attention" action={<button type="button" className="rounded-xl bg-[#2B6044] px-4 py-3 text-white">Ver documentos</button>} /></Surface> };
export const NoticeCritico: Story = { render: () => <Surface mode="notice-critical"><Notice title="Pedido rejeitado" eyebrow="Documentos" description="O comprovativo não está legível. Reenvia no mesmo pedido." tone="critical" role="alert" /></Surface> };
export const NoticeSucesso: Story = { render: () => <Surface mode="notice-success"><Notice title="Pedido concluído" eyebrow="Secretaria" description="O teu pedido fictício foi concluído." tone="success" role="status" /></Surface> };
export const NoticeRematricula: Story = { render: () => <Surface mode="notice-rematricula"><RematriculaBanner /></Surface> };
export const NoticeFinanceiro: Story = { render: () => <Surface mode="notice-finance"><FinanceAlertBanner loading={false} alert={{ id: "fixture-payment", valor: 2500, mes: "Outubro" }} /></Surface> };
