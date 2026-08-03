# Plano — Simplificação do Menu Financeiro (Contexto Angolano)

Data: 2026-08-01  
Estado: planeado  
Escopo principal: `apps/web/src/lib/sidebarNav.ts`, portal `/escola/[id]/operacoes/financeiro/**` e páginas financeiras associadas

## Objetivo

Reduzir a carga cognitiva do módulo Financeiro sem retirar capacidades do perfil operacional, reorganizando a navegação por tarefas reais de uma escola angolana.

O utilizador deve conseguir responder rapidamente a quatro perguntas:

1. O que entrou hoje?
2. O que ainda precisa de confirmação ou conciliação?
3. Quem tem propinas, mensalidades ou outros emolumentos em atraso?
4. Que operação deve ser fechada, declarada ou reportada?

## Resultado esperado

- Reduzir o primeiro nível do Financeiro de 22 para, no máximo, 6 entradas.
- Preservar todas as funcionalidades úteis por meio de páginas agregadoras, abas e ações contextuais.
- Remover da sidebar rotas que apenas redirecionam para a visão geral.
- Evitar duplicação entre Financeiro e Configurações.
- Utilizar terminologia compreensível no contexto escolar e financeiro angolano.
- Manter toda a navegação do perfil operacional dentro de `/operacoes/**`.

## Princípios de UX

- Organizar por intenção do utilizador, não por quantidade de páginas existentes.
- Operação diária antes de configuração e análise.
- Uma tarefa deve ter um ponto de entrada principal.
- A sidebar apresenta domínios; as páginas internas apresentam detalhes.
- Exportar, imprimir e emitir comprovativo são ações contextuais, não módulos.
- Rótulos devem descrever tarefas concretas e usar vocabulário local.
- Nenhuma simplificação visual pode reduzir permissões ou capacidades do operacional.

## Terminologia para Angola

| Evitar ou restringir | Termo recomendado | Aplicação |
|---|---|---|
| Boleto | Referência de pagamento, cobrança ou documento de cobrança | Usar de acordo com o instrumento realmente emitido |
| Gerar boleto | Gerar referência de pagamento ou emitir cobrança | Botões e mensagens operacionais |
| Pagar boleto | Efetuar pagamento | Portal e comunicações |
| Comprovante | Comprovativo de pagamento | Recibos, anexos e validação |
| Caixa registradora | Caixa | Operação diária |
| Ingresos/receitas recebidas | Recebimentos ou valores recebidos | Indicadores e relatórios |
| Tuition | Propina ou mensalidade | Conforme a terminologia adotada pela escola |
| PIX | Multicaixa Express, referência, transferência ou TPA | Nunca apresentar PIX em fluxos angolanos |

### Termos que devem permanecer distintos

- **Recebimento:** entrada de valor apresentada ou registada no balcão.
- **Pagamento:** transação financeira efetuada pelo encarregado, aluno ou terceiro.
- **Cobrança:** ação de comunicar ou recuperar valores em atraso.
- **Conciliação:** correspondência entre movimento bancário/TPA e obrigação financeira.
- **Fecho de caixa:** conferência e consolidação da operação diária.
- **Propina/mensalidade:** obrigação periódica do aluno.
- **Emolumento:** taxa cobrada por serviço, documento ou ato escolar.
- **Recibo/comprovativo:** evidência emitida ou apresentada após pagamento.

## Arquitetura de informação alvo

```text
Financeiro
├── Visão geral
├── Caixa e pagamentos
│   ├── Recebimentos
│   ├── Histórico de pagamentos
│   ├── Conciliação bancária e TPA
│   └── Fecho de caixa
├── Cobranças
│   ├── Inadimplência
│   └── Alunos e turmas
├── Mensalidades e preços
├── Fiscal
└── Relatórios
```

### Ordem recomendada

1. Visão geral
2. Caixa e pagamentos
3. Cobranças
4. Mensalidades e preços
5. Fiscal
6. Relatórios

Esta ordem acompanha a frequência e a sequência natural do trabalho: observar, receber, confirmar, cobrar, configurar e analisar.

## Decisão por entrada atual

