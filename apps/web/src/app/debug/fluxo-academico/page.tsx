'use client'
import Mermaid from '@/components/Mermaid'
import { fluxoAcademico } from '@/lib/diagrams'

const chart = `flowchart TD

%% =====================
%% ADMIN CONFIGURAÇÕES INICIAIS
%% =====================
A1[Admin: Criar Ano Letivo (Session)] --> A2[Admin: Criar Semestres]
A2 --> A3[Admin: Criar Turmas]
A3 --> A4[Admin: Criar Períodos/Bimestres]
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

export default function FluxoAcademicoPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Fluxo Acadêmico</h1>

      <Mermaid chart={fluxoAcademico} className="overflow-auto rounded-lg border bg-white p-4" />
    </main>
  )
}
