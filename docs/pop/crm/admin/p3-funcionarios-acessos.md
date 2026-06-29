# POP-P3-01 - Gestao de Funcionarios e Acessos (Admin)

Versao: 1.1.0
Data: 2026-06-28
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 5-15 minutos por cadastro

## 1. Objetivo

Padronizar o cadastro de funcionarios (convite/acesso) e a consulta da equipa ativa no portal.

## 2. Quando usar

- Entrada de novo colaborador administrativo.
- Ajuste de papel de acesso na fase de onboarding interno.
- Conferencia periodica de usuarios ativos/pendentes.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: RH/Secretaria
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso a `Admin > Funcionários`.
- Escola correta selecionada.
- Permissao para `criar_usuario` ou `editar_usuario`.

## 4.1 Estado fiel ao codigo

- A pagina admin `admin/funcionarios` é um wrapper com dois separadores: `Funcionários` e `Cadastrar`.
- O separador `Funcionários` reutiliza `apps/web/src/app/escola/[id]/(portal)/funcionarios/page.tsx`.
- O separador `Cadastrar` reutiliza `apps/web/src/app/escola/[id]/(portal)/funcionarios/novo/page.tsx`.
- O backend retorna `senha_temp` apenas quando cria novo usuario de Auth; para usuario ja existente, o fluxo envia convite e pode nao exibir senha temporaria.

## 5. Procedimento A - Consultar funcionarios cadastrados

1. Entrar em `Admin > Funcionários`.
2. Manter separador `Funcionários` ativo.
3. Usar campo `Buscar funcionário` para filtrar por nome, email ou telefone.
4. Revisar tabela:
- `Nome` e login
- `Contato`
- `Papel`
- `Status` (`Ativo` quando existe `last_login`, `Pendente` quando ainda nao acessou)

## 6. Procedimento B - Cadastrar novo funcionario

1. Ir para separador `Cadastrar`.
2. Preencher obrigatorios:
- `Nome Completo`
- `Email`
- `Papel`
3. Preencher `Telefone` quando aplicavel.
4. Selecionar papel correto:
- `Secretaria`
- `Financeiro`
- `Secretaria + Financeiro`
- `Admin + Financeiro`
- `Staff Admin`
- `Administrador`
5. Clicar `Criar Funcionário`.
6. Confirmar retorno `Funcionário criado com sucesso!`.

## 7. Procedimento C - Entregar credenciais iniciais

1. No bloco `Credenciais geradas`, quando exibido, validar:
- email final
- senha temporaria (quando fornecida)
2. Se existir acao `Copiar credenciais`, usa-la.
3. Se o retorno for convite por email sem senha temporaria, confirmar o `emailStatus`/mensagem de sucesso e registrar que a entrega foi feita por email.
4. Registrar entrega por canal interno seguro quando credenciais temporarias forem exibidas.

## 8. Resultado esperado

- Usuario vinculado a escola com papel correto.
- Funcionario aparece na listagem.
- Credenciais iniciais entregues ao colaborador.

## 9. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `Informe um email válido.` | Formato invalido | Corrigir email e repetir | Email valido continuar rejeitado |
| `Sem permissão` | Perfil executor sem privilegio | Executar com admin autorizado | Regra de permissao divergente |
| `Escola suspensa por pagamento.` | Escola bloqueada por status | Regularizar estado da escola | Status incoerente com operacao |
| `Falha ao criar funcionário` | Erro em auth/job/perfil | Repetir e validar dados | Erro recorrente no mesmo perfil |

## 10. Evidencias obrigatorias

- Captura do formulario submetido (sem expor dados sensiveis em canal aberto).
- Captura de `Funcionário criado com sucesso!`.
- Registo interno de entrega de credenciais (data/hora/responsavel).

## 11. Referencia tecnica (fiel ao codigo)

- Listagem:
- `GET /api/escolas/{id}/funcionarios?q=&page=&pageSize=` (`cache: no-store`)
- Convite/cadastro:
- `POST /api/escolas/{id}/usuarios/invite`
- Campos de payload:
- `nome`, `email`, `telefone`, `papel`
- Retorno esperado:
- `ok`, `userId`, `senha_temp`, `numero_processo_login` (quando existir)

## 12. Revisao e versao

- Ultima revisao: 2026-06-28
- Proxima revisao: 2026-07-12
- Mudancas desta versao: ajustado fluxo de credenciais para refletir usuario novo versus usuario existente no endpoint `usuarios/invite`.
