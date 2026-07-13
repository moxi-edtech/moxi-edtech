# SOP-CRM-05 - Gestão de Operadores Internos e PINs de Acesso

Versao: 1.1.0
Data: 2026-06-29
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_admin (Emanuel Caetano / Administrador)

## 1. Objetivo

Documentar a gestão de membros do parceiro no portal, incluindo criação, ativação/desativação, reset de PIN e login individual por operador.

## 2. Quando usar

- Ao precisar entender como operadores acessam o portal do parceiro.
- Ao contratar, desligar ou alterar acesso de colaborador no portal do parceiro.

## 3. Responsáveis

- **Executor:** Administrador do parceiro (`afiliado_admin`), ex: Emanuel Caetano.
- **Supervisão:** Super Admin da KLASSE, quando houver falha técnica ou necessidade de auditoria.
- **Escalonamento:** Suporte técnico da KLASSE (caso haja falhas na sincronização de PINs com o banco).

## 4. Pré-condições

- Nome completo e dados do colaborador a ser cadastrado.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/api/influencers/[codigo]/members/route.ts`, `apps/web/src/app/api/influencers/[codigo]/team/route.ts`, `apps/web/src/app/api/influencers/session/route.ts` e `apps/web/src/app/api/super-admin/influencers/[id]/members/route.ts`.

- No portal publico do parceiro, membros sao listados para login via `GET /api/influencers/{codigo}/members`.
- A sessao do operador e criada por `POST /api/influencers/session`, usando `memberId` e `pin`.
- A gestão de equipe do parceiro usa `/api/influencers/{codigo}/team` para listar, criar, atualizar status/papel e resetar PIN conforme permissões do membro logado.
- O Super Admin mantém gestão administrativa em `/api/super-admin/influencers/{id}/members`.

## 5. Passo a passo (execução)

1. **Criar membro no portal do parceiro:**
   - Aceda à aba `Equipe`.
   - Informe nome, papel operacional e PIN inicial.
   - Grave o membro e confirme que aparece na listagem.
2. **Entrega de Credenciais:**
   - Informe ao novo colaborador o código geral do escritório (ex.: `AELS`) e o PIN provisório definido.
3. **Primeiro Acesso (Operador):**
   - Ao acessar `/influencers/[codigo]`, o operador deverá selecionar seu nome na lista e digitar o PIN provisório.
4. **Desativação de Colaborador (Desligamento):**
   - Na aba `Equipe`, marque o membro como inativo.
   - Confirme que o colaborador deixa de autenticar.
5. **Resetar PIN de Membro:**
   - Use a ação de reset de PIN na aba `Equipe`.
   - Entregue o novo PIN ao colaborador por canal seguro.

## 6. Resultado esperado

- Operador consegue autenticar quando o administrador do parceiro cria/ativa o membro.
- Membro inativo deixa de autenticar.
- Operacoes de credenciais permanecem rastreadas e auditáveis.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Colaborador inativo tenta logar | O status do membro está marcado como inativo. | Reativar na aba `Equipe`, se aplicável. | Caso a reativação seja feita e o login continue falhando. |
| Parceiro nao encontra tela de membros | Sessão sem papel permitido ou navegação desatualizada. | Confirmar papel do utilizador e aceder à aba `Equipe`. | Se um admin/owner não conseguir aceder à gestão. |
| Esquecimento de PIN | PIN antigo foi perdido ou comprometido. | Resetar PIN na aba `Equipe` e comunicar por canal seguro. | Se o reset falhar ou o operador continuar sem autenticar. |

## 8. Evidências obrigatórias

- Print do membro aparecendo na lista publica de login do parceiro.
- Print ou registo da aba `Equipe` mostrando criação, ativação/desativação ou reset.

## 9. KPI operacional do procedimento

- **SLA de desligamento:** inativação no mesmo dia.
- **SLA de criação/reset:** execução pelo administrador do parceiro no momento da solicitação operacional.

## 10. Riscos e controles

- **Risco:** PIN ser partilhado fora do canal autorizado.
  - *Controle:* Usar login individual por membro e resetar PIN imediatamente em caso de exposição.
