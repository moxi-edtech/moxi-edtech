# Regras de Negócio — Secretaria, Admissões e Matrículas

Este documento resume regras oficiais de Secretaria que o KLASSE Brain pode usar ao orientar usuários administrativos. Quando houver dúvida, o assistente deve citar que a operação final acontece nas telas e APIs oficiais do KLASSE, não executar a ação sozinho.

## Cadastro de aluno

- O cadastro de aluno deve ser feito em Secretaria > Alunos > Novo Aluno.
- Dados pessoais, contatos e encarregado de educação devem ser preenchidos com atenção porque alimentam documentos, acessos e comunicação.
- O assistente pode orientar o caminho e explicar campos, mas não deve cadastrar aluno automaticamente.

Fonte: `apps/web/src/lib/assistant/docs/manual-secretaria.md`

## Matrícula e admissão

- A finalização de admissão para matrícula usa fluxo canônico via RPC `admissao_finalizar_matricula`.
- A finalização valida escola, candidatura, turma, preço/pagamento, capacidade e idempotência.
- A operação transforma a candidatura em matrícula dentro de fluxo transacional, evitando duplicidade.
- Requisições duplicadas devem reutilizar resultado idempotente quando disponível.
- Se o aluno/documento já tiver admissão em andamento, o usuário deve retomar o rascunho existente.
- Se já houver matrícula finalizada no ano letivo, o usuário deve abrir a matrícula existente ou corrigir a candidatura duplicada.

Fonte: `apps/web/src/app/api/secretaria/admissoes/convert/route.ts`

## Capacidade de turma

- Turma lotada bloqueia a finalização normal da matrícula.
- Override de capacidade só é permitido a responsável autorizado.
- Override de capacidade exige motivo obrigatório.
- Quando há override, o sistema registra auditoria específica com capacidade, matriculados anteriores e motivo.

Fonte: `apps/web/src/app/api/secretaria/admissoes/convert/route.ts`

## Comprovante e auditoria

- Após matrícula finalizada, o sistema tenta emitir comprovante de matrícula automaticamente.
- A conversão de admissão em matrícula registra auditoria.
- A emissão de comprovante também registra evento de auditoria.
- Se o comprovante falhar, a matrícula pode estar concluída e o usuário deve tratar a emissão do documento separadamente.

Fonte: `apps/web/src/app/api/secretaria/admissoes/convert/route.ts`

## Documentos oficiais

- Documentos oficiais devem ser emitidos pela área Secretaria > Documentos.
- O assistente pode explicar o caminho e preparar texto auxiliar, mas não deve emitir documento oficial sem ação explícita do usuário na tela própria.
- Documentos oficiais podem ter valor legal; respostas devem evitar sugerir atalhos fora do fluxo oficial.

Fonte: `apps/web/src/lib/assistant/docs/manual-secretaria.md`

## O que o assistente pode dizer

- Pode explicar onde cadastrar aluno, abrir ficha, matricular, acessar documentos ou verificar turmas.
- Pode explicar por que uma matrícula pode estar bloqueada por duplicidade, turma lotada ou falta de permissão.
- Pode sugerir abrir a tela correta.

## O que o assistente não pode inventar

- Não inventar matrícula sem candidatura/turma válida.
- Não prometer override de capacidade para usuário sem autorização.
- Não dizer que documento oficial foi emitido se a emissão não ocorreu.
- Não sugerir correção direta em banco de dados.
