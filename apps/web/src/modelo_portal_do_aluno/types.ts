// src/components/aluno/types.ts
// Tipos partilhados por todos os componentes do portal do aluno

export type Educando = {
  id: string;
  nome: string;
  classe: string;
  turma: string;
  avatar: string;
  cor: string;
  escola_id?: string | null;
};

export type Nota = {
  disciplina: string;
  nota: number;
  max: number;
  professor: string;
  trimestre?: string;
};

export type Pagamento = {
  id: string | number;
  descricao: string;
  valor: number;
  status: "pago" | "pendente" | "cancelado";
  data: string;
};

export type Presenca = {
  mes: string;
  presentes: number;
  total: number;
  faltas: number;
};

export type Notificacao = {
  id: string | number;
  tipo: "nota" | "pagamento" | "evento" | "aviso";
  titulo: string;
  desc: string;
  tempo: string;
  lida: boolean;
};

export type Documento = {
  titulo: string;
  desc: string;
  pronto: boolean;
  url?: string;
};

export type TabId = "home" | "notas" | "financeiro" | "documentos" | "notificacoes";
