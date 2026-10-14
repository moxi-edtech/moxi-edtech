import React from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
import {
  DocumentosPendentes, DocumentosRejeitados, NotasPagas, ProfessorComTurmas, GradePaid, GradeUnpaid, GradePending, GradeRejected, GradeEmpty,
} from "../src/components/aluno/PortalVisualFixtures.stories";

const stories: Record<string, { render?: (...args: unknown[]) => React.ReactNode }> = {
  "documentos-pendentes": DocumentosPendentes,
  "documentos-rejeitados": DocumentosRejeitados,
  "notas-pagas": NotasPagas,
  "professor-com-turmas": ProfessorComTurmas,
  "grade-paid": GradePaid,
  "grade-unpaid": GradeUnpaid,
  "grade-pending": GradePending,
  "grade-rejected": GradeRejected,
  "grade-empty": GradeEmpty,
};
const name = new URLSearchParams(window.location.search).get("story") || "documentos-pendentes";
const fixtureMode: Record<string, NonNullable<Window["__klasseVisualFixture"]>> = {
  "documentos-pendentes":"pending","documentos-rejeitados":"rejected",
  "notas-pagas":"paid","professor-com-turmas":"professor",
  "grade-paid":"grade-paid","grade-unpaid":"grade-unpaid","grade-pending":"grade-pending","grade-rejected":"grade-rejected","grade-empty":"grade-empty",
};
window.__klasseVisualFixture = fixtureMode[name] ?? "pending";
const Scene = stories[name]?.render;
const target = document.getElementById("root");
if (target && Scene) createRoot(target).render(<>{Scene()}</>);
else if (target) target.textContent = "Visual fixture not found";
