# Estrutura Escolar: Cursos, Turmas, Anos Letivos e Professores

A estrutura escolar é o que existe **antes** de haver alunos: os cursos e níveis de ensino que a
escola oferece, as turmas que abre a partir deles, o ano letivo em que tudo isso se enquadra e os
professores que ficam associados a cada disciplina. Configura-se uma vez e altera-se pouco, mas
tudo o resto depende dela — sem curso não há turma, sem turma não há matrícula, sem professor
atribuído não há pauta.

## 1. Oferta Formativa (Cursos e Níveis de Ensino)

É aqui que se define **o que a escola ensina**: os cursos e os níveis de ensino disponíveis.

- Caminho: **Configurações > Oferta Formativa** (`/escola/[schoolId]/admin/configuracoes/estrutura`).
- A mesma página também está acessível por **Operações > Configurações > Oferta formativa**.
- A página chama-se "Oferta Formativa" no ecrã. Se um utilizador disser "estrutura" ou "estrutura
  escolar", é quase sempre a este ecrã que se refere.
- Alterar a oferta formativa é uma decisão de direção: mexe no que pode ser vendido e matriculado no
  ano seguinte, não apenas num ecrã de configuração.

## 2. Anos Letivos e Calendário Escolar

O ano letivo é a moldura temporal de tudo: períodos, trimestres, datas de início e fim.

- Caminho: **Configurações > Calendário** (`/escola/[schoolId]/admin/configuracoes/calendario`).
- Nenhuma turma nem matrícula deve ser criada antes de o ano letivo estar configurado e ativo.
- O sistema tem uma **viragem de ano** que transporta a estrutura de um ano para o seguinte. Se a
  viragem detetar problemas na estrutura, encaminha o utilizador para a Oferta Formativa para os
  resolver antes de continuar.

## 3. Turmas e Salas

A turma é a ligação entre um curso, uma classe e um conjunto de alunos, num turno e numa sala.

- Caminho: **Secretaria > Turmas** (`/escola/[schoolId]/secretaria/turmas`) ou
  **Configurações > Turmas** (`/escola/[schoolId]/admin/configuracoes/turmas`).
- Cada turma está associada a um curso e a uma classe específicos, e tem turno e sala.
- O remanejamento de alunos entre turmas da mesma classe faz-se pela ficha do aluno.
- O detalhe da turma tem três separadores: **Alunos**, **Pedagógico** e **Documentos**.

## 4. Atribuir Professores às Turmas

Não existe um ecrã autónomo de "alocação de professores". A atribuição faz-se em dois sítios:

- **A partir da lista de turmas**: a ação de atribuir professores abre uma janela onde se escolhem os
  professores por disciplina.
- **A partir do detalhe da turma**: no separador **Pedagógico**, onde a lista de professores
  disponíveis é carregada para associação às disciplinas da turma.

Se a pergunta for "que turmas não têm professor atribuído" ou "quem dá esta disciplina", o ponto de
partida é sempre o detalhe da turma, separador Pedagógico.

## 5. Configuração Académica Completa

Para montar a estrutura de uma escola nova, existe um assistente que percorre os passos por ordem:
cursos, classes, disciplinas, turmas e professores.

- Caminho: **Configurações > Configuração Académica Completa**
  (`/escola/[schoolId]/admin/configuracoes/academico-completo`).
- É o caminho recomendado quando a escola está a ser configurada de raiz; para ajustes pontuais, os
  ecrãs individuais das secções anteriores são mais diretos.
- Ao sincronizar turmas já existentes, o assistente pede confirmação explícita antes de reconstruir,
  porque a operação pode afetar turmas com alunos.

## 6. Perguntas Frequentes

- **"Onde configuro os cursos?"** → Configurações > Oferta Formativa.
- **"Onde vejo as turmas?"** → Secretaria > Turmas.
- **"Como atribuo um professor a uma turma?"** → Turmas > (ação de atribuir) ou detalhe da turma >
  separador Pedagógico.
- **"Onde mudo o ano letivo?"** → Configurações > Calendário.
- **"A escola é nova, por onde começo?"** → Configurações > Configuração Académica Completa.
