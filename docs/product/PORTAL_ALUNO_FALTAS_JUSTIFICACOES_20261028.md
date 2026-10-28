# Faltas no Portal do Aluno — implementação e regras

**Branch:** `feat/aluno-faltas-justificacoes-20261028` (independente da PR #278).  
**Referência de domínio:** `frequencias` particionadas e `matriculas`; não inventar faltas ou totais.

## Produto

Uma quarta aba, **Académico → Faltas**, permite ver presenças, atrasos e faltas da matrícula/ano letivo selecionado, consultar as 100 faltas mais recentes e acompanhar o estado da justificação específica. Os totais vêm de consultas `count=exact` ao registo académico, não de percentagens presumidas. Em ano histórico, consulta sem novas solicitações.

Mensagem do pedido: “Solicitação realizada. Aguardando análise da secretaria.”  
Mensagem da aprovação: “A justificação foi aceite. A falta continua registada no histórico.”  
Mensagem da recusa: motivo da secretaria com ação “Enviar nova justificação”.

## Autoridade, privacidade e decisão

1. O portal só lê estudantes previamente autorizados pelo `getAlunoContext` e `resolveSelectedStudentId`, matrícula resolvida por sessão/ano; nunca uma matrícula em cache de outro educando.
2. Um pedido exige uma falta persistida nessa matrícula/escola (não apenas uma data introduzida pelo aluno).
3. A submissão é permitida a encarregado vinculado ou aluno maior de 18 anos com data de nascimento verificada, com validação **na API e na policy RLS**.
4. Um único pedido pendente ou aprovado por falta; reenvio seguro com resposta idempotente; rejeitados permitem nova solicitação. Não há overwrite.
5. A decisão autorizada da secretaria/direção é auditada e guardada em tabela separada. A frequência original nunca é apagada, alterada para “presente” ou reduzida.
6. A lista da secretaria é filtrada por escola/estado, sem exposição a outro tenant.
7. Sem anexos clínicos nesta etapa: texto apenas, para evitar armazenamento indiscriminado de documentos de saúde.
8. Não existe autorização automática para uma taxa por falta. **Sem cobrança**; qualquer serviço futuro exigirá base legal/política escolar explícita, validação de compliance e integração na infraestrutura financeira existente. Nunca poderá converter pagamento em presença ou justificar uma falta automaticamente.

Referência normativa para Angola: Decreto Presidencial n.º 162/23, artigos 33.º e 37.º a 40.º. A apresentação de justificação é dirigida à escola e sujeita à apreciação competente; a configuração no KLASSE não substitui essa decisão.

## Migração

`supabase/migrations/20271028160000_aluno_faltas_justificacoes.sql` cria tabela de pedidos, índices para prevenção de duplicados e policies RLS. `frequencias` é particionada e, por isso, o vínculo com o registo da ausência é validado por chaves de domínio e por API/policy, em vez de uma FK direta inexistente. Aplicar a migração antes de ativar a UI.

## Homologação

- Acesso ao aluno correto, outro educando, outro ano e outra escola; histórico somente leitura.
- Menor sem encarregado: consulta sim, pedido não. Encarregado vinculado e adulto: pedido sim.
- Pedido repetido/reload/duas submissões concorrentes; não cria justificações pendentes duplicadas.
- Secretaria aprova e rejeita com motivo; aluno visualiza o estado após atualizar.
- Alterar frequência para presença antes da decisão bloqueia a aprovação.
- Ausência de taxa ou serviço de pagamento; sem mutação do ledger/financeiro.
- Verificação no telemóvel e navegação por teclado, Light/Dark e contraste.
- Conteúdo de períodos com mais de 100 ausências: mensagem de limitação visível, totais permanecem corretos.

**Não publicar sem:** migração verificada, testes, CI, homologação com conta de aluno e conta de secretaria.
