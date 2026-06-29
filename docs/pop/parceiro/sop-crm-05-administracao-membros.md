# SOP-CRM-05 - Gestão de Operadores Internos e PINs de Acesso

Versao: 1.1.0
Data: 2026-06-29
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_admin (Emanuel Caetano / Administrador)

## 1. Objetivo

Documentar o estado atual da gestão de membros do parceiro, distinguindo o que o parceiro consegue fazer no portal do que pertence ao Super Admin.

## 2. Quando usar

- Ao precisar entender como operadores acessam o portal do parceiro.
- Ao contratar, desligar ou alterar acesso de colaborador, para saber que a operação deve ser solicitada ao Super Admin no codigo atual.

## 3. Responsáveis

- **Solicitante:** Administrador do parceiro (`afiliado_admin`), ex: Emanuel Caetano.
- **Executor de credenciais no sistema:** Super Admin da KLASSE.
- **Escalonamento:** Suporte técnico da KLASSE (caso haja falhas na sincronização de PINs com o banco).

## 4. Pré-condições

- Nome completo e dados do colaborador a ser cadastrado.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/api/influencers/[codigo]/members/route.ts`, `apps/web/src/app/api/influencers/session/route.ts` e `apps/web/src/app/api/super-admin/influencers/[id]/members/route.ts`.

- No portal publico do parceiro, membros sao listados para login via `GET /api/influencers/{codigo}/members`.
- A sessao do operador e criada por `POST /api/influencers/session`, usando `memberId` e `pin`.
- No namespace do parceiro nao existem `POST`, `PATCH` ou `DELETE` para criar, desativar, remover ou resetar PIN.
- Criar/desativar/remover membros existe no Super Admin em `/api/super-admin/influencers/{id}/members`.
- Reset de PIN pelo parceiro e `NAO OPERACIONAL NO CODIGO ACTUAL`; a rota Super Admin atual cria, alterna ativo e remove quando permitido, mas nao expõe PATCH de troca de PIN.

## 5. Passo a passo (execução)

1. **Solicitar criação ao Super Admin:**
   - Enviar nome do colaborador e estado desejado (`ativo`) ao Super Admin.
   - O Super Admin cria o membro no painel proprio.
2. **Entrega de Credenciais:**
   - Informe ao novo colaborador o código geral do escritório (ex.: `AELS`) e o PIN provisório definido.
3. **Primeiro Acesso (Operador):**
   - Ao acessar `/influencers/[codigo]`, o operador deverá selecionar seu nome na lista e digitar o PIN provisório.
4. **Desativação de Colaborador (Desligamento):**
   - Solicitar ao Super Admin a alteração de `ativo` para `false`.
   - O parceiro nao consegue executar esta acao diretamente no portal atual.
5. **Resetar PIN de Membro:**
   - NAO OPERACIONAL NO CODIGO ACTUAL no portal do parceiro.
   - Solicitar tratativa ao Super Admin; se necessario, criar novo membro ou evoluir a rota de administracao para troca de PIN.

## 6. Resultado esperado

- Operador consegue autenticar quando o Super Admin cria/ativa o membro.
- Membro inativo deixa de autenticar.
- Operacoes de credenciais permanecem rastreadas pelo Super Admin.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Colaborador inativo tenta logar | O status do membro está marcado como inativo. | Solicitar ativacao ao Super Admin. | Caso o Super Admin ative e o login continue falhando. |
| Parceiro nao encontra tela de membros | A tela nao existe no portal do parceiro atual. | Solicitar criacao/desativacao ao Super Admin. | Se a gestao local precisar ser implementada. |
| Esquecimento de PIN | Reset de PIN nao existe no portal do parceiro atual. | Escalar para Super Admin definir tratativa. | Se houver urgencia operacional. |

## 8. Evidências obrigatórias

- Print do membro aparecendo na lista publica de login do parceiro.
- Confirmacao do Super Admin sobre criacao, ativacao ou desativacao.

## 9. KPI operacional do procedimento

- **SLA de solicitacao ao Super Admin:** imediato no mesmo dia do desligamento.
- **SLA de execucao:** conforme disponibilidade do Super Admin ate a funcionalidade existir no portal do parceiro.

## 10. Riscos e controles

- **Risco:** Parceiro assumir que consegue desativar operador localmente.
  - *Controle:* Manter procedimento claro: desativacao e criacao sao operacoes de Super Admin no codigo atual.
