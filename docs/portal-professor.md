# Portal do Professor — MVP

## Objetivo
Disponibilizar ao professor um portal focado na operação diária (turmas, presenças, notas, horário), evitando fluxos administrativos. O portal deve funcionar com credenciais simples, experiência clara e sem dependência de e‑mail.

## Progresso atual

### Autenticação e acesso
- Login do professor redireciona para `/professor`.
- Portal do professor possui rotas ativas:
  - `/professor` (dashboard simples)
  - `/professor/frequencias`
  - `/professor/notas`
  - `/professor/fluxos`

### Frequências (professor)
- Tela reorganizada para fluxo único: Turma → Disciplina → Data → Presenças.
- Layout em duas colunas (seleção/status à esquerda, lista à direita).
- UI alinhada ao padrão visual KLASSE (rounded‑xl, focus gold, botões padrão).
- Fluxo sem “fechamento de período” (admin removido da UI).

### Cadastro e competências (para alimentar o portal)
- Cadastro de professor via `/escola/[id]/professores` com stepper 3 passos.
- Skills do professor salvas em `teacher_skills`.
- Turnos disponíveis e carga horária máxima salvos em `teachers`.
- Auto‑completar respeita `turnos_disponiveis`.

### Atribuição (respeitando competências)
- Dropdown de professores filtrado pelas skills da disciplina.

## Backlog (MVP)

### 1) Minhas turmas e disciplinas
- Implementado no `/professor` com cards e disciplina listada.

### 2) Horário do professor
- Implementado no `/professor` como agenda semanal (read‑only).

### 3) Lançamento de notas
- Revisado com layout em duas colunas e UI padrão KLASSE.
- Seleção Turma → Disciplina → Período → Nota.

### 4) Perfil do professor
- Visualizar e atualizar dados pessoais, turnos, carga máxima e skills.

### 5) Comunicação básica
- Mural simples de comunicados e alertas.

## Ajustes técnicos pendentes
- Padronizar redirects para rotas do professor.
- Consolidar nav do professor com rotas existentes.
- Adicionar tratamentos de empty state para turmas/disciplinas não atribuídas.

## Indicadores de pronto (MVP)
- Professor consegue entrar e ver suas turmas e disciplinas.
- Consegue registrar presenças do dia.
- Consegue lançar notas do período.
- Consegue ver seu horário semanal.
- Não cai em telas administrativas.
