## Resumo das Novas Funcionalidades

- **Fluxo de Importação Híbrido (v4)**: O wizard de importação agora suporta dois modos: `migracao` (para alunos existentes) e `onboarding` (para novos candidatos). Em modo `migracao`, o sistema cria `turmas` como `'rascunho'` e `matriculas` como `'pendente'`, aguardando aprovação.

- **Aprovação Centralizada e Implícita**: A página de "Gestão de Turmas" agora é o ponto central para ativação. Ao aprovar uma turma em `'rascunho'`, o sistema automaticamente:
    1.  **"Materializa" o Curso**: Cria (ou aprova) o curso inferido do código da turma.
    2.  **Ativa a Turma**: Muda o status da turma para `'aprovado'`.
    3.  **Ativa as Matrículas**: Converte todas as matrículas `'pendentes'` daquela turma para `'ativas'`, gerando o número de matrícula oficial.

- **"Escudo Financeiro" na Geração de Mensalidades**: A função `gerar_mensalidades_lote` foi atualizada para respeitar a `data_inicio_financeiro` definida na importação, evitando a geração de cobranças retroativas para alunos migrados.

- **Controle Manual de Geração de Mensalidades**: Foi adicionado um novo componente (`GerarMensalidadesDialog`) ao Dashboard Financeiro, permitindo que a equipe financeira dispare a geração de mensalidades em lote para um mês/ano específico.

- **Busca por Nº de Processo Legado**: Alunos importados mantêm seu número de processo antigo no campo `numero_processo_legado`, que agora é indexado e incluído na busca global, facilitando a transição para a secretaria.

- **Notificações Direcionadas**: O sistema continua a notificar os roles corretos (`admin`, `financeiro`) sobre ações que requerem sua atenção, como turmas em rascunho ou a conclusão de importações.