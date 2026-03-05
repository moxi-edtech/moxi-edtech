# Relatório — Liberação de acesso (Portal do Aluno/Encarregado)

Data: 2026-03-02T15:28:02Z (Atualizado: 2026-03-04)

## Objetivo
Validar se escolas com portal do aluno concedido conseguem liberar acesso dos alunos e se a liberação é efetivada no backend.

## Verificações realizadas

1. **Gate de portal concedido na API de liberação**
   - Endpoint: `POST /api/secretaria/alunos/liberar-acesso`
   - Validação adicionada: consulta `escolas.aluno_portal_enabled` e bloqueio com `409` quando desativado.

2. **Autorização por escola e usuário**
   - A rota exige usuário autenticado.
   - Resolve `escolaId` via `resolveEscolaIdForUser(...)`.
   - Valida permissão com `authorizeEscolaAction(...)`.

3. **Liberação real no backend + credenciais imediatas**
   - A rota chama `rpc('request_liberar_acesso', ...)`.
   - A função SQL `request_liberar_acesso` chama `liberar_acesso_alunos_v2`.
   - `liberar_acesso_alunos_v2` atualiza `alunos.acesso_liberado = true`, define `codigo_ativacao`, `data_ativacao` e enfileira notificação (`outbox_notificacoes`).
   - `request_liberar_acesso` também enfileira evento de provisionamento (`outbox_event`).
   - **Novo:** a API busca `bi_numero` e chama `activateStudentAccess` para gerar login/senha no ato da liberação (quando possível).

4. **Gerenciamento de Habilitação do Portal (Super Admin)**
   - Identificado que o frontend do Super Admin (`EscolaMonitor.tsx`) falhava ao tentar atualizar a flag `aluno_portal_enabled` via cliente, devido a restrições de RLS.
   - **Correção:** Criada a API `/api/super-admin/escolas/[id]/update` que utiliza a RPC segura `check_super_admin_role` para autorização e executa o update via backend, resolvendo o problema de delegação de acesso e cumprindo com o `SERVICE_ROLE_INVENTORY.md`.

5. **Bloqueio automático por inadimplência (server-side)**
   - Local: `apps/web/src/app/(portal-aluno)/aluno/layout.tsx`
   - Se `configuracoes_financeiro.bloquear_inadimplentes = true` e houver mensalidades vencidas há mais de 30 dias, o portal redireciona para `/aluno/desabilitado` antes de renderizar.
   - Considera alunos diretos e educandos vinculados ao encarregado.

6. **Portal do aluno habilitado sem gate de plano**
   - O acesso agora depende apenas de `aluno_portal_enabled`.
   - Evita bloqueio indevido em escolas com plano `essencial`.

## Fluxo de Acesso do Aluno (Pós-Liberação)
Após a liberação pela secretaria, o aluno segue o seguinte fluxo de ativação:
1.  **Portal de Ativação:** O aluno acessa `/ativar-acesso`.
2.  **Validação de Identidade:** Deve inserir o `Código de Ativação` (KLASSE-XXXXXX) e o `Número do BI` cadastrado.
3.  **Provisionamento:** O sistema valida os dados e chama o job `activateStudentAccess`, que cria o usuário no Auth (e-mail: `aluno_<matricula>@escola.ao` quando disponível), gera senha temporária e sincroniza o `profile`.
4.  **Primeiro Acesso:** O aluno realiza o login e é instruído a definir sua senha definitiva.

## Resultado
- **Ativação pelo Super Admin:** Agora é possível habilitar ou desabilitar o acesso ao Portal do Aluno com segurança através do Painel de Monitoramento da Escola.
- **Escola com portal concedido (`aluno_portal_enabled = true`)**: consegue executar a liberação, desde que tenha permissão de ação na escola.
- **Escola sem portal concedido (`aluno_portal_enabled = false`)**: recebe bloqueio explícito (`409`) antes da RPC.
- **Efetivação da liberação**: ocorre no banco (marca acesso liberado e gera código) e agora retorna credenciais imediatas no painel da secretaria.
- **Bloqueio automático (inadimplência)**: o portal é bloqueado server-side quando a configuração estiver ativa e o aluno tiver mensalidade vencida > 30 dias.
- **Reset de senha**: caso o aluno ainda não tenha `usuario_auth_id`, o reset tenta ativar via `codigo_ativacao` + `bi_numero` e retorna login/senha.

## Observação operacional
> **⚠️ NOTA DE FOCO FUTURO:** O status retornado pela API permanece como `queued`. Parte do fluxo (notificação/provisionamento) é assíncrona. O fluxo de ativação do aluno (`/ativar-acesso`) foi mapeado tecnicamente, mas será objeto de testes manuais e refinamento de UX em um momento posterior conforme orientação do usuário.
