export type RawDossierPerfil = {
  nome_completo?: string | null;
  nome?: string | null;
  foto_url?: string | null;
  status?: string | null;
  numero_processo?: string | null;
  bi_numero?: string | null;
  data_nascimento?: string | null;
  encarregado_nome?: string | null;
  responsavel?: string | null;
  encarregado_telefone?: string | null;
  telefone_responsavel?: string | null;
  endereco?: string | null;
  endereco_bairro?: string | null;
  provincia?: string | null;
  provincia_residencia?: string | null;
};

export type RawDossierHistoricoItem = {
  status?: string | null;
  ano_letivo?: string | number | null;
  turma?: string | null;
  turma_codigo?: string | null;
  turma_code?: string | null;
  numero_matricula?: string | null;
  matricula_id?: string | null;
  turno?: string | null;
  classe?: string | null;
  curso?: string | null;
  curso_nome?: string | null;
  curso_codigo?: string | null;
  curso_code?: string | null;
};

export type RawDossierMensalidade = {
  id?: string | null;
  status?: string | null;
  mes?: number | null;
  mes_referencia?: number | null;
  ano?: number | null;
  ano_referencia?: number | null;
  valor?: number | null;
  pago?: number | null;
  valor_pago_total?: number | null;
  vencimento?: string | null;
  data_vencimento?: string | null;
  pago_em?: string | null;
};

export type RawDossierFinanceiro = {
  total_em_atraso?: number | null;
  total_pago?: number | null;
  mensalidades?: RawDossierMensalidade[] | null;
};

export type RawDossier = {
  perfil: RawDossierPerfil;
  historico: RawDossierHistoricoItem[];
  financeiro: RawDossierFinanceiro;
};

export type DossierStatus = "ativo" | "inativo" | "arquivado" | "pendente" | string;
export type SituacaoFinanceira = "em_dia" | "inadimplente";

export type DossierPerfil = {
  nome: string;
  foto_url: string | null;
  status: DossierStatus;
  numero_processo: string | null;
  bi_numero: string | null;
  data_nascimento: string | null;
  responsavel_nome: string | null;
  responsavel_tel: string | null;
  endereco: string | null;
  endereco_bairro: string | null;
  provincia: string | null;
};

export type DossierMatricula = {
  ano_letivo: string;
  turma: string;
  turma_codigo: string | null;
  turno: string | null;
  numero_matricula: string | null;
  matricula_id: string | null;
  classe: string | null;
  curso: string | null;
  curso_codigo: string | null;
  status: DossierStatus;
  is_atual: boolean;
};

export type DossierMensalidade = {
  id: string;
  status: string;
  mes: number;
  ano: number;
  valor: number;
  pago: number;
  saldo: number;
  vencimento: string | null;
  pago_em: string | null;
  atrasada: boolean;
};

export type DossierFinanceiro = {
  total_em_atraso: number;
  total_pago: number;
  situacao: SituacaoFinanceira;
  mensalidades: DossierMensalidade[];
  mensalidades_pendentes: DossierMensalidade[];
  mensalidades_atrasadas: DossierMensalidade[];
};

export type DossierPendenciaTipo =
  | "bi_em_falta"
  | "responsavel_em_falta"
  | "contacto_em_falta"
  | "endereco_em_falta"
  | "financeiro_em_atraso"
  | "sem_historico_matricula";

export type DossierPendencia = {
  tipo: DossierPendenciaTipo;
  label: string;
  nivel: "critico" | "aviso";
};

export type AlunoNormalizado = {
  id: string;
  perfil: DossierPerfil;
  historico: DossierMatricula[];
  financeiro: DossierFinanceiro;
  matricula_atual: DossierMatricula | null;
  pendencias: DossierPendencia[];
};
