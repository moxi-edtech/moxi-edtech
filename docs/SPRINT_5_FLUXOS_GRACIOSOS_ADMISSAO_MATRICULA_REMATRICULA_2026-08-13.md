# KLASSE — Sprint 5: fluxos graciosos de admissão, matrícula e rematrícula

Data: 13 de agosto de 2026
Objetivo: transformar os fluxos de entrada e continuidade do aluno em jornadas orientadas, resilientes e idempotentes.

## Escopo

### A. Portal público de admissão

- formulário por etapas com progresso e validação contextual;
- rascunho recuperável, aviso de alterações e envio protegido contra duplicidade;
- upload com estado por documento, retry e pendências explícitas;
- protocolo copiável, acompanhamento e timeline de decisões;
- reenvio de documentos sem reiniciar a candidatura.

### B. Matrícula

- transição visível entre candidatura, aprovação, documentação, matrícula criada e matrícula finalizada;
- ações idempotentes para conversão, finalização, pagamento e emissão de comprovativo;
- resumo final com ano letivo, turma, situação financeira e documentos;
- feedback recuperável em erro de rede, timeout ou resposta já processada.

### C. Rematrícula no portal do aluno

- estado carregando, disponível, bloqueado, em análise, aprovado e concluído;
- erro de carregamento visível com retry, sem desaparecer silenciosamente;
- dívida com ação real para abrir a área financeira;
- confirmação com contexto do próximo ano e proteção contra duplo clique;
- resultado persistente após atualização da página;
- diferenciação entre pedido já existente, conflito e falha temporária.

## Critérios de graciosidade

1. Toda ação de escrita tem estado idle, carregando, sucesso e erro.
2. Erros temporários oferecem retry sem perder o formulário ou a seleção.
3. Repetir uma ação concluída não cria um segundo registo.
4. O usuário sempre sabe o próximo passo e quem precisa agir.
5. Dados do ano letivo, turma e situação financeira aparecem antes da confirmação.
6. A interface não esconde uma falha de API transformando-a em estado vazio.

## Backlog de implementação

### Sprint 5A — Rematrícula do aluno

- [x] Exibir erro e retry no carregamento de `/api/aluno/rematricula/status`.
- [x] Navegar de forma confiável para a área financeira quando houver dívida.
- [x] Mostrar estado de envio e impedir submissões concorrentes.
- [x] Persistir o resultado da solicitação no banner após confirmação.
- [x] Diferenciar pedido já existente de falha temporária.

### Sprint 5B — Admissão pública

- [x] Validar o último passo antes do POST, incluindo documentos e contexto letivo.
- [x] Evitar submissão duplicada por protocolo/draftId.
- [x] Melhorar retry de envio sem apagar dados preenchidos.
- [x] Exibir estado de envio e falha por documento.
- [x] Permitir retry do mesmo arquivo sem selecionar novamente os demais documentos.
- [x] Tornar o acompanhamento e reenvio de pendências mais orientados.

### Sprint 5C — Matrícula

- [ ] Consolidar estados da conversão até a matrícula finalizada.
- [x] Feedback idempotente para ações já processadas.
- [x] Resumo final e acesso ao comprovativo, distinguindo emissão pendente.
- [x] Resumo pós-matrícula com ano letivo, turma e situação do pagamento.
- [x] Checklist pós-matrícula com portal, comprovativo e comunicação.
- [x] Retry explícito para falha na liberação do portal.
- [x] Tornar a liberação do portal idempotente: retries não redefinem senha existente e falhas parciais retornam estado acionável.
- [x] Estado local da comunicação ao encarregado, com retry quando o navegador bloquear o WhatsApp.
- [ ] Recuperação de falhas na emissão de documentos e pagamentos.

### Sprint 5D — Qualidade

- [ ] Testar rede lenta, timeout, refresh e duplo clique.
- [ ] Testar isolamento por escola e ano letivo.
- [ ] Criar E2E admissão → aprovação → matrícula → portal do aluno → rematrícula.

## Evidências atuais

- `apps/web/src/app/(publico)/admissoes/[escolaSlug]/AdmissionForm.tsx` já possui etapas e rascunho local.
- `apps/web/src/app/(publico)/admissoes/[escolaSlug]/consultar/StatusInquiryForm.tsx` já possui consulta protegida, timeline e reenvio.
- `apps/web/src/components/aluno/home/RematriculaBanner.tsx` concentra o fluxo atual da rematrícula do aluno.
- `apps/web/src/app/api/aluno/rematricula/status/route.ts` resolve elegibilidade, janela, dívida e duplicidade.
- `apps/web/src/app/api/aluno/rematricula/confirmar/route.ts` usa RPC idempotente para confirmar a rematrícula.

## Definição de pronto do Sprint 5A

- falha de status aparece na tela e pode ser repetida;
- dívida abre a área financeira correta;
- confirmação possui feedback de envio e não duplica pedidos;
- pedido confirmado continua visível após refresh;
- typecheck e validação manual dos estados principais passam.
