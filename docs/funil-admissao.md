# Funil de Admissão e Matrícula

## Estado canônico

O fluxo oficial de admissão evoluiu para:

`rascunho -> submetida -> [pendente] -> aguardando_pagamento (Reserva 48h) -> aguardando_compensacao -> matriculado`

A finalização da matrícula deve passar por uma única operação canônica:

`public.admissao_finalizar_matricula(...)`

### Novos Estados e Gate de Segurança (Junho 2026)

- **`pendente`**: Indica que um documento submetido foi rejeitado pela secretaria. O candidato pode realizar o re-upload direto via portal público ("Cofre").
- **`aguardando_pagamento`**: Ativado após a aprovação inicial. Gera uma **Reserva de Vaga de 48 horas**. Se não houver pagamento, a vaga volta para o pool público.
- **`aguardando_compensacao`**: O candidato enviou o comprovativo via portal público e aguarda validação do financeiro/secretaria.
- **Hard Gate de Capacidade**: A conversão final valida em tempo real se a turma atingiu o limite. Existe um `p_override_capacidade` exclusivo para o cargo de **Diretor**.

### Portal do Candidato ("O Cofre")

Implementado em `apps/web/src/app/(publico)/admissoes/[escolaSlug]/consultar/StatusInquiryForm.tsx`.
Permite ao encarregado:
1. Ver o cronômetro da reserva de 48h.
2. Copiar dados bancários da escola (IBAN/Conta).
3. Enviar comprovativo de pagamento.
4. Corrigir documentos rejeitados (Auto-serviço de pendências).
5. Definir senha do Portal do Aluno antecipadamente.

## Incidente tratado em 2026-05-07

### Sintomas

Foram observados erros recorrentes ao finalizar matrículas:

- `Defina curso e turma preferencial antes de aprovar/finalizar esta candidatura.`
- `Informe o valor da matrícula.`
- `Não é possível submeter: curso_id obrigatório (P0001)`
- `Incoerência: Turma preferencial pertence a outro ano letivo`

### Causa raiz

O fluxo estava fragmentado entre vários caminhos:

- `/api/secretaria/admissoes/approve`
- `/api/secretaria/admissoes/convert`
- `/api/secretaria/candidaturas/[id]/confirmar`
- ações antigas no radar/inbox que aprovavam antes da seleção final de turma

Com isso, o frontend conseguia chamar aprovação antes de a candidatura ter sido sincronizada com a `turma_id` selecionada. Também havia validação visual de preço no frontend que podia bloquear o fluxo antes de o backend resolver a tabela de preços corretamente.

### Correção aplicada

Foi criada a migration:

`supabase/migrations/20270507030000_create_admissao_finalizar_matricula_rpc.sql`

Ela adiciona:

- `public.admissao_finalizar_matricula(...)`
- garantia de `public.idempotency_keys`
- registro da migration em `supabase_migrations.schema_migrations`

Rotas atualizadas:

- `/api/secretaria/admissoes/convert` agora chama `admissao_finalizar_matricula`.
- `/api/secretaria/candidaturas/[id]/confirmar` virou adaptador legado para a mesma RPC canônica.

Frontend atualizado:

- `AdmissaoWizardClient` deixou de chamar `/api/secretaria/admissoes/approve` antes de converter.
- `AdmissoesRadarClient` e `AdmissoesInboxClient` deixaram de aprovar diretamente; agora enviam o utilizador para o wizard.
- `FinanceiroCandidaturasInbox` passa o flag `parcial` quando aplicável.
- `useMatriculaLogic` passou a consultar orçamento com `turma_id` e `cache: "no-store"`.

Commits locais relacionados:

- `34a06107 Fix admission wizard approval pricing flow`
- `787c468c Add canonical admission finalization RPC`
- `ce8318ca Remove legacy admission approval shortcuts`

## Contrato operacional

### Permitido

- Criar ou editar rascunho.
- Selecionar turma no wizard.
- Chamar `/api/secretaria/admissoes/convert` para finalizar.
- Usar `/api/secretaria/candidaturas/[id]/confirmar` apenas como adaptador legado, desde que ele chame a RPC canônica.

### Proibido

- Fazer `UPDATE candidaturas.status` direto.
- Aprovar candidatura no frontend antes de selecionar a turma final.
- Calcular ou exigir valor total de matrícula no frontend.
- Chamar `admissao_submit`, `admissao_approve` e `admissao_convert_to_matricula` em sequência a partir de rotas diferentes para o mesmo caso de uso.

## Validação realizada

### Deploy

Produção verificada em 2026-05-07:

- Deployment: `moxi-edtech-cpekzuj67-moxinexas-projects.vercel.app`
- Estado: `READY`
- Alias: `https://app.klasse.ao`

### E2E transacional com rollback

Foram executados testes diretos em produção dentro de `BEGIN ... ROLLBACK`, sem persistir dados de teste.

Caso pagamento total:

- candidatura criada como `rascunho`;
- RPC finalizou até `matriculado`;
- `curso_id`, `classe_id` e `ano_letivo=2025` derivados pela turma;
- `valor_matricula=1400.00` resolvido por tabela específica;
- matrícula ativa criada;
- logs de transição gerados;
- 11 mensalidades geradas;
- rollback confirmado com `candidaturas=0`, `matriculas=0`, `mensalidades=0`.

Caso pagamento parcial:

- `parcial=true`;
- `valor_pago=500.00`;
- `valor_matricula=1400.00`;
- `pagamento_parcial=true`;
- rollback confirmado com `candidaturas=0`, `matriculas=0`.

## Pontos de atenção

- `Playwright` não está instalado em `apps/web`; os E2Es desta correção foram transacionais no banco, porque a causa raiz estava no contrato backend/RPC.
- O branch local está à frente do GitHub; os commits precisam ser enviados para `origin/main`.
- A rota `/api/secretaria/admissoes/approve` ainda existe para compatibilidade, mas não deve ser chamada por UI de finalização de matrícula.