| Entrada atual | Decisão | Destino ou rótulo alvo | Justificação |
|---|---|---|---|
| Dashboard financeiro | Manter e renomear | Visão geral | “Dashboard” descreve o formato, não a tarefa |
| Balcão & cobrança | Manter e renomear | Caixa e pagamentos → Recebimentos | Balcão e cobrança são modelos mentais diferentes |
| Turmas & alunos | Manter como página interna | Cobranças → Alunos e turmas | É uma visão de apoio à cobrança, não um domínio principal |
| Pagamentos | Manter como página interna | Caixa e pagamentos → Histórico | Separa histórico da receção/validação |
| Boletos | Remover da sidebar e da terminologia | Referências de pagamento, se a capacidade existir | O termo não é corrente no contexto angolano e a rota atual não tem experiência própria |
| Cobranças | Manter | Cobranças → Inadimplência | Representa recuperação e comunicação de valores em atraso |
| Fecho de caixa | Manter como página interna | Caixa e pagamentos → Fecho de caixa | Tarefa operacional crítica e distinta |
| Conciliação | Manter como página interna | Caixa e pagamentos → Conciliação bancária e TPA | Deve explicitar os canais usados localmente |
| Candidaturas | Mover para outro domínio | Matrículas & Admissões | A validação financeira é etapa da candidatura, não um módulo financeiro autónomo |
| Tabelas de preço | Fundir | Mensalidades e preços | Sobrepõe-se a mensalidades e emolumentos |
| Mensalidades | Fundir | Mensalidades e preços | Deve partilhar contexto com preços, descontos e emolumentos |
| Fiscal & compliance | Manter e simplificar | Fiscal | A página pode detalhar AGT, SAF-T(AO) e conformidade |
| Contabilidade | Remover da sidebar enquanto não tiver fluxo próprio | Visão geral ou integração futura | A rota atual apenas redireciona |
| Vendas | Remover da sidebar enquanto não tiver fluxo próprio | Recebimentos ou serviços/emolumentos | A rota atual apenas redireciona e “vendas” é ambíguo numa escola |
| Exportações | Remover como módulo | Ação contextual em listas e relatórios | Exportar é uma ação, não um domínio |
| Alertas financeiros | Remover como módulo | Visão geral e badges contextuais | Os alertas devem aparecer onde a ação acontece |
| Relatórios financeiros | Manter | Relatórios | Único ponto de entrada para análise financeira |
| Dashboards analíticos | Remover | Visão geral ou Relatórios | A rota atual apenas redireciona e duplica o conceito de dashboard |
| Extratos de alunos | Retirar da sidebar | Relatórios e perfil financeiro do aluno | Continua acessível no contexto correto |
| Fluxo de caixa | Retirar da sidebar | Relatórios | Relatório especializado dentro do catálogo |
| Status de pagamentos | Retirar da sidebar | Relatórios | Visão analítica, não operação primária |
| Relatórios detalhados | Retirar da sidebar | Relatórios | Já existe no catálogo de relatórios |

## Estrutura das páginas agregadoras

### Visão geral

Deve apresentar:

- Total recebido no dia e no mês.
- Valores pendentes de confirmação.
- Valores por conciliar.
- Propinas/mensalidades em atraso.
- Estado do caixa atual.
- Alertas acionáveis.
- Atalhos para as tarefas mais frequentes.

Não deve repetir dois atalhos que conduzem à mesma rota.

### Caixa e pagamentos

Usar navegação interna por abas:

- **Recebimentos:** validação de mensalidades, propinas, matrículas, taxas e emolumentos.
- **Pagamentos:** histórico, pesquisa, reversão autorizada e emissão de recibo.
- **Conciliação:** movimentos bancários, transferências, Multicaixa/TPA e correspondências pendentes.
- **Fecho de caixa:** declaração, diferenças, aprovação e impressão.

### Cobranças

Usar duas vistas complementares:

- **Inadimplência:** prioridades, montantes, dias em atraso, campanhas e histórico de contacto.
- **Alunos e turmas:** consulta por turma, extrato, contacto e registo de pagamento.

O rótulo “cobrança” não deve ser usado para representar o simples recebimento no balcão.

### Mensalidades e preços

Fundir os caminhos atuais numa única experiência com abas:

- Valores e tabelas.
- Regras por turma ou classe.
- Propinas/mensalidades.
- Emolumentos e serviços.
- Descontos, bolsas e isenções.
- Geração periódica de obrigações.

Configurações institucionais permanecem em Configurações; a operação diária permanece no Financeiro.

### Fiscal

Manter como domínio próprio quando aplicável:

- Documentos fiscais.
- Recibos e faturas.
- Retificações.
- SAF-T(AO).
- Estado de comunicação e conformidade com a AGT.

### Relatórios

Manter um único catálogo, agrupado por finalidade:

- **Gestão:** relatório mensal escolar e propinas.
- **Tesouraria:** fluxo de caixa e pagamentos por estado.
- **Aluno:** extratos individuais.
- **Auditoria:** relatórios detalhados e exportações.

