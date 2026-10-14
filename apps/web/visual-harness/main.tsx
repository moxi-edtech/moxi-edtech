import React from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
import {
  DocumentosPendentes, DocumentosRejeitados, NotasPagas, ProfessorComTurmas, DashboardClean, DashboardPending, DashboardRejected, DashboardRematricula, DashboardOverdue, DashboardEmpty,
} from "../src/components/aluno/PortalVisualFixtures.stories";

const stories: Record<string, { render?: (...args: unknown[]) => React.ReactNode }> = {
  "documentos-pendentes": DocumentosPendentes,
  "documentos-rejeitados": DocumentosRejeitados,
  "notas-pagas": NotasPagas,
  "professor-com-turmas": ProfessorComTurmas,
  "dashboard-clean": DashboardClean,
  "dashboard-pending": DashboardPending,
  "dashboard-rejected": DashboardRejected,
  "dashboard-rematricula": DashboardRematricula,
  "dashboard-overdue": DashboardOverdue,
  "dashboard-empty": DashboardEmpty,
};
const name = new URLSearchParams(window.location.search).get("story") || "documentos-pendentes";
const Scene = stories[name]?.render;
const target = document.getElementById("root");
if (target && Scene) createRoot(target).render(<>{Scene()}</>);
else if (target) target.textContent = "Visual fixture not found";
