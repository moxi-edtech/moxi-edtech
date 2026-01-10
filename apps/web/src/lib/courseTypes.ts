// src/lib/courseTypes.ts

import {
  BookOpen,
  Layers,
  ScrollText,
  Wrench,
  HeartPulse, // Novo para Saúde (se disponível, senão use Activity)
  HardHat,    // Novo para Indústria (se disponível, senão use Hammer)
  GraduationCap // Novo para Magistério
} from "lucide-react";
import type { CurriculumKey } from "@/lib/academico/curriculum-presets";

// Tipos de curso que vamos usar em toda a app
export type CourseType =
  | "primario"
  | "ciclo1"
  | "puniv"
  | "tecnico"        // Informática, Gestão
  | "tecnico_ind"    // Industrial (Civil, Mecânica, Energia)
  | "tecnico_saude"  // Novo: Saúde merece destaque
  | "magisterio"     // Novo: Formação de Professores
  | "geral";         // Fallback

// Mapeia cada preset oficial para um tipo estável
export const PRESET_TO_TYPE: Record<CurriculumKey, CourseType> = {
  // === GERAL ===
  primario_base: "primario",
  primario_avancado: "primario",
  ciclo1: "ciclo1",

  // === PUNIV ===
  puniv_fisicas: "puniv",
  puniv_economicas: "puniv",
  puniv_humanas: "puniv",
  puniv_artes: "puniv",

  // === TÉCNICO GERAL ===
  tecnico_informatica: "tecnico",
  tecnico_gestao: "tecnico",
  tecnico_base: "tecnico",

  // === TÉCNICO INDUSTRIAL ===
  tecnico_construcao: "tecnico_ind",
  tecnico_electricidade: "tecnico_ind",
  tecnico_mecanica: "tecnico_ind",
  tecnico_electronica: "tecnico_ind",
  tecnico_petroleos: "tecnico_ind",

  // === SAÚDE ===
  saude_enfermagem: "tecnico_saude",
  saude_farmacia_analises: "tecnico_saude",

  // === MAGISTÉRIO ===
  magisterio_primario: "magisterio",
};

// Ícones baseados no tipo
export const TYPE_ICONS: Record<CourseType, React.ComponentType<any>> = {
  primario: BookOpen,
  ciclo1: Layers,
  puniv: ScrollText,
  tecnico: Wrench,          // Informática/Gestão
  tecnico_ind: HardHat,     // Industrial (Capacete) ou Wrench
  tecnico_saude: HeartPulse, // Saúde
  magisterio: GraduationCap,// Pedagógico
  geral: BookOpen,
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
  tecnico: { // Amarelo/Laranja para Técnico Geral
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  tecnico_ind: { // Slate/Cinza ou Laranja Escuro para Industrial
    bgLight: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
  },
  tecnico_saude: { // Ciano/Azul ou Rosa para Saúde
    bgLight: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
  },
  magisterio: { // Roxo para Educação
    bgLight: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
  },
  geral: {
    bgLight: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
  },
};

// Helper: devolve o ícone correto para um curso
export const getCourseIcon = (label: string, tipo: CourseType) => {
  return TYPE_ICONS[tipo] || BookOpen;
};

// Labels para UI
export const getTypeLabel = (tipo: CourseType): string => {
  switch (tipo) {
    case "primario":
      return "Ensino Primário";
    case "ciclo1":
      return "I Ciclo (7ª–9ª)";
    case "puniv":
      return "II Ciclo / PUNIV";
    case "tecnico":
      return "Técnico Profissional";
    case "tecnico_ind":
      return "Instituto Industrial";
    case "tecnico_saude":
      return "Saúde";
    case "magisterio":
      return "Formação de Professores";
    case "geral":
      return "Ensino Geral";
    default:
      return "Curso";
  }
};