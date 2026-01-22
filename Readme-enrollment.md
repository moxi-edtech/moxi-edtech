3. A Estrutura de Dados Ideal (ERD)
Esta estrutura suporta o cenário angolano perfeitamente:

cursos: "Técnico de Informática"

classes: "10ª Classe" (Vinculada ao Curso).

Nota: Aqui defines as disciplinas. Se mudares a disciplina de Matemática aqui, afeta a A, B e C.

turmas: "10ª A - Manhã", "10ª B - Tarde" (Vinculadas à Classe).

matriculas: Vincula Aluno -> Turma.

### Funil de Admissão (para novos candidatos)
- Cadastro (lead): cria `alunos` com número de processo automático e registra a intenção em `candidaturas` (curso/ano_letivo). Nenhuma matrícula ou profile é criada aqui.
- Conversão: a matrícula oficial acontece ao confirmar a candidatura via endpoint dedicado, que insere em `matriculas`, gera `numero_matricula` (e login) e marca a candidatura como `matriculado`.
- Identificadores: `numero_processo` vive em `alunos` (fixo por escola); `numero_matricula` nasce em `matriculas` no momento da conversão.

### Fluxo de Matrícula via Importação (Modo 'migracao')
Para alunos existentes que são migrados para o sistema via planilha, o fluxo é diferente e mais direto:

1.  **Criação Pendente**: A importação (`importar_alunos_v4`) cria a `matricula` diretamente com `status = 'pendente'`, sem passar pelo funil de `candidaturas`.
2.  **Ativação em Lote**: A matrícula só se torna `'ativa'` e recebe um `numero_matricula` depois que um administrador aprova a `turma` correspondente na tela de "Gestão de Turmas".

#### Preferência de Turma (melhor UX)
- Passo 4 (Interesse Académico): secretaria escolhe Curso → Classe → Turno; o sistema lista automaticamente turmas ativas do ano letivo e permite marcar uma preferência.
- Salva em `candidaturas.turma_preferencial_id` (novo campo). Na conversão da matrícula essa turma é pré-selecionada se ainda estiver disponível.
- Benefício: a secretária enxerga turno, código da turma e vagas restantes antes do pagamento, mas pode optar por decidir depois.

#### Nota de correção recente
- Problema: dropdown de “Turma Final” vazio porque o fetch usava apenas `session_id` e a view não filtrava corretamente o ano letivo.
- Medida: o front agora envia o ano derivado da sessão e a rota `/api/secretaria/turmas-simples` resolve `ano/ano_letivo` a partir do `session_id`, filtrando por ano ou sessão; as turmas voltam a aparecer de acordo com o ano selecionado.

#### Ponte de Recebimento (Financeiro)
- Cadastro envia método/ref/comprovativo de pagamento e gera notificação `target_role=financeiro`.
- Inbox em `/financeiro/candidaturas` lista candidaturas `pendente/aguardando_compensacao` com ação de Compensar/Rejeitar.
- A confirmação chama a RPC oficial `confirmar_matricula` (gera número via trigger) e conclui o funil end-to-end.

#### Retomada Inteligente (Pagamento posterior)
- Ao abrir uma candidatura em `aguardando_pagamento`, o Wizard salta direto para o Passo 3 (Pagamento/Conversão).
- Dados dos Passos 1/2 ficam em leitura (read-only); botão “Editar Dados” volta ao Passo 1.
- Evita duplicidade de leads e reduz fricção para pais que retornam com comprovativo.

#### Arquivamento (Limpeza de Radar)
- Candidaturas sem retorno podem ser arquivadas via ação “Arquivar” no Radar.
- Backend: RPC `admissao_archive` atualiza status para `arquivado` e registra em `candidaturas_status_log`.
- Histórico permanece disponível para reengajamento futuro.

4. Exemplo Prático (SQL)
Quando quiseres ver "Todos os alunos da 10ª de Informática" (o cenário que descreveste), tu não precisas de mudar a matrícula. Basta fazeres a query certa.

Query: Obter todos os alunos da 10ª Classe de Informática (Independente da Turma)

SQL

SELECT 
  alunos.nome,
  turmas.nome as turma, -- Mostra se é A ou B, mas lista todos juntos
  cursos.nome as curso
FROM matriculas
JOIN turmas ON matriculas.turma_id = turmas.id
JOIN classes ON turmas.classe_id = classes.id
JOIN cursos ON turmas.curso_id = cursos.id
WHERE 
  classes.nome = '10ª Classe' 
  AND cursos.nome = 'Técnico de Informática';
5. Resumo da Melhor Prática
Matrícula: Sempre na Turma (Menor unidade). É impossível gerir uma escola sem saber o turno e a sala do aluno.

Gestão Curricular: Sempre na Classe/Curso (Maior unidade). As disciplinas e as pautas de exame são definidas aqui.

Relatórios:

Mini-Pauta: Filtra por Turma (para o Professor entregar).

Pauta Geral / Termo: Filtra por Classe/Curso (para a Secretaria publicar).

6. Liberação de acesso (novo)
- Após cadastro ou importação, a secretaria pode liberar credenciais em lote em `/secretaria/acesso-alunos` (gera código de ativação, cria usuário/profile se preciso e notifica via WhatsApp/Email). Ativação self-service: `/ativar-acesso` com código + BI.
