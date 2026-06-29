# POP-P2-01 - Politicas Financeiras de Cobranca (Admin)

Versao: 1.1.0
Data: 2026-06-28
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 10-20 minutos

## 1. Objetivo

Padronizar a definicao e publicacao das politicas financeiras globais da escola (vencimento, multa, juros e bloqueio por inadimplencia).

## 2. Quando usar

- Implantacao inicial do financeiro.
- Revisao de politica de cobranca.
- Mudanca de regra contratual de inadimplencia.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Financeiro/Secretaria
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso a `Admin > Configuracoes > Financeiro`.
- Escola correta selecionada.
- Alinhamento interno sobre impacto de multas/juros/bloqueio.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/financeiro/page.tsx`.

- A pagina usa o titulo `Financeiro · Políticas de Cobrança` e carrega via `GET /api/escola/{escola}/admin/configuracoes/financeiro` com `cache: no-store`.
- Os blocos reais sao `Regras de Cobrança`, `Restrição Automática` e um card informativo `Mensalidades & Emolumentos`.
- O salvamento chama `POST /api/escola/{escola}/admin/configuracoes/financeiro` e depois `POST /api/escola/{escola}/admin/setup/commit` com `Idempotency-Key`.
- O toast de sincronizacao e `Aplicando regras financeiras...`; sucesso: `Política financeira atualizada.`; erro: `Erro ao salvar regras.`.

## 5. Procedimento A - Carregar configuracao atual

1. Abrir `Admin > Configuracoes > Financeiro`.
2. Confirmar o titulo `Financeiro · Políticas de Cobrança`.
3. Aguardar carregamento completo do formulario (sem estado `Carregando dados financeiros...`).
4. Validar se os dados atuais foram carregados para revisao antes de alterar.

## 6. Procedimento B - Ajustar regras de cobranca

1. No bloco `Regras de Cobrança`, definir:
- `Dia de Vencimento Padrão` (opcoes disponiveis: 1, 5, 10, 15, 20, 25, 30)
- `Multa por Atraso (%)`
- `Juros Diários (Mora)` com passo decimal
2. Rever coerencia entre multa e juros antes de salvar.

## 7. Procedimento C - Definir politica de inadimplencia

1. No bloco `Restrição Automática`, decidir o toggle de `bloquear inadimplentes`.
2. Quando ativado, validar internamente a regra operacional aplicada ao portal do aluno apos 30 dias de atraso.
3. Confirmar alinhamento com contrato/politica da escola antes da publicacao.

## 8. Procedimento D - Salvar e publicar

1. Acionar `Salvar` no shell de configuracao.
2. Aguardar o estado de sincronizacao (`Aplicando regras financeiras...`).
3. Confirmar mensagem final de sucesso `Política financeira atualizada.`
4. Atualizar a pagina e validar persistencia dos valores.

## 9. Resultado esperado

- Regras financeiras atualizadas e persistidas.
- Politica de inadimplencia no estado esperado (ativa/inativa).
- Configuracao publicada sem erro.

## 10. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `Erro ao salvar regras.` | Falha na API ou no commit de setup | Repetir salvamento e validar conectividade | Erro recorrente apos novas tentativas |
| Endpoint financeiro indisponivel | Rota retornou indisponibilidade | Recarregar pagina e tentar novamente | Endpoint continuar indisponivel |
| Valores voltam ao padrao apos refresh | Publicacao nao concluida | Salvar novamente e confirmar sucesso final | Persistencia continuar falhando |

## 11. Evidencias obrigatorias

- Captura final dos campos financeiros salvos.
- Captura do estado do toggle de inadimplencia.
- Registo interno de data/hora e operador.

## 12. Referencia tecnica (fiel ao codigo)

- Carregamento: `GET /api/escola/{escola}/admin/configuracoes/financeiro` (`cache: no-store`)
- Gravacao: `POST /api/escola/{escola}/admin/configuracoes/financeiro`
- Publicacao setup: `POST /api/escola/{escola}/admin/setup/commit` com `Idempotency-Key`

## 13. Revisao e versao

- Ultima revisao: 2026-06-28
- Proxima revisao: 2026-07-12
- Mudancas desta versao: marcado como validado contra codigo e documentados blocos/toasts/endpoints reais.
