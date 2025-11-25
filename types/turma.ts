export interface Turno {
  id?: string;
  codigo?: string | null; // "M", "T", "N"
  nome?: string | null;   // "Manhã"
}

export interface Curso {
  id: string;
  codigo?: string | null; // "EMG", "CTI", etc.
  nome: string;
}

export interface Classe {
  id: string;
  numero?: number | null; // 7, 8, 9, 10 ...
  nome: string;           // "10ª classe"
}

export interface Turma {
  id: string;
  nome: string; // "A", "AB", "ABNG", etc.
  escola_id?: string;
  ano_letivo?: number | null;

  curso?: Curso | null;
  classe?: Classe | null;
  turno?: Turno | null;
}
