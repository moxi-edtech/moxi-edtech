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

- Padronização visual Light/Dark nas superfícies operacionais (fila e conversão): fundos e bordas neutros usam tokens existentes do Balcão, sem criar novas cores globais.
- Estados semânticos preservados (verde/sucesso, âmbar/atenção, vermelho/erro, azul/informação) com variantes para o tema escuro. Botões primários usam `bg-amber` e `text-amber-950`.
- Diálogos auxiliares da fila são renderizados via portal com `z-[90]`, acima da janela modal do Workspace; a conversão mantém o Sheet existente elevado.
- Testes de regressão verificam que fila e folha de conversão não retomam superfícies ou tipografia neutra com cores fixas.


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

- [ ] Alternar Light e Dark na fila, detalhe, pré-candidatura, pendências, promoção, comprovativos e folha de conversão, em modal e página, com perfis reais.
- [ ] Confirmar que diálogos portados a `document.body` mantêm contraste e não ficam sob o Workspace; validar foco, teclado e ecrã pequeno.

- [ ] Abrir aba, trocar de candidatura rapidamente e voltar: sem vazamento de dados ou repetição de requests após desmontagem.
- [ ] Medir requests e bytes do bundle do Balcão antes/depois: o carregamento inicial não deve incluir `AdmissoesInboxClient` nem `AdmissaoConversionSheet`.
- [ ] Typecheck, testes unitários de integração e workflow `Balcao Performance Budgets` verdes.

## Limites desta entrega
As superfícies neutras da fila e da conversão foram alinhadas aos tokens do Balcão; as cores de estado continuam semânticas com variantes Light/Dark. Falta homologação visual e funcional autenticada em desktop/mobile, inclusive foco dos diálogos e permissões de operações. Esta branch não altera as regras financeiras ou o portal público do candidato.