Os relatórios individuais não devem voltar a aparecer como itens irmãos na sidebar.

## Plano de implementação

### Fase 0 — Linha de base e proteção contra regressões

- [ ] Registar a lista atual de rotas, destinos e redirecionamentos.
- [ ] Confirmar quais rotas possuem conteúdo próprio e quais apenas redirecionam.
- [ ] Mapear permissões do perfil operacional em cada rota financeira.
- [ ] Confirmar que todos os destinos alvo funcionam no namespace `/operacoes/**`.
- [ ] Criar testes da matriz `rótulo → rota → capacidade` antes de alterar a sidebar.
- [ ] Verificar `P0_CHECKLIST.md` antes de qualquer aplicação.

Critério de saída:

- Existe uma linha de base automatizada que demonstra que nenhuma capacidade será perdida.

### Fase 1 — Simplificação segura da sidebar

- [ ] Renomear “Dashboard financeiro” para “Visão geral”.
- [ ] Substituir “Balcão & cobrança” por “Caixa e pagamentos”.
- [ ] Manter apenas as seis áreas principais no primeiro nível.
- [ ] Retirar da sidebar as rotas que apenas redirecionam.
- [ ] Retirar os relatórios especializados do primeiro nível.
- [ ] Retirar “Candidaturas” do grupo Financeiro e posicioná-la em Matrículas & Admissões.
- [ ] Remover o rótulo “Boletos”.
- [ ] Preservar aliases e redirecionamentos de compatibilidade para favoritos antigos.

Critério de saída:

- O Financeiro apresenta no máximo seis decisões iniciais e os links antigos continuam compatíveis.

### Fase 2 — Caixa e pagamentos

- [ ] Criar uma página agregadora ou navegação interna para Recebimentos, Pagamentos, Conciliação e Fecho.
- [ ] Renomear “Caixa & Receita Unificada” para um título operacional curto, se necessário.
- [ ] Diferenciar claramente `pendente de validação`, `confirmado`, `conciliado`, `revertido` e `anulado`.
- [ ] Usar “comprovativo de pagamento” em upload e validação.
- [ ] Usar “recibo” para o documento emitido após confirmação.
- [ ] Referenciar Multicaixa Express, TPA e transferência apenas quando suportados pelo fluxo.

Critério de saída:

- O utilizador executa o ciclo receber → confirmar → conciliar → fechar sem procurar em módulos diferentes.

### Fase 3 — Cobranças

- [ ] Consolidar Radar de Inadimplência e Turmas & Alunos sob Cobranças.
- [ ] Manter ações de WhatsApp, email e registo de pagamento no contexto do aluno.
- [ ] Remover duplicação entre “Cobranças” e “Histórico de Cobranças”.
- [ ] Garantir que o histórico de contacto é acessível na mesma área.
- [ ] Usar textos objetivos: “Avisar”, “Registar pagamento”, “Ver extrato” e “Abrir histórico”.

Critério de saída:

- Existe um único ponto de entrada para identificar, contactar e acompanhar devedores.

### Fase 4 — Mensalidades, propinas, preços e emolumentos

- [ ] Inventariar campos e ações das páginas atuais de preços e mensalidades.
- [ ] Definir a terminologia configurável da escola: propina, mensalidade ou ambos.
- [ ] Criar experiência única “Mensalidades e preços”.
- [ ] Separar configuração institucional de execução operacional.
- [ ] Garantir que geração em massa exige contexto de ano letivo, classe/turma e período.
- [ ] Preservar descontos, bolsas, isenções e emolumentos existentes.

Critério de saída:

- Uma política financeira tem um único local de edição e não existem caminhos concorrentes para a mesma configuração.

### Fase 5 — Fiscal e relatórios

- [ ] Manter Fiscal como entrada própria.
- [ ] Verificar nomenclatura compatível com AGT e SAF-T(AO).
- [ ] Consolidar todos os relatórios num catálogo único.
- [ ] Organizar relatórios por Gestão, Tesouraria, Aluno e Auditoria.
- [ ] Transformar Exportações em ação dentro do relatório/lista correspondente.
- [ ] Manter `cache: 'no-store'` e `dynamic = 'force-dynamic'` nas rotas financeiras sensíveis.

Critério de saída:

- O utilizador escolhe primeiro a finalidade da análise e só depois o relatório específico.

### Fase 6 — Compatibilidade e limpeza de rotas legadas

