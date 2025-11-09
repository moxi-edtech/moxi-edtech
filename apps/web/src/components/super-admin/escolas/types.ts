export type School = {
  id: string | number;
  name: string;
  status: "ativa" | "suspensa" | "pendente" | string;
  plan: "Enterprise" | "Premium" | "Básico" | string;
  lastAccess: string | null;
  students: number;
  teachers: number;
  city: string;
  state: string;
  email: string;
  telefone: string;
  responsavel: string;
};

export type OnboardingProgress = {
  escola_id: string;
  nome: string | null;
  onboarding_finalizado: boolean;
  last_step: number | null;
  last_updated_at: string | null;
}

export type SchoolsTableProps = {
  initialSchools: School[];
  initialProgress: Record<string, OnboardingProgress>;
  initialErrorMsg?: string | null;
  fallbackSource?: string | null;
}

export type EditForm = Partial<School>;