// src/lib/onboarding/curriculum-presets.ts

// 🔑 Todas as chaves possíveis de modelos curriculares
export type CurriculumKey =
  | "primario_base"
  | "primario_avancado"
  | "ciclo1"
  | "puniv"
  | "economicas"
  | "tecnico_informatica"
  | "tecnico_gestao"
  | "tecnico_construcao"
  | "tecnico_base"
  | "saude_enfermagem"
  | "saude_farmacia_analises";

// Nível de ensino / segmento (pode aproveitar nos steps de Classes/Cursos)
export type NivelEnsinoId =
  | "base"          // 1ª – 6ª
  | "secundario1"   // 7ª – 9ª
  | "secundario2"   // 10ª – 13ª (geral)
  | "tecnico"       // médio técnico/profissional
  | "saude";        // técnico de saúde

// Blueprint de disciplina que será usada pelo backend para gerar
// classes, cursos e disciplinas da escola.
export interface CurriculumDisciplineBlueprint {
  nome: string;                // nome da disciplina
  classe: string;              // ex: "7ª Classe"
  nivel: NivelEnsinoId;
  curso?: string;              // ex: "Ciências Físico-Biológicas", "Informática"
  tipo?: "core" | "eletivo";   // default: core
}

// Cada preset é um array de "blueprints" de disciplinas
export const CURRICULUM_PRESETS: Record<
  CurriculumKey,
  CurriculumDisciplineBlueprint[]