- [ ] Manter redirecionamentos das URLs antigas para os novos destinos canónicos.
- [ ] Substituir links internos que ainda apontam para rotas legadas.
- [ ] Atualizar pesquisa global, command palette, breadcrumbs e atalhos do dashboard.
- [ ] Atualizar testes de navegação e matriz de acesso.
- [ ] Marcar rotas sem conteúdo próprio como legadas antes de qualquer remoção física.
- [ ] Não remover páginas ou contratos de API enquanto houver consumidores identificados.

Critério de saída:

- Favoritos antigos funcionam, mas toda nova navegação usa a arquitetura simplificada.

### Fase 7 — Validação UX e operacional

- [ ] Testar com perfil operacional financeiro.
- [ ] Testar com perfil administrativo com as mesmas capacidades.
- [ ] Validar desktop e mobile.
- [ ] Medir quantidade de cliques para as dez tarefas mais frequentes.
- [ ] Verificar compreensão dos termos com utilizadores angolanos.
- [ ] Confirmar que nenhum fluxo apresenta “boleto”, “PIX” ou terminologia brasileira inadequada.
- [ ] Validar estados vazios, erros, carregamento e permissões insuficientes.
- [ ] Executar testes unitários, typecheck e lint focado.

Critério de saída:

- As tarefas críticas são encontradas sem orientação externa e nenhuma capacidade operacional sofre regressão.

## Tarefas críticas para teste de usabilidade

1. Registar um pagamento apresentado no balcão.
2. Validar um comprovativo de transferência.
3. Emitir ou consultar um recibo.
4. Localizar um aluno com propina/mensalidade em atraso.
5. Enviar um aviso de cobrança.
6. Consultar o extrato financeiro de um aluno.
7. Conciliar um movimento bancário ou TPA.
8. Declarar e aprovar o fecho de caixa.
9. Alterar o valor de uma mensalidade ou emolumento.
10. Consultar e exportar o fluxo de caixa.

Metas iniciais:

- Sucesso sem ajuda: pelo menos 90%.
- Tempo para localizar a área correta: até 10 segundos.
- Tarefas frequentes: até 2 níveis de navegação.
- Nenhuma tarefa crítica exclusivamente dependente da pesquisa global.
- Zero rótulos “Boleto” ou “PIX” na experiência angolana.

## Critérios de aceite globais

- [ ] A sidebar financeira possui no máximo seis entradas principais.
- [ ] Não há links irmãos que apontem para o mesmo destino sem motivo explícito.
- [ ] Rotas que apenas redirecionam não aparecem como funcionalidades independentes.
- [ ] “Candidaturas” está em Matrículas & Admissões.
- [ ] “Exportações” aparece como ação contextual.
- [ ] Relatórios especializados aparecem dentro de Relatórios.
- [ ] Mensalidades, preços e emolumentos não possuem pontos de edição concorrentes.
- [ ] A UI usa terminologia angolana consistente.
- [ ] O operacional mantém todas as capacidades financeiras autorizadas.
- [ ] Toda rota financeira transacional preserva política `no-store`/`force-dynamic`.
- [ ] Links antigos possuem redirecionamento seguro para destinos canónicos.
- [ ] Testes de acesso, navegação e compatibilidade passam.

## Fora de escopo

- Alterar regras contabilísticas ou fiscais sem validação especializada.
- Criar novos meios de pagamento.
- Alterar políticas RLS.
- Alterar contratos SQL ou dados financeiros reais.
- Remover definitivamente rotas antigas antes da fase de compatibilidade.
- Introduzir funcionalidades de contabilidade apenas para justificar uma entrada de menu.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Utilizador não encontrar uma função movida | Redirecionamentos, pesquisa global e comunicação da nova organização |
| Perda de capacidade do operacional | Testes da matriz de acesso antes e depois de cada fase |
| Mistura entre configuração e operação | Separar edição institucional de execução diária |
| Terminologia variar entre escolas | Permitir preferência entre propina/mensalidade quando necessário |
| Links antigos em documentos ou favoritos | Manter aliases e rotas de compatibilidade |
| Regressão em dados financeiros | Não alterar schema, RLS ou dados nesta iniciativa de navegação |

## Sequência recomendada de entrega

1. Fase 0 — linha de base.
2. Fase 1 — redução imediata da sidebar.
3. Fase 2 — Caixa e pagamentos.
4. Fase 3 — Cobranças.
5. Fase 4 — Mensalidades e preços.
6. Fase 5 — Fiscal e relatórios.
7. Fase 6 — compatibilidade.
8. Fase 7 — validação UX.

Cada fase deve ser entregue e validada isoladamente. Não se deve fundir páginas de domínios diferentes apenas para reduzir numericamente o menu.
