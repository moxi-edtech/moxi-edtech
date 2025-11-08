// src/components/layout/escola-admin/definitions.ts
import { ComponentType, SVGProps } from "react";

export type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export type KPI = {
  titulo: string;
  valor: string | number;
  icone?: IconType;
  bg?: string;
  color?: string;
};

export type Aviso = {
  id: string;
  titulo: string;
  dataISO: string;     // ex: "2025-09-25"
  icone?: IconType;
  bg?: string;
  color?: string;
};

export type Evento = {
  id: string;
  titulo: string;
  dataISO: string;     // ex: "2025-10-05"
  icone?: IconType;
  bg?: string;
  color?: string;
};

export type AcaoRapida = {
  id: string;
  rotulo: string;
  icone: IconType;
  iconeExtra?: IconType; // para PlusIcon e similares
  href?: string;         
  className?: string;    
};

export type PagamentosResumo = {
  pago: number;
  pendente: number;
  inadimplente: number;
};

export const CORES_MOXI = {
  primary: "#0B2C45",
  primary2: "#0D4C73",
  accent: "#0D9488",
  warn: "#F97316",
} as const;

export const MESES_PT_CURTOS = [
  "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"
];

export function formatarDataBr(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
