export const fluxoAcademico = `flowchart TD

%% =====================
%% ADMIN CONFIGURAÇÕES INICIAIS
%% =====================
A1[Admin: Criar Ano Letivo (Session)] --> A2[Admin: Criar Semestres]
A2 --> A3[Admin: Criar Períodos/Bimestres]
A3 --> A4[Admin: Criar Turmas]
A4 --> A5[Admin: Criar Cursos/Disciplinas]
A5 --> A6[Admin: Criar Seções (A/B)]
A6 --> A7[Admin: Definir Tipo de Frequência]
A7 --> A8[Admin: Criar Grade de Avaliação]

%% =====================
%% CADASTROS
%% =====================
A8 --> B1[Secretaria: Cadastrar Professores]
B1 --> B2[Secretaria: Atribuir Professores a Turmas/Disciplinas]
B2 --> B3[Secretaria: Cadastrar Alunos]
B3 --> B4[Secretaria: Atribuir Alunos a Turmas/Seções]

%% =====================
%% ROTINA ACADÊMICA
%% =====================
B4 --> C1[Admin/Professores: Criar Rotina Escolar (Horários)]
C1 --> C2[Admin: Adicionar Syllabus por Curso]
C2 --> C3[Professores: Lançar Frequência]
C3 --> C4[Professores: Lançar Notas Parciais]

%% =====================
%% AVALIAÇÕES E RESULTADOS
%% =====================
C4 --> D1[Admin: Criar Sistema de Notas]
D1 --> D2[Admin: Definir Regras de Avaliação]
D2 --> D3[Professores: Submeter Notas Finais (quando liberado)]
D3 --> D4[Secretaria: Consolidar Resultados]
D4 --> D5[Admin/Secretaria: Gerar Relatórios/Boletins]

%% =====================
%% ENCERRAMENTO
%% =====================
D5 --> E1[Admin: Promover Alunos para Nova Turma/Ano]
E1 --> E2[Admin: Arquivar Sessão (Read Only)]

%% =====================
%% SUPORTE E COMUNICAÇÃO
%% =====================
A8 --> N1[Admin: Criar Avisos (Notices)]
N1 --> N2[Admin: Criar Eventos no Calendário]
`

export const configAcademicasAdmin = `flowchart TD
  A[Admin da Escola] --> B[Configurações Acadêmicas]

  B --> C[Criar Ano Letivo]
  C --> D[Criar Semestre/Bimestre]
  D --> E[Definir Tipo de Frequência]
  E --> F[Configurar Grade de Avaliação]
  F --> G[Criar Turma/Classe]
  G --> H[Criar Disciplina/Curso]
  H --> I[Criar Seção/Subturma]
  I --> J[Atribuir Professor]

  J --> J1[Selecionar Professor]
  J --> J2[Vincular à Turma]
  J --> J3[Vincular à Disciplina]
  J --> J4[Associar ao Semestre]

  J --> K[Controle de Fechamento de Notas]
`

export const fluxoCriacaoAdmin = `flowchart TD
    %% ================
    %% CRIAÇÃO DE ESCOLA
    %% ================
    SA[Super Admin] --> C1[Criar Escola]
    C1 --> C2[Gerar Prefixo da Escola (ex: 123)]
    C2 --> C3[Criar Usuário Admin]

    %% ================
    %% CRIAÇÃO DO ADMIN
    %% ================
    C3 --> U1[Definir e-mail obrigatório]
    C3 --> U2[Gerar numero_login: Prefixo + 7 dígitos (ex: 1230001)]
    C3 --> U3[Definir senha manual OU enviar convite]
    U1 --> DB[(profiles)]
    U2 --> DB
    U3 --> DB

    %% ================
    %% LOGIN
    %% ================
    L[Usuário Admin] --> L1[/login]
    L1 -->|E-mail + Senha| AUTH[Autenticação]
    L1 -->|Numero_login (ex: 1230001) + Senha| AUTH
    AUTH -->|Validação OK| DASH[Dashboard da Escola]

    %% ================
    %% RECUPERAÇÃO DE SENHA
    %% ================
    L --> R1[Esqueci a Senha]
    R1 -->|Reset sempre via E-mail| MAIL[Envio de Link de Redefinição]
`
