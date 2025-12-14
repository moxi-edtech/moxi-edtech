// src/lib/courseTypes.ts

import {
  BookOpen,
  Layers,
  ScrollText,
  Wrench,
} from "lucide-react";
import type { CurriculumKey } from "@/lib/academico/curriculum-presets";

// Tipos de curso que vamos usar em toda a app
export type CourseType =
  | "primario"
  | "ciclo1"
  | "puniv"
  | "tecnico"
  | "geral"
  | "tecnico_ind"
  | "tecnico_serv";

// Mapeia cada preset oficial para um tipo estável
export const PRESET_TO_TYPE: Record<CurriculumKey, CourseType> = {
  // Primário
  primario_base: "primario",
  primario_avancado: "primario",

  // 1º Ciclo
  ciclo1: "ciclo1",

  // PUNIV / II Ciclo
  puniv: "puniv",
  economicas: "puniv",

  // Técnicos (inclui saúde)
  tecnico_informatica: "tecnico",
  tecnico_gestao: "tecnico",
  tecnico_construcao: "tecnico",
  tecnico_base: "tecnico",
  saude_enfermagem: "tecnico",
  saude_farmacia_analises: "tecnico",
};

// Ícones baseados no tipo
export const TYPE_ICONS: Record<CourseType, React.ComponentType<any>> = {
  primario: BookOpen,
  ciclo1: Layers,
  puniv: ScrollText,
  tecnico: Wrench,
  geral: BookOpen,
  tecnico_ind: Wrench,
  tecnico_serv: ScrollText,
};

// Paleta de cores por tipo (classes Tailwind)
export const TYPE_COLORS: Record<
  CourseType,
  { bgLight: string; border: string; text: string }
> = {
  primario: {
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  ciclo1: {
    bgLight: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
  },
  puniv: {
    bgLight: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
  },
  tecnico: {
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  geral: {
    bgLight: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
  },
  tecnico_ind: {
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  tecnico_serv: {
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
};

// Helper: devolve o ícone correto para um curso
export const getCourseIcon = (label: string, tipo: CourseType) => {
  const Icon = TYPE_ICONS[tipo];
  return Icon;
};

// 🔹 O CARA QUE ESTAVA A FALTAR
export const getTypeLabel = (tipo: CourseType): string => {
  switch (tipo) {
    case "primario":
      return "Ensino Primário";
    case "ciclo1":
      return "I Ciclo (7ª–9ª)";
    case "puniv":
      return "II Ciclo / PUNIV";
    case "tecnico":
      return "Ensino Técnico & Profissional";
    case "geral":
      return "Ensino Geral";
    case "tecnico_ind":
      return "Técnico Industrial";
    case "tecnico_serv":
      return "Técnico Serviços / Saúde";
  }
};
