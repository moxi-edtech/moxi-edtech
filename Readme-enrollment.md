3. A Estrutura de Dados Ideal (ERD)
Esta estrutura suporta o cenário angolano perfeitamente:

cursos: "Técnico de Informática"

classes: "10ª Classe" (Vinculada ao Curso).

Nota: Aqui defines as disciplinas. Se mudares a disciplina de Matemática aqui, afeta a A, B e C.

turmas: "10ª A - Manhã", "10ª B - Tarde" (Vinculadas à Classe).

matriculas: Vincula Aluno -> Turma.

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
