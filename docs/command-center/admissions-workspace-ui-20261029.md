# Admissões no Workspace — UX e performance (29/10/2026)

## Problema
A experiência de admissões era uma página isolada, com layout rígido e operações executadas fora do contexto visual do Command Center. O Balcão já dispõe de um contrato de ações e módulos lazy-loaded; duplicar um segundo fluxo de candidatura aumentaria o risco de divergência e de falhas de permissão.

## Alteração nesta branch
- Nova ação canónica `admissions` no Balcão, sem obrigar a aluno selecionado. A seleção anterior permanece em repouso, sem contaminar novas matrículas.
- O Workspace e a versão modal reutilizam `AdmissoesInboxClient` (não recriam APIs, estados ou regras). Botão «Novo» entra na ação `enrollment` no próprio Workspace.
- O código da fila é importado de forma dinâmica apenas na primeira entrada; o painel é desmontado ao sair, para não manter consultas/observadores em background.
- Conversão em matrícula é carregada somente quando solicitada; configurações de documentos só são consultadas após abrir candidatura.
- Uma lista SWR por filtro/pesquisa, debounce de pesquisa, deduplicação de 15 s e revalidação manual. A troca rápida de candidatura cancela a chamada anterior.
- UI responsiva: lista/detalhe por navegação em mobile e painel lado a lado em desktop; superfícies primárias com tokens do Workspace (`bg-card`, `bg-muted`, `border-border`, `text-foreground`). Seletor de filtros com overflow horizontal.
- Fila abre em «Todas» (`status=all` já suportado pelo radar existente). Partilha do link e indicadores secundários ficam recolhidos no Workspace; continuam acessíveis sem nova rota.
- Detalhe do candidato organizado em três perspetivas locais — Resumo, Documentos e Histórico — sem requisições extra ao mudar de separador; a decisão acompanha o candidato.
- «Pedir ajustes» e a ação principal aplicável aparecem na barra contextual. Rejeitar, arquivar ou reabrir ficam em «Mais ações» e mantêm os fluxos oficiais; aprovação ganha confirmação explícita antes do pedido à API.
- Removida animação de rearranjo por `layoutId` de cada cartão da fila para evitar custo de layout com dezenas de registos.
- Sheets de conversão usam overlay elevado quando abertas sobre o Workspace modal.

- Padronização visual Light/Dark nas superfícies operacionais (fila, assistente de nova matrícula e conversão): fundos e bordas neutros usam tokens existentes do Balcão, sem criar novas cores globais.
- Estados semânticos preservados (verde/sucesso, âmbar/atenção, vermelho/erro, azul/informação) com variantes para o tema escuro. Botões primários usam `bg-amber` e `text-amber-950`.
- Diálogos auxiliares da fila são renderizados via portal com `z-[90]`, acima da janela modal do Workspace; a conversão mantém o Sheet existente elevado. Confirmações globais e exceção de capacidade usam overlays `z-[110]` para não desaparecer atrás do atendimento.
- Testes de regressão verificam que a fila, o assistente em três passos e a folha de conversão não retomam superfícies ou tipografia neutra com cores fixas.
- Notificações partilhadas de sucesso/erro/aviso foram alinhadas aos tokens de card e texto do tema; as confirmações globais recebem overlay acima do Workspace sem alterar a API de confirmação.

## Continuidade do atendimento — resolução contextual
- Guardar alterações na folha de conversão não conclui a matrícula, não fecha o formulário e não muda o candidato.
- Conclusão da matrícula actualiza a fila e o detalhe da candidatura no próprio atendimento; a acção «Atender próximo» é explícita e ignora registos concluídos/arquivados.
- Arquivar candidatura não elimina o detalhe nem o contexto seleccionado; a secretaria pode consultar o histórico antes de abrir outro registo.
- O decreto MED é a fonte do ano letivo, trimestres, datas de provas e restantes eventos oficiais. O Balcão não cria nem edita estes dados.
- Erro `ACADEMIC_CALENDAR_NOT_CONFIGURED`: o Balcão preserva a candidatura e indica que a sincronização da fonte oficial deve ser verificada, sem abrir editor de períodos ou aplicar templates.
- Erro `ACADEMIC_CALENDAR_YEAR_MISMATCH` oferece «Rever turma» na própria matrícula, sem migrar a turma de ano por um atalho potencialmente perigoso.
- Incompatibilidades financeiras orientam a revisão da turma/pagamento no mesmo fluxo; não alteram o ledger nem regras de competência.
- Na nova matrícula embutida, falha na emissão de comprovativo apresenta recuperação local em vez de navegar para Documentos. Recibos em estado `pending` ou `error` expõem «Verificar recibo» pelo ID persistido do pagamento; nunca repetem o pagamento.
- O arquivamento de uma admissão duplicada pode regressar explicitamente à Inbox no mesmo Workspace.
- Os diálogos de duplicidade, lançamento pós-matrícula e pagamento foram elevados acima do Workspace; os avisos de recibo em preparação também oferecem consulta local pelo pagamento original.

