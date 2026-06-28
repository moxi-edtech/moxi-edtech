# Manual Curto do Portal Secretaria

O Portal da Secretaria do KLASSE é o centro operacional para gerenciar o ciclo de vida dos alunos, matrículas, turmas e emissão de documentos oficiais.

## 1. Cadastro e Matrícula de Alunos
- Para cadastrar um aluno, acesse **Secretaria > Alunos > Novo Aluno** (rota: `/escola/[schoolId]/secretaria/alunos/novo`).
- Preencha os dados pessoais básicos, contatos e informações do encarregado de educação.
- O campo de e-mail do encarregado é essencial para comunicações de cobrança e envio de acessos.
- Após o cadastro, o aluno recebe um número de matrícula único gerado pelo sistema.

## 2. Gestão de Turmas e Enturmação
- O controle de turmas é feito em **Secretaria > Turmas** (rota: `/escola/[schoolId]/secretaria/turmas`).
- O sistema permite criar turmas vinculadas ao ano letivo ativo.
- Para enturmar alunos, acesse a ficha da turma desejada e clique em "Adicionar Alunos" ou gerencie individualmente pela ficha de cada aluno.
- As turmas possuem limite de capacidade configurado por padrão para 70 alunos.

## 3. Emissão de Documentos Oficiais
- Para emitir declarações de frequência, boletins, pautas nominais ou cartões de estudante, acesse **Secretaria > Documentos** (rota: `/escola/[schoolId]/secretaria/documentos`).
- Selecione o aluno ou turma, filtre pelo tipo de documento pretendido e clique em "Gerar Documento".
- Todos os documentos emitidos oficialmente contêm controle de autenticidade rastreável.
