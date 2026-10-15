import React from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
import {
  DocumentosPendentes, DocumentosRejeitados, NotasPagas, ProfessorComTurmas,
} from "../src/components/aluno/PortalVisualFixtures.stories";

const stories: Record<string, { render?: (...args: unknown[]) => React.ReactNode }> = {
  "documentos-pendentes": DocumentosPendentes,
  "documentos-rejeitados": DocumentosRejeitados,
  "notas-pagas": NotasPagas,
  "professor-com-turmas": ProfessorComTurmas,
};
const name = new URLSearchParams(window.location.search).get("story") || "documentos-pendentes";
const mode: Record<string, NonNullable<Window["__klasseVisualFixture"]>> = {"documentos-pendentes":"pending","documentos-rejeitados":"rejected","notas-pagas":"paid","professor-com-turmas":"professor"};
window.__klasseVisualFixture = mode[name] ?? "pending";
const Scene = stories[name]?.render;
const target = document.getElementById("root");
if (target && Scene) createRoot(target).render(<>{Scene()}</>);
else if (target) target.textContent = "Visual fixture not found";