**Limite de permissões e dados:** nenhum fluxo consegue corrigir silenciosamente uma turma vinculada ao ano errado, criar um ano letivo sem fonte ou autorizar uma configuração para a qual o utilizador não tenha permissão. O bloqueio permanece visível e o atendimento é preservado, em vez de forçar navegação externa.




## Contratos a preservar
1. O processo de candidatura continua a usar a API de admissões existente, com autorização e RLS do lado do servidor.
2. Na aba Matrícula, o aluno anterior **nunca** preenche automaticamente a nova candidatura.
3. Em Admissões, a seleção anterior de um aluno do Balcão sobrevive à mudança de aba; a candidatura selecionada é estado local e não altera `alunoId` nem o URL do Workspace.
4. Operações financeiras e académicas permanecem no domínio existente. Nenhuma migração de banco ou alteração de regra financeira nesta branch.
5. Histórico e estados da candidatura não devem ser reconduzidos a estados de matrícula; a conversão continua na operação canónica.

## Homologação obrigatória
- [ ] Entrar em `/secretaria/balcao?action=admissions` sem aluno pré-selecionado; fila abre sem skeleton infinito.
- [ ] Abrir no modal do Balcão com aluno A; consultar candidatura B; sair e verificar que A continua selecionado.
- [ ] Usar «Novo»: abre Matrícula vazia, sem misturar dados de A ou B; voltar à aba Admissões.
- [ ] Validar abertura em «Todas», pesquisa e filtros; expandir indicadores e link de inscrição na fila.
- [ ] Alternar Resumo, Documentos e Histórico sem consultas adicionais, aprovar com confirmação, pedir documentos, reabrir e converter em desktop e mobile.
- [ ] Confirmar que decisões secundárias permanecem acessíveis em «Mais ações» e que as permissões do servidor continuam a ser respeitadas.
- [ ] Verificar Sheet de conversão em cima do modal, incluindo teclado, fechamento e foco.

- [ ] Alternar Light e Dark na fila, detalhe, nova candidatura (três etapas), pré-candidatura, pendências, promoção, comprovativos e folha de conversão, em modal e página, com perfis reais.
- [ ] Confirmar que diálogos portados a `document.body` mantêm contraste e não ficam sob o Workspace; validar foco, teclado e ecrã pequeno.

- [ ] Abrir aba, trocar de candidatura rapidamente e voltar: sem vazamento de dados ou repetição de requests após desmontagem.
- [ ] Medir requests e bytes do bundle do Balcão antes/depois: o carregamento inicial não deve incluir `AdmissoesInboxClient` nem `AdmissaoConversionSheet`.
- [ ] Guardar na conversão sem fechar, concluir e voltar ao mesmo candidato; avançar apenas quando premir «Atender próximo».
- [ ] Simular calendário herdado do decreto indisponível; garantir ausência de ações de edição, preservação do atendimento e recuperação após sincronização oficial.
- [ ] Simular turma com ano incompatível e rever a turma sem alterar os vínculos históricos no banco.
- [ ] Simular erro de competência financeira e retomar após rever selecção local, sem alteração ao ledger.
- [ ] Simular recibo pendente/erro com `pagamento_id`; verificar consulta e retry sem repetir cobrança.
- [ ] Abrir a confirmação de duplicidade e uma ação pós-matrícula dentro do modal do Balcão; verificar foco, contraste, sobreposição e fecho sem perda do contexto.
- [ ] Typecheck, testes unitários de integração e workflow `Balcao Performance Budgets` verdes.

## Limites desta entrega
As superfícies neutras da fila, do assistente de matrícula e da conversão foram alinhadas aos tokens do Balcão; as cores de estado continuam semânticas com variantes Light/Dark. Falta homologação visual e funcional autenticada em desktop/mobile, inclusive foco dos diálogos e permissões de operações. Esta branch não altera as regras financeiras ou o portal público do candidato.
