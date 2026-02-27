// ==========================================
// TYPES & CONSTANTS
// ==========================================

export type CurriculumKey =
  | "primario_generico"
  | "esg_ciclo1"
  | "esg_puniv_cfb"
  | "esg_puniv_cej"
  | "esg_puniv_cch"
  | "esg_puniv_artes"
  | "tec_construcao_civil"
  | "tec_desenhador_projectista"
  | "tec_energia_eletrica"
  | "tec_energias_renovaveis"
  | "tec_electronica_telecom"
  | "tec_electronica_automacao"
  | "tec_geologia_petroleo"
  | "tec_perfuracao_producao"
  | "tec_minas"
  | "tec_mecanica_manut"
  | "tec_producao_metalomecanica"
  | "tec_informatica"
  | "tec_gestao_sistemas"
  | "tec_informatica_sistemas"
  | "tec_contabilidade"
  | "tec_informatica_gestao"
  | "tec_recursos_humanos"
  | "tec_secretariado"
  | "tec_financas"
  | "tec_comercio"
  | "tec_saude_analises"
  | "tec_saude_enfermagem"
  | "tec_saude_estomatologia"
  | "tec_saude_farmacia"
  | "tec_saude_fisioterapia"
  | "tec_saude_nutricao"
  | "tec_saude_radiologia";

export type DisciplineComponent =
  | "GERAL"
  | "SOCIO_CULTURAL"
  | "CIENTIFICA"
  | "TECNICA"
  | "ESPECIFICA";

export type CurriculumDisciplineBlueprint = {
  nome: string;
  classe: string;
  componente: DisciplineComponent;
  horas: number;
  tipo?: "core" | "eletivo" | "projeto" | "estagio";
};

const d = (
  nome: string,
  classe: string,
  horas: number,
  componente: DisciplineComponent,
  extra?: Partial<CurriculumDisciplineBlueprint>
): CurriculumDisciplineBlueprint => ({ nome, classe, horas, componente, ...extra });

// ==========================================
// CURRICULUM PRESETS (DATABASE SEED)
// ==========================================