> = {
  // ---------------------------------------------------------------------------
  // ENSINO DE BASE — PRIMÁRIO
  // ---------------------------------------------------------------------------
  primario_base: [
    // 1ª Classe
    { nome: "Língua Portuguesa", classe: "1ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "1ª Classe", nivel: "base" },
    { nome: "Estudo do Meio", classe: "1ª Classe", nivel: "base" },
    { nome: "Educação Moral e Cívica", classe: "1ª Classe", nivel: "base" },

    // 2ª Classe
    { nome: "Língua Portuguesa", classe: "2ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "2ª Classe", nivel: "base" },
    { nome: "Estudo do Meio", classe: "2ª Classe", nivel: "base" },
    { nome: "Educação Moral e Cívica", classe: "2ª Classe", nivel: "base" },

    // 3ª Classe
    { nome: "Língua Portuguesa", classe: "3ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "3ª Classe", nivel: "base" },
    { nome: "Estudo do Meio", classe: "3ª Classe", nivel: "base" },
    { nome: "Educação Moral e Cívica", classe: "3ª Classe", nivel: "base" },

    // 4ª Classe
    { nome: "Língua Portuguesa", classe: "4ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "4ª Classe", nivel: "base" },
    { nome: "Estudo do Meio", classe: "4ª Classe", nivel: "base" },

    // 5ª Classe
    { nome: "Língua Portuguesa", classe: "5ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "5ª Classe", nivel: "base" },
    { nome: "Ciências da Natureza", classe: "5ª Classe", nivel: "base" },

    // 6ª Classe
    { nome: "Língua Portuguesa", classe: "6ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "6ª Classe", nivel: "base" },
    { nome: "Ciências da Natureza", classe: "6ª Classe", nivel: "base" },
  ],

  primario_avancado: [
    // 1ª Classe
    { nome: "Língua Portuguesa", classe: "1ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "1ª Classe", nivel: "base" },
    { nome: "Estudo do Meio", classe: "1ª Classe", nivel: "base" },
    // 2ª Classe
    { nome: "Língua Portuguesa", classe: "2ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "2ª Classe", nivel: "base" },
    { nome: "Estudo do Meio", classe: "2ª Classe", nivel: "base" },
    // 3ª – 6ª com reforço de ciências e história/geografia
    { nome: "Língua Portuguesa", classe: "3ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "3ª Classe", nivel: "base" },
    { nome: "Ciências da Natureza", classe: "3ª Classe", nivel: "base" },

    { nome: "Língua Portuguesa", classe: "4ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "4ª Classe", nivel: "base" },
    { nome: "Ciências da Natureza", classe: "4ª Classe", nivel: "base" },
    { nome: "História e Geografia", classe: "4ª Classe", nivel: "base" },

    { nome: "Língua Portuguesa", classe: "5ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "5ª Classe", nivel: "base" },
    { nome: "Ciências da Natureza", classe: "5ª Classe", nivel: "base" },
    { nome: "História e Geografia", classe: "5ª Classe", nivel: "base" },

    { nome: "Língua Portuguesa", classe: "6ª Classe", nivel: "base" },
    { nome: "Matemática", classe: "6ª Classe", nivel: "base" },
    { nome: "Ciências da Natureza", classe: "6ª Classe", nivel: "base" },
    { nome: "História e Geografia", classe: "6ª Classe", nivel: "base" },
  ],

  // ---------------------------------------------------------------------------
  // 1º CICLO (7ª – 9ª)
  // ---------------------------------------------------------------------------
  ciclo1: [
    { nome: "Língua Portuguesa", classe: "7ª Classe", nivel: "secundario1" },
    { nome: "Matemática", classe: "7ª Classe", nivel: "secundario1" },
    { nome: "Física e Química", classe: "7ª Classe", nivel: "secundario1" },
    { nome: "Biologia", classe: "7ª Classe", nivel: "secundario1" },
    { nome: "História", classe: "7ª Classe", nivel: "secundario1" },
    { nome: "Geografia", classe: "7ª Classe", nivel: "secundario1" },

    { nome: "Língua Portuguesa", classe: "8ª Classe", nivel: "secundario1" },
    { nome: "Matemática", classe: "8ª Classe", nivel: "secundario1" },
    { nome: "Física e Química", classe: "8ª Classe", nivel: "secundario1" },
    { nome: "Biologia", classe: "8ª Classe", nivel: "secundario1" },
    { nome: "História", classe: "8ª Classe", nivel: "secundario1" },
    { nome: "Geografia", classe: "8ª Classe", nivel: "secundario1" },

    { nome: "Língua Portuguesa", classe: "9ª Classe", nivel: "secundario1" },
    { nome: "Matemática", classe: "9ª Classe", nivel: "secundario1" },
    { nome: "Física e Química", classe: "9ª Classe", nivel: "secundario1" },
    { nome: "Biologia", classe: "9ª Classe", nivel: "secundario1" },
    { nome: "História", classe: "9ª Classe", nivel: "secundario1" },
    { nome: "Geografia", classe: "9ª Classe", nivel: "secundario1" },
  ],

  // ---------------------------------------------------------------------------
  // 2º CICLO – RAMO CIÊNCIAS FÍSICO-BIOLÓGICAS
  // ---------------------------------------------------------------------------
  puniv: [
    { nome: "Matemática", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Física", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Química", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Biologia", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Língua Portuguesa", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },

    { nome: "Matemática", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Física", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Química", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Biologia", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Língua Portuguesa", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },

    { nome: "Matemática", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Física", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Química", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Biologia", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
    { nome: "Língua Portuguesa", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Físico-Biológicas" },
  ],

  // ---------------------------------------------------------------------------
  // 2º CICLO – CIÊNCIAS ECONÓMICAS E JURÍDICAS
  // ---------------------------------------------------------------------------
  economicas: [
    { nome: "Matemática", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Economia", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Contabilidade", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Direito", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Língua Portuguesa", classe: "10ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },

    { nome: "Matemática", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Economia", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Contabilidade", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Direito", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Língua Portuguesa", classe: "11ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },

    { nome: "Matemática", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Economia", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Contabilidade", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Direito", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
    { nome: "Língua Portuguesa", classe: "12ª Classe", nivel: "secundario2", curso: "Ciências Económicas e Jurídicas" },
  ],

  // ---------------------------------------------------------------------------
  // TÉCNICO – INFORMÁTICA / GESTÃO / CONSTRUÇÃO / GENÉRICO
  // ---------------------------------------------------------------------------
  tecnico_informatica: [
    { nome: "Lógica de Programação", classe: "10ª Classe", nivel: "tecnico", curso: "Técnico de Informática" },
    { nome: "Arquitetura de Computadores", classe: "10ª Classe", nivel: "tecnico", curso: "Técnico de Informática" },
    { nome: "Redes de Computadores", classe: "11ª Classe", nivel: "tecnico", curso: "Técnico de Informática" },
    { nome: "Sistemas Operativos", classe: "11ª Classe", nivel: "tecnico", curso: "Técnico de Informática" },
    { nome: "Programação Avançada", classe: "12ª Classe", nivel: "tecnico", curso: "Técnico de Informática" },
    { nome: "Projecto Tecnológico", classe: "13ª Classe", nivel: "tecnico", curso: "Técnico de Informática" },
  ],

  tecnico_gestao: [
    { nome: "Introdução à Gestão", classe: "10ª Classe", nivel: "tecnico", curso: "Técnico de Gestão" },
    { nome: "Contabilidade Geral", classe: "10ª Classe", nivel: "tecnico", curso: "Técnico de Gestão" },
    { nome: "Fiscalidade", classe: "11ª Classe", nivel: "tecnico", curso: "Técnico de Gestão" },
    { nome: "Gestão de Recursos Humanos", classe: "11ª Classe", nivel: "tecnico", curso: "Técnico de Gestão" },
    { nome: "Contabilidade Analítica", classe: "12ª Classe", nivel: "tecnico", curso: "Técnico de Gestão" },
    { nome: "Projecto de Gestão", classe: "13ª Classe", nivel: "tecnico", curso: "Técnico de Gestão" },
  ],

  tecnico_construcao: [
    { nome: "Desenho Técnico", classe: "10ª Classe", nivel: "tecnico", curso: "Técnico de Construção Civil" },
    { nome: "Materiais de Construção", classe: "10ª Classe", nivel: "tecnico", curso: "Técnico de Construção Civil" },
    { nome: "Topografia", classe: "11ª Classe", nivel: "tecnico", curso: "Técnico de Construção Civil" },
    { nome: "Estruturas", classe: "12ª Classe", nivel: "tecnico", curso: "Técnico de Construção Civil" },
    { nome: "Projecto de Construção", classe: "13ª Classe", nivel: "tecnico", curso: "Técnico de Construção Civil" },
  ],

  tecnico_base: [
    { nome: "Matemática Aplicada", classe: "10ª Classe", nivel: "tecnico" },
    { nome: "Tecnologia e Sociedade", classe: "10ª Classe", nivel: "tecnico" },
    { nome: "Projecto Integrador I", classe: "11ª Classe", nivel: "tecnico" },
    { nome: "Projecto Integrador II", classe: "12ª Classe", nivel: "tecnico" },
    { nome: "Estágio Curricular", classe: "13ª Classe", nivel: "tecnico" },
  ],

  // ---------------------------------------------------------------------------
  // TÉCNICO DE SAÚDE – ENFERMAGEM / FARMÁCIA / ANÁLISES
  // ---------------------------------------------------------------------------
  saude_enfermagem: [
    { nome: "Fundamentos de Enfermagem", classe: "10ª Classe", nivel: "saude", curso: "Técnico de Enfermagem" },
    { nome: "Anatomia e Fisiologia", classe: "10ª Classe", nivel: "saude", curso: "Técnico de Enfermagem" },
    { nome: "Enfermagem Médica", classe: "11ª Classe", nivel: "saude", curso: "Técnico de Enfermagem" },
    { nome: "Enfermagem Cirúrgica", classe: "11ª Classe", nivel: "saude", curso: "Técnico de Enfermagem" },
    { nome: "Enfermagem Comunitária", classe: "12ª Classe", nivel: "saude", curso: "Técnico de Enfermagem" },
    { nome: "Saúde Materno-Infantil", classe: "13ª Classe", nivel: "saude", curso: "Técnico de Enfermagem" },
  ],

  saude_farmacia_analises: [
    { nome: "Fundamentos de Farmácia", classe: "10ª Classe", nivel: "saude", curso: "Farmácia / Análises Clínicas" },
    { nome: "Microbiologia", classe: "11ª Classe", nivel: "saude", curso: "Farmácia / Análises Clínicas" },
    { nome: "Bioquímica Clínica", classe: "11ª Classe", nivel: "saude", curso: "Farmácia / Análises Clínicas" },
    { nome: "Imunologia", classe: "12ª Classe", nivel: "saude", curso: "Farmácia / Análises Clínicas" },
    { nome: "Tecnologia Farmacêutica", classe: "13ª Classe", nivel: "saude", curso: "Farmácia / Análises Clínicas" },
  ],
};
