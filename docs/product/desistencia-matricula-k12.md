# Desistência escolar — contrato administrativo KLASSE

**Estado persistido existente:** `public.matriculas.status = 'desistente'`.

## Semântica

- **Desistente**: a escola confirmou que o aluno deixou de frequentar a turma/ano, sem transferência formal e sem conclusão académica.
- **Não é** reprovado, transferido, excluído da escola, anulado retroativamente nem abandono financeiro.
- A confirmação altera **somente** a matrícula atual: `status='desistente'`, `ativo=false`, `motivo_fecho` (10–500 caracteres), `data_fecho=now()`, `status_fecho_origem='manual'` e `updated_by`.
- A matrícula conserva `turma_id`, `numero_chamada`, `numero_matricula`, `session_id` e dados de origem. A ficha geral do aluno permanece.
- **Preservação**: notas, frequências, pauta/histórico oficial, pagamentos, recibos e mensalidades existentes não são eliminados ou recalculados; a operação não determina aprovação nem gera histórico anual.
- A lista operacional mostra só matrículas ativas; o aluno desistente deixa de ocupar a vaga. A lista **histórica** inclui o aluno identificado como **Desistente**.
- **Financeiro**: desistir não equivale a quitação ou cancelamento. Valores já faturados são preservados. Qualquer interrupção de futuras cobranças, crédito ou cancelamento exige política fiscal/financeira própria e auditada; não realizar descontos silenciosos.

## Ações e permissões

| Interface | Ação | Resultado |
|---|---|---|
| Secretaria › Turmas › Alunos | **Marcar desistente** | Finaliza matrícula ativa do ano atual |
| Operações › Explorador de turma | **Marcar desistente** | Mesma API/RPC, sem segunda fonte |
| Perfil do aluno › Matrícula atual | **Marcar desistente** | Exige motivo e confirmação |
| Professor › Frequências › Lista de alunos | **Sinalizar desistência** | Regista alerta, **não** muda matrícula |

- Direção, secretaria e administração escolar podem confirmar. `admin_financeiro` mantém o acesso operacional previsto; o professor não recebe permissão para encerrar.
- Uma sinalização mantém matrícula ativa. Fica associada ao professor e aparece na ação de desistência da Secretaria/Operações para confirmar ou descartar.
- O mesmo professor não pode criar várias sinalizações pendentes da mesma matrícula. Concorrência é tratada pela chave única e pelo lock transacional.
- A confirmação usa `public.registar_desistencia_matricula`, com escola e papel verificados **no banco**. O endpoint genérico legado que bloqueia PUT de status permanece bloqueado.
- O professor sinaliza por `public.sinalizar_desistencia_matricula` **apenas para uma turma atribuída**. A tabela de alertas tem RLS e escrita por RPC, nunca por client direto.
- Uma desistência confirmada **não** pode ser revertida com PUT de status ou edição de aluno. Eventual reativação exige fluxo administrativo separado com auditoria, verificação de elegibilidade e tratamento de eventos concorrentes.

## Condições

- Apenas matrícula com `status='ativo'`, `ativo=true`, turma e sessão consistentes.
- Apenas ano letivo ativo da escola; recusa históricas, pendentes, concluídas, transferidas, anuladas, trancadas e múltiplas matrículas inconsistentes.
- Rejeita matrícula associada a histórico anual já fechado.
- Motivo é obrigatório e registado com o autor. Data de fecho usa hora do servidor; não permite retroatividade livre.
- A auditoria existente `matriculas_status_audit` preserva estado anterior, novo, operador e motivo. Outros movimentos ficam na tabela de sinalizações.
- A RPC é idempotente após confirmação; não altera o estado do aluno quando o pedido é repetido.
- Se a base ainda não recebeu a migração, a API informa indisponibilidade; não simula sucesso.

## Checklist antes de produção

1. CI e regressão nominal verdes; validação de segurança/SQL com dois tenants.
2. Professor associado à turma A sinaliza aluno A e não consegue sinalizar aluno B de outra turma.
3. Secretaria confirma; o aluno desaparece só da lista operacional, continua no histórico como desistente e aparece claramente no perfil.
4. Motivo, autor e data ficam persistidos; nenhuma nota, frequência, mensalidade ou histórico muda.
5. Repetição de confirmação não cria eventos duplicados; ano fechado e aluno transferido retornam erro explicativo.
6. Testes autenticados em Secretaria, Operações, Professor e Perfil, incluindo `admin_financeiro`.