export const CURRICULUM_PRESETS: Record<CurriculumKey, CurriculumDisciplineBlueprint[]> = {
  // --------------------------------------------------------------------------
  // 1. ENSINO PRIMÁRIO (1ª à 6ª Classe)
  // Nota: Baseado no padrão nacional, pois o doc específico não foi anexado.
  // --------------------------------------------------------------------------
  primario_generico: [
    ...["1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe"].flatMap((classe) => [
      d("Língua Portuguesa", classe, 6, "GERAL"),
      d("Matemática", classe, 6, "GERAL"),
      d("Estudo do Meio", classe, 4, "GERAL"),
      d("Ed. Manual e Plástica", classe, 2, "GERAL"),
      d("Educação Física", classe, 2, "GERAL"),
    ]),
    ...["5ª Classe", "6ª Classe"].flatMap((classe) => [
      d("Língua Portuguesa", classe, 5, "GERAL"),
      d("Matemática", classe, 5, "GERAL"),
      d("Ciências da Natureza", classe, 3, "GERAL"),
      d("História e Geografia", classe, 3, "GERAL"),
      d("Ed. Moral e Cívica", classe, 1, "GERAL"),
      d("Ed. Visual e Tecnológica", classe, 2, "GERAL"),
      d("Educação Física", classe, 2, "GERAL"),
      d("Educação Musical", classe, 1, "GERAL"),
    ]),
  ],

  // --------------------------------------------------------------------------
  // 2. ENSINO SECUNDÁRIO GERAL - Iº CICLO (7ª à 9ª)
  // Fonte: Documento ESG Pág 22
  // --------------------------------------------------------------------------
  esg_ciclo1: [
    d("Língua Portuguesa", "7ª Classe", 3, "GERAL"),
    d("Língua Estrangeira", "7ª Classe", 3, "GERAL"),
    d("Matemática", "7ª Classe", 3, "GERAL"),
    d("Biologia", "7ª Classe", 2, "GERAL"),
    d("Física", "7ª Classe", 3, "GERAL"),
    d("Química", "7ª Classe", 2, "GERAL"),
    d("Geografia", "7ª Classe", 2, "GERAL"),
    d("História", "7ª Classe", 3, "GERAL"),
    d("Educação Física", "7ª Classe", 2, "GERAL"),
    d("Ed. Moral e Cívica", "7ª Classe", 1, "GERAL"),
    d("Ed. Visual e Plástica", "7ª Classe", 2, "GERAL"),
    d("Educação Laboral", "7ª Classe", 2, "GERAL"),
    d("Empreendedorismo", "7ª Classe", 2, "GERAL"),

    d("Língua Portuguesa", "8ª Classe", 3, "GERAL"),
    d("Língua Estrangeira", "8ª Classe", 3, "GERAL"),
    d("Matemática", "8ª Classe", 3, "GERAL"),
    d("Biologia", "8ª Classe", 2, "GERAL"),
    d("Física", "8ª Classe", 2, "GERAL"),
    d("Química", "8ª Classe", 3, "GERAL"),
    d("Geografia", "8ª Classe", 2, "GERAL"),
    d("História", "8ª Classe", 3, "GERAL"),
    d("Educação Física", "8ª Classe", 2, "GERAL"),
    d("Ed. Moral e Cívica", "8ª Classe", 1, "GERAL"),
    d("Ed. Visual e Plástica", "8ª Classe", 2, "GERAL"),
    d("Educação Laboral", "8ª Classe", 2, "GERAL"),
    d("Empreendedorismo", "8ª Classe", 2, "GERAL"),

    d("Língua Portuguesa", "9ª Classe", 3, "GERAL"),
    d("Língua Estrangeira", "9ª Classe", 3, "GERAL"),
    d("Matemática", "9ª Classe", 3, "GERAL"),
    d("Biologia", "9ª Classe", 3, "GERAL"),
    d("Física", "9ª Classe", 2, "GERAL"),
    d("Química", "9ª Classe", 2, "GERAL"),
    d("Geografia", "9ª Classe", 3, "GERAL"),
    d("História", "9ª Classe", 2, "GERAL"),
    d("Educação Física", "9ª Classe", 2, "GERAL"),
    d("Ed. Moral e Cívica", "9ª Classe", 1, "GERAL"),
    d("Ed. Visual e Plástica", "9ª Classe", 2, "GERAL"),
    d("Educação Laboral", "9ª Classe", 2, "GERAL"),
    d("Empreendedorismo", "9ª Classe", 2, "GERAL"),
  ],

  // --------------------------------------------------------------------------
  // 3. ENSINO SECUNDÁRIO GERAL - IIº CICLO (PUNIV)
  // Fonte: Documento ESG Pág 34-37
  // --------------------------------------------------------------------------
  esg_puniv_cfb: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 4, "CIENTIFICA"),
    d("Informática", "10ª Classe", 4, "CIENTIFICA"),
    d("Física", "10ª Classe", 4, "ESPECIFICA"),
    d("Química", "10ª Classe", 4, "ESPECIFICA"),
    d("Biologia", "10ª Classe", 4, "ESPECIFICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Filosofia", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Física", "11ª Classe", 4, "ESPECIFICA"),
    d("Química", "11ª Classe", 3, "ESPECIFICA"),
    d("Biologia", "11ª Classe", 4, "ESPECIFICA"),
    d("Geologia", "11ª Classe", 2, "ESPECIFICA"),
    d("Opção", "11ª Classe", 2, "ESPECIFICA"),

    d("Língua Portuguesa", "12ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "12ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Filosofia", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "12ª Classe", 3, "CIENTIFICA"),
    d("Física", "12ª Classe", 4, "ESPECIFICA"),
    d("Química", "12ª Classe", 3, "ESPECIFICA"),
    d("Biologia", "12ª Classe", 4, "ESPECIFICA"),
    d("Geologia", "12ª Classe", 2, "ESPECIFICA"),
    d("Opção", "12ª Classe", 2, "ESPECIFICA"),
  ],

  esg_puniv_cej: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 4, "CIENTIFICA"),
    d("Informática", "10ª Classe", 4, "CIENTIFICA"),
    d("Introdução ao Direito", "10ª Classe", 3, "ESPECIFICA"),
    d("Introdução à Economia", "10ª Classe", 3, "ESPECIFICA"),
    d("História", "10ª Classe", 3, "ESPECIFICA"),
    d("Geografia", "10ª Classe", 3, "ESPECIFICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Filosofia", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Introdução ao Direito", "11ª Classe", 3, "ESPECIFICA"),
    d("Introdução à Economia", "11ª Classe", 2, "ESPECIFICA"),
    d("História", "11ª Classe", 3, "ESPECIFICA"),
    d("Geografia", "11ª Classe", 3, "ESPECIFICA"),
    d("Opção", "11ª Classe", 2, "ESPECIFICA"),

    d("Língua Portuguesa", "12ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "12ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Filosofia", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Introdução ao Direito", "12ª Classe", 2, "ESPECIFICA"),
    d("Introdução à Economia", "12ª Classe", 3, "ESPECIFICA"),
    d("História", "12ª Classe", 3, "ESPECIFICA"),
    d("Geografia", "12ª Classe", 3, "ESPECIFICA"),
    d("Desenv. Económico e Social", "12ª Classe", 4, "ESPECIFICA"),
    d("Opção", "12ª Classe", 2, "ESPECIFICA"),
  ],

  esg_puniv_cch: [
    d("Língua Portuguesa", "10ª Classe", 4, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 4, "CIENTIFICA"),
    d("Língua Estrangeira II", "10ª Classe", 4, "ESPECIFICA"),
    d("História", "10ª Classe", 3, "ESPECIFICA"),
    d("Geografia", "10ª Classe", 3, "ESPECIFICA"),

    d("Língua Portuguesa", "11ª Classe", 4, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Filosofia", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 2, "CIENTIFICA"),
    d("Língua Estrangeira II", "11ª Classe", 4, "ESPECIFICA"),
    d("História", "11ª Classe", 3, "ESPECIFICA"),
    d("Geografia", "11ª Classe", 3, "ESPECIFICA"),
    d("Literatura", "11ª Classe", 2, "ESPECIFICA"),
    d("Opção", "11ª Classe", 2, "ESPECIFICA"),

    d("Língua Portuguesa", "12ª Classe", 4, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "12ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Filosofia", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Língua Estrangeira II", "12ª Classe", 4, "ESPECIFICA"),
    d("História", "12ª Classe", 3, "ESPECIFICA"),
    d("Geografia", "12ª Classe", 3, "ESPECIFICA"),
    d("Literatura", "12ª Classe", 2, "ESPECIFICA"),
    d("Opção", "12ª Classe", 2, "ESPECIFICA"),
  ],

  esg_puniv_artes: [
    d("Língua Portuguesa", "10ª Classe", 4, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 4, "CIENTIFICA"),
    d("Desenho", "10ª Classe", 3, "ESPECIFICA"),
    d("Geometria Descritiva", "10ª Classe", 3, "ESPECIFICA"),
    d("História das Artes", "10ª Classe", 2, "ESPECIFICA"),
    d("Técnica de Expressão Artística", "10ª Classe", 3, "ESPECIFICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Filosofia", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Desenho", "11ª Classe", 3, "ESPECIFICA"),
    d("Teoria e Prática do Design", "11ª Classe", 3, "ESPECIFICA"),
    d("Geometria Descritiva", "11ª Classe", 3, "ESPECIFICA"),
    d("História das Artes", "11ª Classe", 3, "ESPECIFICA"),
    d("Técnica de Expressão Artística", "11ª Classe", 4, "ESPECIFICA"),
    d("Opção", "11ª Classe", 2, "ESPECIFICA"),

    d("Língua Portuguesa", "12ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "12ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Filosofia", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Empreendedorismo", "12ª Classe", 2, "SOCIO_CULTURAL"),
    d("Desenho", "12ª Classe", 2, "ESPECIFICA"),
    d("Teoria e Prática do Design", "12ª Classe", 3, "ESPECIFICA"),
    d("História das Artes", "12ª Classe", 3, "ESPECIFICA"),
    d("Técnica de Expressão Artística", "12ª Classe", 4, "ESPECIFICA"),
    d("Opção", "12ª Classe", 2, "ESPECIFICA"),
  ],

  // --------------------------------------------------------------------------
  // 4. ENSINO SECUNDÁRIO TÉCNICO-PROFISSIONAL (10ª à 13ª)
  // --------------------------------------------------------------------------
  tec_contabilidade: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Sociologia", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática Apl. Contab.", "10ª Classe", 4, "CIENTIFICA"),
    d("Contabilidade Financeira", "10ª Classe", 4, "TECNICA"),
    d("Administração de Empresas", "10ª Classe", 3, "TECNICA"),
    d("Doc. e Legislação Comercial", "10ª Classe", 3, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Informática Apl. Contab.", "11ª Classe", 4, "CIENTIFICA"),
    d("Contabilidade Financeira", "11ª Classe", 5, "TECNICA"),
    d("Téc. Cálculo e Estatística", "11ª Classe", 3, "TECNICA"),
    d("Administração de Empresas", "11ª Classe", 3, "TECNICA"),
    d("Doc. e Legislação Fiscal", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 5, "CIENTIFICA"),
    d("Direito", "12ª Classe", 3, "CIENTIFICA"),
    d("Economia", "12ª Classe", 3, "CIENTIFICA"),
    d("Contabilidade Financeira", "12ª Classe", 5, "TECNICA"),
    d("Contabilidade Analítica", "12ª Classe", 6, "TECNICA"),
    d("Análise Econ. e Financeira", "12ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 6, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_informatica_gestao: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 4, "CIENTIFICA"),
    d("Base de Dados", "10ª Classe", 4, "CIENTIFICA"),
    d("Org. e Adm. de Empresas", "10ª Classe", 4, "TECNICA"),
    d("Téc. e Ling. Programação", "10ª Classe", 6, "TECNICA"),
    d("Tec. Inf. e Comunicação", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Noções de Direito", "11ª Classe", 3, "CIENTIFICA"),
    d("Org. e Adm. de Empresas", "11ª Classe", 3, "TECNICA"),
    d("Redes de Computadores", "11ª Classe", 3, "TECNICA"),
    d("Téc. e Ling. Programação", "11ª Classe", 3, "TECNICA"),
    d("Tec. Inf. e Comunicação", "11ª Classe", 3, "TECNICA"),
    d("Informática Apl. Gestão", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 4, "TECNICA"),
    d("Org. e Adm. de Empresas", "12ª Classe", 4, "TECNICA"),
    d("Téc. e Ling. Programação", "12ª Classe", 4, "TECNICA"),
    d("Tec. Inf. e Comunicação", "12ª Classe", 4, "TECNICA"),
    d("Informática Apl. Gestão", "12ª Classe", 4, "TECNICA"),
    d("Sistema de Informação", "12ª Classe", 4, "TECNICA"),
    d("Inst. Manut. Equipamentos", "12ª Classe", 2, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 2, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_recursos_humanos: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 4, "CIENTIFICA"),
    d("Introdução à Economia", "10ª Classe", 3, "CIENTIFICA"),
    d("Sociologia das Org.", "10ª Classe", 3, "CIENTIFICA"),
    d("Empreendedorismo", "10ª Classe", 2, "CIENTIFICA"),
    d("Informática de Gestão", "10ª Classe", 2, "CIENTIFICA"),
    d("Form. e Des. do Pessoal", "10ª Classe", 3, "TECNICA"),
    d("Teoria da Adm. e Trabalho", "10ª Classe", 3, "TECNICA"),
    d("Sist. Com. e Inf. RH", "10ª Classe", 2, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Dir. e Leg. Social Trab.", "11ª Classe", 3, "CIENTIFICA"),
    d("Empreendedorismo", "11ª Classe", 2, "CIENTIFICA"),
    d("Informática de Gestão", "11ª Classe", 2, "CIENTIFICA"),
    d("Form. e Des. do Pessoal", "11ª Classe", 3, "TECNICA"),
    d("Teoria da Adm. e Trabalho", "11ª Classe", 3, "TECNICA"),
    d("Sist. Com. e Inf. RH", "11ª Classe", 2, "TECNICA"),
    d("Plan. e Análise de Funções", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Psicologia Soc. e Trab.", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "CIENTIFICA"),
    d("Form. e Des. do Pessoal", "12ª Classe", 4, "TECNICA"),
    d("Teoria da Adm. e Trabalho", "12ª Classe", 4, "TECNICA"),
    d("Plan. e Análise de Funções", "12ª Classe", 4, "TECNICA"),
    d("Rotina de Trabalho", "12ª Classe", 3, "TECNICA"),
    d("Org. e Gestão de RH", "12ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_secretariado: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Francês", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 4, "CIENTIFICA"),
    d("Inglês", "10ª Classe", 3, "CIENTIFICA"),
    d("Economia", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Contabilidade Empresarial", "10ª Classe", 3, "TECNICA"),
    d("Prática de Secretariado", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Francês", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Inglês", "11ª Classe", 3, "CIENTIFICA"),
    d("Psicologia", "11ª Classe", 3, "CIENTIFICA"),
    d("Informática", "11ª Classe", 2, "CIENTIFICA"),
    d("Contabilidade Empresarial", "11ª Classe", 4, "TECNICA"),
    d("Doc. e Legislação", "11ª Classe", 3, "TECNICA"),
    d("Prática de Secretariado", "11ª Classe", 4, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Psicologia", "12ª Classe", 3, "CIENTIFICA"),
    d("Informática", "12ª Classe", 2, "CIENTIFICA"),
    d("Téc. Cálculo e Estatística", "12ª Classe", 3, "TECNICA"),
    d("Doc. e Legislação", "12ª Classe", 3, "TECNICA"),
    d("Prática de Secretariado", "12ª Classe", 5, "TECNICA"),
    d("Português Técnico", "12ª Classe", 3, "TECNICA"),
    d("Inglês Técnico", "12ª Classe", 3, "TECNICA"),
    d("Francês Técnico", "12ª Classe", 3, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 6, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_financas: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 4, "CIENTIFICA"),
    d("Introdução à Economia", "10ª Classe", 4, "CIENTIFICA"),
    d("Informática de Gestão", "10ª Classe", 2, "CIENTIFICA"),
    d("Contabilidade Financeira", "10ª Classe", 4, "TECNICA"),
    d("Doc. e Legislação Comercial", "10ª Classe", 4, "TECNICA"),
    d("Análise Crédito e Invest.", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Direito Económico", "11ª Classe", 2, "CIENTIFICA"),
    d("Informática de Gestão", "11ª Classe", 2, "CIENTIFICA"),
    d("Contabilidade Financeira", "11ª Classe", 4, "TECNICA"),
    d("Org. Gest. Emp. Financeiras", "11ª Classe", 2, "TECNICA"),
    d("Téc. Recepção e Cobrança", "11ª Classe", 4, "TECNICA"),
    d("Análise Crédito e Invest.", "11ª Classe", 4, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Org. Gest. Emp. Financeiras", "12ª Classe", 3, "TECNICA"),
    d("Proc. Financ. Orçamentários", "12ª Classe", 3, "TECNICA"),
    d("Leg. Contab. Tributária", "12ª Classe", 3, "TECNICA"),
    d("Análise Crédito e Invest.", "12ª Classe", 3, "TECNICA"),
    d("Mercado de Capitais", "12ª Classe", 4, "TECNICA"),
    d("Análise Econ. Fin. Empresa", "12ª Classe", 4, "TECNICA"),
    d("Contabilidade Bancária", "12ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 2, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_comercio: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 4, "CIENTIFICA"),
    d("Introdução à Economia", "10ª Classe", 4, "CIENTIFICA"),
    d("Geografia Económica", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática de Gestão", "10ª Classe", 2, "CIENTIFICA"),
    d("Contabilidade Comercial", "10ª Classe", 4, "TECNICA"),
    d("Hig. e Segurança Alimentar", "10ª Classe", 2, "TECNICA"),
    d("Gestão de Aprovisionamento", "10ª Classe", 3, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Ing/Fr", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Noções Dir. Económico", "11ª Classe", 3, "CIENTIFICA"),
    d("Psicologia Consumidor", "11ª Classe", 3, "CIENTIFICA"),
    d("Informática de Gestão", "11ª Classe", 2, "CIENTIFICA"),
    d("Contabilidade Comercial", "11ª Classe", 4, "TECNICA"),
    d("Doc. e Leg. Comercial", "11ª Classe", 3, "TECNICA"),
    d("Gestão Cadeia Fornecedores", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Org. Gest. Emp. Comerciais", "12ª Classe", 4, "TECNICA"),
    d("Comércio Internacional", "12ª Classe", 3, "TECNICA"),
    d("Téc. Negociação e Vendas", "12ª Classe", 3, "TECNICA"),
    d("Protecção e Def. Consumidor", "12ª Classe", 3, "TECNICA"),
    d("Custos Gestão de Stock", "12ª Classe", 4, "TECNICA"),
    d("Fiscalidade", "12ª Classe", 3, "TECNICA"),
    d("Contabilidade de Custo", "12ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 2, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  // ==========================================
  // CURSOS TÉCNICOS INDUSTRIAIS (RETFOP/REVISADOS)
  // ==========================================
  tec_construcao_civil: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 4, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Desenho Técnico", "10ª Classe", 4, "TECNICA"),
    d("Materiais de Construção", "10ª Classe", 3, "TECNICA"),
    d("Topografia", "10ª Classe", 4, "TECNICA"),
    d("Práticas Oficinais (Pedreiro)", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Física", "11ª Classe", 3, "CIENTIFICA"),
    d("Estabilidade e Betão Armado", "11ª Classe", 4, "TECNICA"),
    d("Construção de Edifícios", "11ª Classe", 4, "TECNICA"),
    d("Desenho de Construção", "11ª Classe", 4, "TECNICA"),
    d("Topografia", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Medições e Orçamentos", "12ª Classe", 4, "TECNICA"),
    d("Org. e Gestão de Obras", "12ª Classe", 3, "TECNICA"),
    d("Instalações Prediais (Água/Luz)", "12ª Classe", 3, "TECNICA"),
    d("Higiene e Segurança no Trabalho", "12ª Classe", 2, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_energia_eletrica: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 4, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Electrotecnia", "10ª Classe", 4, "TECNICA"),
    d("Desenho Esquemático", "10ª Classe", 3, "TECNICA"),
    d("Tecnologia Eléctrica", "10ª Classe", 3, "TECNICA"),
    d("Práticas Oficinais", "10ª Classe", 5, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Física", "11ª Classe", 3, "CIENTIFICA"),
    d("Máquinas Eléctricas", "11ª Classe", 4, "TECNICA"),
    d("Instalações Eléctricas", "11ª Classe", 4, "TECNICA"),
    d("Electrotecnia", "11ª Classe", 3, "TECNICA"),
    d("Práticas Oficinais", "11ª Classe", 5, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Automatismos Industriais", "12ª Classe", 4, "TECNICA"),
    d("Redes de Energia", "12ª Classe", 3, "TECNICA"),
    d("Electrónica Industrial", "12ª Classe", 3, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_mecanica_manut: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 4, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Tecnologia Mecânica", "10ª Classe", 4, "TECNICA"),
    d("Desenho Técnico", "10ª Classe", 4, "TECNICA"),
    d("Práticas Oficinais", "10ª Classe", 6, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Física", "11ª Classe", 3, "CIENTIFICA"),
    d("Órgãos de Máquinas", "11ª Classe", 3, "TECNICA"),
    d("Tecnologia Mecânica", "11ª Classe", 4, "TECNICA"),
    d("Desenho de Construção Mec.", "11ª Classe", 3, "TECNICA"),
    d("Práticas Oficinais", "11ª Classe", 6, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Tecnologia de Manutenção", "12ª Classe", 4, "TECNICA"),
    d("Hidráulica e Pneumática", "12ª Classe", 4, "TECNICA"),
    d("Comando Numérico (CNC)", "12ª Classe", 3, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_informatica_sistemas: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 4, "CIENTIFICA"),
    d("Electrotecnia", "10ª Classe", 3, "TECNICA"),
    d("Téc. e Ling. Programação (TLP)", "10ª Classe", 6, "TECNICA"),
    d("Sist. Exploração e Arq. (SEAC)", "10ª Classe", 3, "TECNICA"),
    d("Tec. Inf. e Comunicação (TIC)", "10ª Classe", 3, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Física", "11ª Classe", 3, "CIENTIFICA"),
    d("Téc. e Ling. Programação (TLP)", "11ª Classe", 5, "TECNICA"),
    d("Técnicas de Redes (TRE)", "11ª Classe", 3, "TECNICA"),
    d("Sist. Exploração e Arq. (SEAC)", "11ª Classe", 4, "TECNICA"),
    d("Bases de Dados", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Téc. e Ling. Programação (TLP)", "12ª Classe", 5, "TECNICA"),
    d("Técnicas de Redes (TRE)", "12ª Classe", 4, "TECNICA"),
    d("Adm. Sist. Informação (ASI)", "12ª Classe", 3, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  // ==========================================
  // CURSOS TÉCNICOS INDUSTRIAIS - EXTENSÃO (PDF COMPLETO)
  // ==========================================
  tec_desenhador_projectista: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Inglês ou Francês", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 2, "CIENTIFICA"),
    d("Química", "10ª Classe", 2, "CIENTIFICA"),
    d("Geometria Descritiva", "10ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "10ª Classe", 2, "TECNICA"),
    d("Desenho de Projecto", "10ª Classe", 3, "TECNICA"),
    d("Técnicas de Construção Civil", "10ª Classe", 3, "TECNICA"),
    d("Informática Aplicada", "10ª Classe", 3, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Inglês ou Francês", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Física", "11ª Classe", 2, "CIENTIFICA"),
    d("Química", "11ª Classe", 2, "CIENTIFICA"),
    d("Geometria Descritiva", "11ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "11ª Classe", 2, "TECNICA"),
    d("Desenho de Projecto", "11ª Classe", 4, "TECNICA"),
    d("Técnicas de Construção Civil", "11ª Classe", 3, "TECNICA"),
    d("Informática Aplicada", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 5, "CIENTIFICA"),
    d("Física", "12ª Classe", 2, "CIENTIFICA"),
    d("Org. e Gestão Industrial", "12ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Desenho de Projecto", "12ª Classe", 4, "TECNICA"),
    d("Técnicas de Construção Civil", "12ª Classe", 5, "TECNICA"),
    d("Técnicas de Medições e Orçamentos", "12ª Classe", 4, "TECNICA"),
    d("Informática Aplicada", "12ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "estagio" }),
  ],

  tec_electronica_telecom: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Inglês ou Francês", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 2, "CIENTIFICA"),
    d("Química", "10ª Classe", 2, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "10ª Classe", 2, "TECNICA"),
    d("Electricidade e Electrónica", "10ª Classe", 3, "TECNICA"),
    d("Tecnologias das Telecomunicações", "10ª Classe", 3, "TECNICA"),
    d("Prática Oficinal", "10ª Classe", 3, "TECNICA"),

    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Física", "11ª Classe", 2, "CIENTIFICA"),
    d("Química", "11ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "11ª Classe", 2, "TECNICA"),
    d("Desenho Técnico", "11ª Classe", 3, "TECNICA"),
    d("Electricidade e Electrónica", "11ª Classe", 2, "TECNICA"),
    d("Sistemas Digitais", "11ª Classe", 2, "TECNICA"),
    d("Tecnologias das Telecomunicações", "11ª Classe", 2, "TECNICA"),
    d("Prática Oficinal", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 5, "CIENTIFICA"),
    d("Física", "12ª Classe", 2, "CIENTIFICA"),
    d("Org. e Gestão Industrial", "12ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Electricidade e Electrónica", "12ª Classe", 3, "TECNICA"),
    d("Sistemas Digitais", "12ª Classe", 4, "TECNICA"),
    d("Telecomunicações", "12ª Classe", 4, "TECNICA"),
    d("Tecnologias das Telecomunicações", "12ª Classe", 3, "TECNICA"),
    d("Prática Oficinal", "12ª Classe", 3, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "estagio" }),
  ],

  tec_electronica_automacao: [
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 2, "CIENTIFICA"),
    d("Química", "10ª Classe", 2, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Electricidade e Electrónica", "10ª Classe", 3, "TECNICA"),
    d("Tecnologias de Comando", "10ª Classe", 3, "TECNICA"),
    d("Práticas Oficinais", "10ª Classe", 3, "TECNICA"),

    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Desenho Técnico", "11ª Classe", 3, "TECNICA"),
    d("Electricidade e Electrónica", "11ª Classe", 2, "TECNICA"),
    d("Sistemas Digitais", "11ª Classe", 2, "TECNICA"),
    d("Tecnologias de Comando", "11ª Classe", 2, "TECNICA"),
    d("Práticas Oficinais", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 5, "CIENTIFICA"),
    d("Electricidade e Electrónica", "12ª Classe", 5, "TECNICA"),
    d("Sistemas Digitais", "12ª Classe", 4, "TECNICA"),
    d("Máquinas Eléctricas", "12ª Classe", 4, "TECNICA"),
    d("Tecnologias de Comando", "12ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA"),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA"),
  ],

  tec_energias_renovaveis: [
    d("Matemática", "10ª Classe", 4, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química", "10ª Classe", 2, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Desenho Técnico", "10ª Classe", 2, "TECNICA"),
    d("Electricidade e Electrónica", "10ª Classe", 2, "TECNICA"),
    d("Tecnologias e Processos", "10ª Classe", 2, "TECNICA"),
    d("Práticas Oficinais", "10ª Classe", 3, "TECNICA"),

    d("Matemática", "11ª Classe", 5, "CIENTIFICA"),
    d("Electricidade e Electrónica", "11ª Classe", 3, "TECNICA"),
    d("Tecnologias e Processos", "11ª Classe", 3, "TECNICA"),
    d("Práticas Oficinais", "11ª Classe", 3, "TECNICA"),

    d("Matemática", "12ª Classe", 5, "CIENTIFICA"),
    d("Desenho Técnico", "12ª Classe", 4, "TECNICA"),
    d("Tecnologias e Processos", "12ª Classe", 5, "TECNICA"),
    d("Práticas Oficinais", "12ª Classe", 6, "TECNICA"),
    d("Eficiência Energética", "12ª Classe", 2, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA"),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA"),
  ],

  tec_geologia_petroleo: [
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química", "10ª Classe", 3, "CIENTIFICA"),
    d("Introdução à Indústria de Petróleos", "10ª Classe", 4, "TECNICA"),
    d("Geologia Geral", "10ª Classe", 3, "TECNICA"),
    d("Desenho Técnico", "10ª Classe", 4, "TECNICA"),
    d("Mineralogia e Petrologia", "10ª Classe", 3, "TECNICA"),
    d("Geologia Estrutural e Estratigráfica", "10ª Classe", 3, "TECNICA"),

    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Geofísica", "11ª Classe", 4, "TECNICA"),
    d("Saúde, Segurança e Ambiente", "11ª Classe", 3, "TECNICA"),
    d("Inglês Técnico", "11ª Classe", 2, "TECNICA"),
    d("Mineralogia e Petrologia", "11ª Classe", 3, "TECNICA"),

    d("Geologia dos Hidrocarbonetos", "12ª Classe", 3, "TECNICA"),
    d("Geologia de Sonda", "12ª Classe", 3, "TECNICA"),
    d("Técnicas de Laboratório", "12ª Classe", 3, "TECNICA"),
    d("Topografia", "12ª Classe", 3, "TECNICA"),
    d("Geofísica", "12ª Classe", 3, "TECNICA"),

    d("Trabalhos de Campo", "13ª Classe", 8, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA"),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA"),
  ],

  tec_perfuracao_producao: [
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química", "10ª Classe", 3, "CIENTIFICA"),
    d("Geologia Geral", "10ª Classe", 3, "TECNICA"),
    d("Electrotecnia", "10ª Classe", 4, "TECNICA"),
    d("Pesquisa e Prospecção", "10ª Classe", 4, "TECNICA"),

    d("Estudo de Jazidas", "11ª Classe", 4, "TECNICA"),
    d("Tecnologia de Perfuração", "11ª Classe", 5, "TECNICA"),
    d("Tecnologia de Produção", "11ª Classe", 5, "TECNICA"),
    d("Tecnologia Geral de Máquinas", "11ª Classe", 4, "TECNICA"),

    d("Tecnologia de Perfuração", "12ª Classe", 4, "TECNICA"),
    d("Tecnologia de Produção", "12ª Classe", 4, "TECNICA"),
    d("Instrumentação e Controle", "12ª Classe", 3, "TECNICA"),
    d("Segurança e Meio Ambiente", "12ª Classe", 3, "TECNICA"),
    d("Inglês Técnico", "12ª Classe", 3, "TECNICA"),

    d("Trabalhos de Campo", "13ª Classe", 8, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA"),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA"),
  ],

  tec_minas: [
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Introdução à Indústria de Minas", "10ª Classe", 2, "TECNICA"),
    d("Geologia Geral", "10ª Classe", 2, "TECNICA"),
    d("Mineralogia e Cristalografia", "10ª Classe", 2, "TECNICA"),
    d("Tecnologia Mineira", "10ª Classe", 2, "TECNICA"),
    d("Técnicas de Prospecção", "10ª Classe", 2, "TECNICA"),

    d("Preparação de Minérios", "11ª Classe", 3, "TECNICA"),
    d("Tecnologia Mineira", "11ª Classe", 2, "TECNICA"),
    d("Geologia Geral", "11ª Classe", 3, "TECNICA"),

    d("Tecnologia Mineira", "12ª Classe", 3, "TECNICA"),
    d("Preparação de Minérios", "12ª Classe", 3, "TECNICA"),
    d("Jazigos Minerais", "12ª Classe", 3, "TECNICA"),
    d("Topografia", "12ª Classe", 3, "TECNICA"),
    d("Instrumentação e Controlo", "12ª Classe", 4, "TECNICA"),

    d("Trabalhos de Campo", "13ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA"),
    d("Estágio Curricular", "13ª Classe", 16, "TECNICA"),
  ],

  tec_producao_metalomecanica: [
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química", "10ª Classe", 3, "CIENTIFICA"),
    d("Desenho de Construções Mecânicas", "10ª Classe", 2, "TECNICA"),
    d("Tecnologia Mecânica", "10ª Classe", 2, "TECNICA"),
    d("Práticas Oficinais", "10ª Classe", 3, "TECNICA"),

    d("Elementos de Máquinas", "11ª Classe", 3, "TECNICA"),
    d("Tecnologia Mecânica", "11ª Classe", 3, "TECNICA"),
    d("Desenho de Construções Mecânicas", "11ª Classe", 3, "TECNICA"),
    d("Práticas Oficinais", "11ª Classe", 3, "TECNICA"),

    d("Elementos de Máquinas", "12ª Classe", 3, "TECNICA"),
    d("Tecnologias de Comando", "12ª Classe", 3, "TECNICA"),
    d("Controlo da Qualidade", "12ª Classe", 3, "TECNICA"),
    d("Práticas Oficinais", "12ª Classe", 4, "TECNICA"),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA"),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA"),
  ],

  // ==========================================
  // CURSOS DE INFORMÁTICA (RETFOP - REVISADOS)
  // ==========================================
  tec_informatica: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Inglês ou Francês", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 2, "CIENTIFICA"),
    d("Química", "10ª Classe", 2, "CIENTIFICA"),
    d("Electrotecnia", "10ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "10ª Classe", 2, "TECNICA"),
    d("Técnicas e Ling. Programação (TLP)", "10ª Classe", 3, "TECNICA"),
    d("Sist. Exploração e Arq. (SEAC)", "10ª Classe", 2, "TECNICA"),
    d("Tec. Inf. e Comunicação (TIC)", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Inglês ou Francês", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Física", "11ª Classe", 2, "CIENTIFICA"),
    d("Química", "11ª Classe", 2, "CIENTIFICA"),
    d("Electrotecnia", "11ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "11ª Classe", 2, "TECNICA"),
    d("Desenho Técnico", "11ª Classe", 3, "TECNICA"),
    d("Técnicas e Ling. Programação (TLP)", "11ª Classe", 3, "TECNICA"),
    d("Sist. Exploração e Arq. (SEAC)", "11ª Classe", 4, "TECNICA"),

    d("Matemática", "12ª Classe", 5, "CIENTIFICA"),
    d("Física", "12ª Classe", 2, "CIENTIFICA"),
    d("Org. e Gestão Industrial", "12ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Técnicas e Ling. Programação (TLP)", "12ª Classe", 6, "TECNICA"),
    d("Téc. Reparação de Equip. (TRE)", "12ª Classe", 7, "TECNICA"),
    d("Sist. Exploração e Arq. (SEAC)", "12ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "estagio" }),
  ],

  tec_gestao_sistemas: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Inglês ou Francês", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 5, "CIENTIFICA"),
    d("Física", "10ª Classe", 2, "CIENTIFICA"),
    d("Química", "10ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "10ª Classe", 2, "TECNICA"),
    d("Desenho Técnico", "10ª Classe", 3, "TECNICA"),
    d("Técnicas e Ling. Programação (TLP)", "10ª Classe", 4, "TECNICA"),
    d("Sist. Exploração e Arq. (SEAC)", "10ª Classe", 4, "TECNICA"),
    d("Tec. Inf. e Comunicação (TIC)", "10ª Classe", 3, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Inglês ou Francês", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 4, "CIENTIFICA"),
    d("Física", "11ª Classe", 2, "CIENTIFICA"),
    d("Química", "11ª Classe", 2, "CIENTIFICA"),
    d("Empreendedorismo", "11ª Classe", 2, "TECNICA"),
    d("Técnicas e Ling. Programação (TLP)", "11ª Classe", 4, "TECNICA"),
    d("Sist. Exploração e Arq. (SEAC)", "11ª Classe", 3, "TECNICA"),
    d("Tec. Inf. e Comunicação (TIC)", "11ª Classe", 2, "TECNICA"),

    d("Matemática", "12ª Classe", 5, "CIENTIFICA"),
    d("Física", "12ª Classe", 2, "CIENTIFICA"),
    d("Org. e Gestão de Empresas", "12ª Classe", 4, "CIENTIFICA"),
    d("Empreendedorismo", "12ª Classe", 2, "TECNICA"),
    d("Técnicas e Ling. Programação (TLP)", "12ª Classe", 6, "TECNICA"),
    d("Redes Informáticas", "12ª Classe", 6, "TECNICA"),
    d("Tec. Inf. e Comunicação (TIC)", "12ª Classe", 3, "TECNICA"),
    d("Projecto Tecnológico", "12ª Classe", 4, "TECNICA", { tipo: "projeto" }),

    d("Projecto Tecnológico", "13ª Classe", 8, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "estagio" }),
  ],

  // ==========================================
  // CURSOS TÉCNICOS DE SAÚDE (PROPOSTA ITS 2022)
  // ==========================================
  tec_saude_analises: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "10ª Classe", 3, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química Geral", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Intro. Profissão, Ética e Deont.", "10ª Classe", 3, "TECNICA"),
    d("Anatomia e Fisiologia Humana", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "11ª Classe", 3, "CIENTIFICA"),
    d("Química Orgânica", "11ª Classe", 3, "CIENTIFICA"),
    d("Anatomia e Fisiologia Humana", "11ª Classe", 3, "TECNICA"),
    d("Microbiologia Clínica I", "11ª Classe", 3, "TECNICA"),
    d("Hematologia I", "11ª Classe", 3, "TECNICA"),
    d("Imunologia", "11ª Classe", 2, "TECNICA"),
    d("Urinologia", "11ª Classe", 3, "TECNICA"),
    d("Coprologia", "11ª Classe", 2, "TECNICA"),
    d("Práticas de Análises Clínicas", "11ª Classe", 3, "TECNICA"),

    d("Psicologia Geral", "12ª Classe", 3, "CIENTIFICA"),
    d("Inf. Educação e Comunicação (IEC)", "12ª Classe", 2, "TECNICA"),
    d("Microbiologia Clínica II", "12ª Classe", 3, "TECNICA"),
    d("Hematologia II", "12ª Classe", 3, "TECNICA"),
    d("Imunohematologia", "12ª Classe", 3, "TECNICA"),
    d("Microbiologia Água e Alim.", "12ª Classe", 3, "TECNICA"),
    d("Bioquímica", "12ª Classe", 3, "TECNICA"),
    d("Química Clínica", "12ª Classe", 3, "TECNICA"),
    d("Parasitologia", "12ª Classe", 3, "TECNICA"),
    d("Práticas de Análises Clínicas", "12ª Classe", 4, "TECNICA"),

    d("Gestão em Análises Clínicas", "13ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 4, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_saude_enfermagem: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "10ª Classe", 3, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química Geral", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Intro. Profissão, Ética e Deont.", "10ª Classe", 3, "TECNICA"),
    d("Anatomia e Fisiologia Humana", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "11ª Classe", 3, "CIENTIFICA"),
    d("Química Orgânica", "11ª Classe", 3, "CIENTIFICA"),
    d("Psicologia Geral", "11ª Classe", 2, "CIENTIFICA"),
    d("Anatomia e Fisiologia Humana", "11ª Classe", 3, "TECNICA"),
    d("Epidemiologia e Estatística", "11ª Classe", 3, "TECNICA"),
    d("Enfermagem Saúde Colectiva", "11ª Classe", 2, "TECNICA"),
    d("Enf. Patologia Médico-Cirúrgica I", "11ª Classe", 3, "TECNICA"),
    d("Técnicas de Enfermagem I", "11ª Classe", 3, "TECNICA"),

    d("IEC", "12ª Classe", 3, "TECNICA"),
    d("Enfermagem Saúde Mental", "12ª Classe", 2, "TECNICA"),
    d("Farmacologia", "12ª Classe", 3, "TECNICA"),
    d("Doenças Correntes", "12ª Classe", 3, "TECNICA"),
    d("Nutrição e Dietética", "12ª Classe", 2, "TECNICA"),
    d("Enf. Patologia Médico-Cirúrgica II", "12ª Classe", 3, "TECNICA"),
    d("Técnicas de Enfermagem II", "12ª Classe", 4, "TECNICA"),
    d("Saúde da Mulher", "12ª Classe", 3, "TECNICA"),
    d("Saúde da Criança", "12ª Classe", 3, "TECNICA"),
    d("Enfermagem em Urgência", "12ª Classe", 3, "TECNICA"),

    d("Gestão em Enfermagem", "13ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 4, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_saude_estomatologia: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "10ª Classe", 3, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química Geral", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Ética e Deontologia Prof.", "10ª Classe", 3, "TECNICA"),
    d("Anatomia e Fisiologia Humana", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "11ª Classe", 3, "CIENTIFICA"),
    d("Química Orgânica", "11ª Classe", 3, "CIENTIFICA"),
    d("Psicologia Geral", "11ª Classe", 3, "CIENTIFICA"),
    d("Anatomia e Fisiologia Humana", "11ª Classe", 2, "TECNICA"),
    d("Anatomia Cabeça e Pescoço", "11ª Classe", 3, "TECNICA"),
    d("Patologia e Semiologia", "11ª Classe", 2, "TECNICA"),
    d("Microbiologia e Esterilização", "11ª Classe", 2, "TECNICA"),
    d("Aparelhagem Instrumental", "11ª Classe", 2, "TECNICA"),
    d("Farmacologia", "11ª Classe", 2, "TECNICA"),

    d("IEC", "12ª Classe", 3, "TECNICA"),
    d("Anatomia Cabeça e Pescoço", "12ª Classe", 4, "TECNICA"),
    d("Exodância", "12ª Classe", 4, "TECNICA"),
    d("Radiologia Dentária", "12ª Classe", 3, "TECNICA"),
    d("Terapêutica Dentária", "12ª Classe", 3, "TECNICA"),
    d("Dentística Restauradora", "12ª Classe", 3, "TECNICA"),
    d("Práticas Estomatologia", "12ª Classe", 4, "TECNICA"),

    d("Gestão em Estomatologia", "13ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 4, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_saude_farmacia: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "10ª Classe", 3, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química Geral", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Intro. Profissão, Ética", "10ª Classe", 3, "TECNICA"),
    d("Anatomia e Fisiologia Humana", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "11ª Classe", 3, "CIENTIFICA"),
    d("Química Orgânica", "11ª Classe", 3, "CIENTIFICA"),
    d("Anatomia e Fisiologia Humana", "11ª Classe", 3, "TECNICA"),
    d("Patologia", "11ª Classe", 2, "TECNICA"),
    d("Botânica", "11ª Classe", 2, "TECNICA"),
    d("Microparasitologia", "11ª Classe", 3, "TECNICA"),
    d("Farmacologia I", "11ª Classe", 2, "TECNICA"),
    d("Farmacognosia", "11ª Classe", 3, "TECNICA"),
    d("Química Analítica", "11ª Classe", 3, "TECNICA"),

    d("Psicologia Geral", "12ª Classe", 3, "CIENTIFICA"),
    d("IEC", "12ª Classe", 3, "TECNICA"),
    d("Bromatologia", "12ª Classe", 2, "TECNICA"),
    d("Patologia", "12ª Classe", 3, "TECNICA"),
    d("Farmacologia II", "12ª Classe", 4, "TECNICA"),
    d("Química Farmacêutica", "12ª Classe", 3, "TECNICA"),
    d("Tec. Prod. Medicamentos", "12ª Classe", 3, "TECNICA"),
    d("Farmacoterapia", "12ª Classe", 3, "TECNICA"),
    d("Toxicologia", "12ª Classe", 3, "TECNICA"),
    d("Práticas de Farmácia", "12ª Classe", 4, "TECNICA"),

    d("Gestão em Farmácia", "13ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 4, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_saude_fisioterapia: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "10ª Classe", 3, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química Geral", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Intro. Profissão, Ética", "10ª Classe", 3, "TECNICA"),
    d("Anatomia e Fisiologia Humana", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "11ª Classe", 3, "CIENTIFICA"),
    d("Química Orgânica", "11ª Classe", 3, "CIENTIFICA"),
    d("Patologia Geral", "11ª Classe", 2, "TECNICA"),
    d("Anatomia e Fisiologia Humana", "11ª Classe", 3, "TECNICA"),
    d("Estudo Movimento Humano", "11ª Classe", 2, "TECNICA"),
    d("Fisioterapia Neuro-Muscular", "11ª Classe", 3, "TECNICA"),
    d("Fisioterapia Músculo-Esq.", "11ª Classe", 3, "TECNICA"),

    d("Psicologia Geral", "12ª Classe", 3, "CIENTIFICA"),
    d("Patologia Específica", "12ª Classe", 3, "TECNICA"),
    d("IEC", "12ª Classe", 3, "TECNICA"),
    d("Fisioterapia Cardio-Resp.", "12ª Classe", 3, "TECNICA"),
    d("Fisioterapia Neuro-Muscular", "12ª Classe", 3, "TECNICA"),
    d("Fisioterapia Músculo-Esq.", "12ª Classe", 3, "TECNICA"),
    d("Fisioterapia Materno-Infantil", "12ª Classe", 3, "TECNICA"),
    d("Recursos Fisioterapêuticos", "12ª Classe", 3, "TECNICA"),
    d("Ortoprotesia", "12ª Classe", 4, "TECNICA"),
    d("Prática em Fisioterapia", "12ª Classe", 4, "TECNICA"),
    d("Estágio Prático Parcelar", "12ª Classe", 4, "TECNICA"),

    d("Gestão em Fisioterapia", "13ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 4, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_saude_nutricao: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "10ª Classe", 3, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química Geral", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Intro. Profissão, Ética", "10ª Classe", 3, "TECNICA"),
    d("Anatomia e Fisiologia Humana", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Inglesa", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "11ª Classe", 3, "CIENTIFICA"),
    d("Química Orgânica", "11ª Classe", 3, "CIENTIFICA"),
    d("Anatomia e Fisiologia Humana", "11ª Classe", 3, "TECNICA"),
    d("Patologia", "11ª Classe", 2, "TECNICA"),
    d("Farmacologia", "11ª Classe", 2, "TECNICA"),
    d("Nutrição Humana Comunitária", "11ª Classe", 3, "TECNICA"),
    d("Dietética Geral e Especial", "11ª Classe", 3, "TECNICA"),

    d("Psicologia Geral", "12ª Classe", 3, "CIENTIFICA"),
    d("IEC", "12ª Classe", 3, "TECNICA"),
    d("Patologia", "12ª Classe", 3, "TECNICA"),
    d("Farmacologia", "12ª Classe", 3, "TECNICA"),
    d("Nutrição Humana Comunitária", "12ª Classe", 3, "TECNICA"),
    d("Dietética Geral e Especial", "12ª Classe", 3, "TECNICA"),
    d("Técnicas Dietéticas", "12ª Classe", 4, "TECNICA"),
    d("Dietética Laboratorial", "12ª Classe", 4, "TECNICA"),
    d("Microbiologia Hig. Alimentos", "12ª Classe", 3, "TECNICA"),
    d("Práticas Nutrição/Dietética", "12ª Classe", 4, "TECNICA"),

    d("Gestão em Nutrição", "13ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 4, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],

  tec_saude_radiologia: [
    d("Língua Portuguesa", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Form. Atitudes Integradoras", "10ª Classe", 3, "SOCIO_CULTURAL"),
    d("Educação Física", "10ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "10ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "10ª Classe", 3, "CIENTIFICA"),
    d("Física", "10ª Classe", 3, "CIENTIFICA"),
    d("Química Geral", "10ª Classe", 3, "CIENTIFICA"),
    d("Informática", "10ª Classe", 2, "CIENTIFICA"),
    d("Intro. Profissão, Ética", "10ª Classe", 3, "TECNICA"),
    d("Anatomia e Fisiologia Humana", "10ª Classe", 4, "TECNICA"),

    d("Língua Portuguesa", "11ª Classe", 3, "SOCIO_CULTURAL"),
    d("Língua Estrangeira", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Educação Física", "11ª Classe", 2, "SOCIO_CULTURAL"),
    d("Matemática", "11ª Classe", 3, "CIENTIFICA"),
    d("Biologia", "11ª Classe", 3, "CIENTIFICA"),
    d("Química Orgânica", "11ª Classe", 3, "CIENTIFICA"),
    d("Física das Radiações", "11ª Classe", 3, "TECNICA"),
    d("Anatomia Radiológica I", "11ª Classe", 3, "TECNICA"),
    d("Processamento Radiológico", "11ª Classe", 3, "TECNICA"),
    d("Enfermagem em Radiologia", "11ª Classe", 2, "TECNICA"),
    d("Métodos e Técnicas Rad. I", "11ª Classe", 3, "TECNICA"),
    d("Patologia Radiológica I", "11ª Classe", 2, "TECNICA"),

    d("Psicologia Geral", "12ª Classe", 3, "CIENTIFICA"),
    d("IEC", "12ª Classe", 3, "TECNICA"),
    d("Anatomia Radiológica II", "12ª Classe", 4, "TECNICA"),
    d("Métodos e Técnicas Rad. II", "12ª Classe", 4, "TECNICA"),
    d("Protecção e Seg. Radiológica", "12ª Classe", 4, "TECNICA"),
    d("Patologia Radiológica II", "12ª Classe", 4, "TECNICA"),
    d("Métodos/Técnicas Especiais", "12ª Classe", 4, "TECNICA"),
    d("Práticas de Radiologia", "12ª Classe", 4, "TECNICA"),

    d("Gestão em Radiologia", "13ª Classe", 4, "TECNICA"),
    d("Projecto Tecnológico", "13ª Classe", 4, "TECNICA", { tipo: "projeto" }),
    d("Estágio Curricular", "13ª Classe", 20, "TECNICA", { tipo: "projeto" }),
  ],
};

// ==========================================
// METADADOS E SIGLAS OFICIAIS
// ==========================================

export type CurriculumPresetMeta = {
  key: CurriculumKey;
  label: string;
  course_code: string;
  description?: string;
  badge?: string;
  recommended?: boolean;
  classes: string[];
  subjectsCount: number;
};

const META_INFO: Record<CurriculumKey, Omit<CurriculumPresetMeta, "classes" | "subjectsCount">> = {
  primario_generico: {
    key: "primario_generico",
    label: "Ensino Primário",
    course_code: "EP",
    badge: "1ª-6ª",
    description: "Base nacional (1ª-6ª)",
    recommended: true,
  },
  esg_ciclo1: {
    key: "esg_ciclo1",
    label: "Iº Ciclo do Secundário",
    course_code: "ESG",
    badge: "7ª-9ª",
    description: "Ensino Secundário Geral",
  },
  esg_puniv_cfb: {
    key: "esg_puniv_cfb",
    label: "Ciências Físicas e Biológicas",
    course_code: "CFB",
    badge: "PUNIV",
    description: "Saúde e Engenharias",
    recommended: true,
  },
  esg_puniv_cej: {
    key: "esg_puniv_cej",
    label: "Ciências Económico-Jurídicas",
    course_code: "CEJ",
    badge: "PUNIV",
    description: "Direito e Economia",
  },
  esg_puniv_cch: {
    key: "esg_puniv_cch",
    label: "Ciências Humanas",
    course_code: "CCH",
    badge: "PUNIV",
    description: "Humanas e Línguas",
  },
  esg_puniv_artes: {
    key: "esg_puniv_artes",
    label: "Artes Visuais",
    course_code: "AV",
    badge: "PUNIV",
    description: "Design e Artes",
  },
  tec_construcao_civil: {
    key: "tec_construcao_civil",
    label: "Técnico de Construção Civil",
    course_code: "CC",
    badge: "Técnico",
    description: "Obras e edificações",
  },
  tec_energia_eletrica: {
    key: "tec_energia_eletrica",
    label: "Técnico de Energia Eléctrica",
    course_code: "EL",
    badge: "Técnico",
    description: "Instalações eléctricas",
  },
  tec_mecanica_manut: {
    key: "tec_mecanica_manut",
    label: "Técnico de Mecânica de Manutenção",
    course_code: "MEC",
    badge: "Técnico",
    description: "Manutenção industrial",
  },
  tec_informatica_sistemas: {
    key: "tec_informatica_sistemas",
    label: "Técnico de Informática (Sistemas)",
    course_code: "TIS",
    badge: "Técnico",
    description: "Sistemas e redes",
  },
  tec_desenhador_projectista: {
    key: "tec_desenhador_projectista",
    label: "Desenhador Projectista",
    course_code: "DP",
    badge: "Técnico",
    description: "Desenho e projeto",
  },
  tec_electronica_telecom: {
    key: "tec_electronica_telecom",
    label: "Electrónica e Telecomunicações",
    course_code: "ET",
    badge: "Técnico",
    description: "Telecomunicações",
  },
  tec_electronica_automacao: {
    key: "tec_electronica_automacao",
    label: "Electrónica Industrial e Automação",
    course_code: "EA",
    badge: "Técnico",
    description: "Automação industrial",
  },
  tec_energias_renovaveis: {
    key: "tec_energias_renovaveis",
    label: "Técnico de Energias Renováveis",
    course_code: "ER",
    badge: "Técnico",
    description: "Energia solar e eólica",
  },
  tec_geologia_petroleo: {
    key: "tec_geologia_petroleo",
    label: "Técnico de Geologia de Petróleo",
    course_code: "GP",
    badge: "Técnico",
    description: "Geologia de petróleo",
  },
  tec_perfuracao_producao: {
    key: "tec_perfuracao_producao",
    label: "Perfuração e Produção Petrolífera",
    course_code: "PP",
    badge: "Técnico",
    description: "Perfuração e produção",
  },
  tec_minas: {
    key: "tec_minas",
    label: "Técnico de Minas",
    course_code: "MIN",
    badge: "Técnico",
    description: "Exploração mineira",
  },
  tec_producao_metalomecanica: {
    key: "tec_producao_metalomecanica",
    label: "Produção em Metalomecânica",
    course_code: "PM",
    badge: "Técnico",
    description: "Metalomecânica",
  },
  tec_informatica: {
    key: "tec_informatica",
    label: "Técnico de Informática (Hardware)",
    course_code: "TI",
    badge: "Técnico",
    description: "Hardware e suporte",
  },
  tec_gestao_sistemas: {
    key: "tec_gestao_sistemas",
    label: "Gestão de Sistemas Informáticos",
    course_code: "TGS",
    badge: "Técnico",
    description: "Redes e gestão",
  },
  tec_contabilidade: {
    key: "tec_contabilidade",
    label: "Técnico de Contabilidade",
    course_code: "TG",
    badge: "Técnico",
    description: "Contabilidade e gestão",
    recommended: true,
  },
  tec_informatica_gestao: {
    key: "tec_informatica_gestao",
    label: "Técnico de Informática de Gestão",
    course_code: "TIG",
    badge: "Técnico",
    description: "Informática e gestão",
    recommended: true,
  },
  tec_recursos_humanos: {
    key: "tec_recursos_humanos",
    label: "Técnico de Recursos Humanos",
    course_code: "TRH",
    badge: "Técnico",
    description: "Gestão de pessoas",
  },
  tec_secretariado: {
    key: "tec_secretariado",
    label: "Técnico de Secretariado",
    course_code: "SEC",
    badge: "Técnico",
    description: "Secretariado e gestão",
  },
  tec_financas: {
    key: "tec_financas",
    label: "Técnico de Finanças",
    course_code: "FIN",
    badge: "Técnico",
    description: "Finanças e crédito",
  },
  tec_comercio: {
    key: "tec_comercio",
    label: "Técnico de Comércio",
    course_code: "COM",
    badge: "Técnico",
    description: "Comércio e logística",
  },
  tec_saude_analises: {
    key: "tec_saude_analises",
    label: "Técnico de Análises Clínicas",
    course_code: "ACL",
    badge: "Saúde",
    description: "Laboratório clínico",
  },
  tec_saude_enfermagem: {
    key: "tec_saude_enfermagem",
    label: "Técnico de Enfermagem",
    course_code: "ENF",
    badge: "Saúde",
    description: "Cuidados de enfermagem",
  },
  tec_saude_estomatologia: {
    key: "tec_saude_estomatologia",
    label: "Técnico de Estomatologia",
    course_code: "ESTO",
    badge: "Saúde",
    description: "Saúde oral",
  },
  tec_saude_farmacia: {
    key: "tec_saude_farmacia",
    label: "Técnico de Farmácia",
    course_code: "FARM",
    badge: "Saúde",
    description: "Farmácia e medicamentos",
  },
  tec_saude_fisioterapia: {
    key: "tec_saude_fisioterapia",
    label: "Técnico de Fisioterapia",
    course_code: "FISI",
    badge: "Saúde",
    description: "Reabilitação e movimento",
  },
  tec_saude_nutricao: {
    key: "tec_saude_nutricao",
    label: "Técnico de Nutrição",
    course_code: "NUTR",
    badge: "Saúde",
    description: "Nutrição e dietética",
  },
  tec_saude_radiologia: {
    key: "tec_saude_radiologia",
    label: "Técnico de Radiologia",
    course_code: "RAD",
    badge: "Saúde",
    description: "Diagnóstico por imagem",
  },
};

export const CURRICULUM_PRESETS_META = Object.fromEntries(
  (Object.keys(META_INFO) as CurriculumKey[]).map((key) => [
    key,
    {
      ...META_INFO[key],
      classes: [],
      subjectsCount: 0,
    },
  ])
) as unknown as Record<CurriculumKey, CurriculumPresetMeta>;

export const getPresetMeta = (key: CurriculumKey) => CURRICULUM_PRESETS_META[key];
export const getAllPresetsMeta = () => Object.values(CURRICULUM_PRESETS_META);
export const getSubjectsCount = (_key: CurriculumKey) => 0;
