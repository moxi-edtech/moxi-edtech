// apps/web/src/types/turmas.ts

// This is the canonical type for a Turma item in the UI.
// It combines the data fetched for the list and the data used in the form.
export interface TurmaItem {
  id: string;
  nome: string;
  turma_codigo?: string;
  turno?: string;
  sala?: string;
  capacidade_maxima?: number;
  ano_letivo?: number | null; // Corrected to be number | null based on DB
  status_validacao?: 'ativo' | 'rascunho' | 'arquivado' | string;
  session_id?: string;
  curso_id?: string;
  classe_id?: string;
  
  // Properties from TurmasListClient
  ocupacao_atual?: number;
  classe_nome?: string;
  curso_nome?: string;

  // Properties from TurmaForm
  metadata?: {
    importacao_config?: {
      skip_matricula: boolean;
      mes_inicio: number;
    };
  };
}
