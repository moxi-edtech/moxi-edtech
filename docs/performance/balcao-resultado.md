# Balcão — resultado de desempenho e limites da prova

**Base imutável:** `main` em `8bd1ef57`, benchmark commit `c5a1fcd` (9 passagens). **Implementação:** PR #213, commit `44fc17b` com ajustes de frescor/escopo em commit posterior. **Depois:** 12 passagens no Chrome com os mesmos componentes, API sintética, hardware e script. O baseline também foi repetido sem qualquer alteração de código (12 passagens) para medir o ruído.

## Comparação — troca de abas

| Aba | Pintura p50 antes → depois (ms) | Pintura p95 antes → depois (ms) | Requisições medianas por revisita | React commits medianos |
|---|---:|---:|---:|---:|
| Visão geral | 78 → 60 | 412 → 107 | 8 → 0 | 7 → 1 |
| Matrícula | 81 → 75 | 130 → 131 | 0 → 0 | 1 → 2 |
| Rematrícula | 125 → 124 | 143 → 146 | 8 → 0 | 7 → 2 |
| Pagar | 77 → 65 | 95 → 93 | 0 → 0 | 3 → 2 |
| Documento | 72 → 63 | 93 → 93 | 0 → 0 | 2 → 2 |
| Perfil | 78 → 78 | 97 → 94 | 2 → 0 | 3 → 2 |
| Nota | 78 → 78 | 98 → 98 | 2 → 0 | 6 → 1 |

O **p50 de Visão geral diminuiu 23%**, Pagamentos 16% e Documentos 13%. Na Rematrícula, Perfil e Notas, o ganho comprovado é sobretudo a eliminação de consultas repetidas e menos commits React; diferenças de 0–3 ms de pintura estão dentro do ruído experimental.

A repetição independente do **mesmo baseline** deu p50/p95: Visão geral 58/119 ms; Matrícula 77/128; Rematrícula 126/145; Pagar 88/128; Documento 74/100; Perfil 64/77; Notas 66/106. Isto confirma variação relevante em medições de pintura; não se reivindica significância estatística geral com 9–12 passagens.

## Rede e quota gratuita

Ocioso durante **60 segundos**: 0 requisições antes e 0 depois (**0/h extrapolado**). Nada introduziu polling ou prefetch novos.

Nas revisitas às sete abas, uma sequência sintética fazia 20 requisições antes e 0 depois (medianas somadas: 8 Visão + 8 Rematrícula + 2 Perfil + 2 Notas). Para 12 sequências idênticas/hora, a projeção é 240 → 0 consultas por hora de **revisita**, excluídas as primeiras aberturas e mutações. **Não é telemetria de uma secretaria em produção.**

Consultas simuladas: baseline p50 38 ms/p95 42 ms. Não foram medidos planos SQL nem tempos reais do Supabase; nenhum índice ou migration foi alterado.

## Bundle, LCP e INP

- **Bundle Next.js otimizado da rota** `/secretaria/balcao/page` (soma dos ficheiros da entrada em `app-build-manifest.json`): **2.057.804 → 1.904.087 bytes**, redução de **153.717 bytes (7,5%)**, verificada em dois builds locais com configurações sintéticas.
- Módulos Vite em desenvolvimento: **7.201.354 → 7.248.936 bytes** (+0,66%). Esta métrica não representa o bundle de produção; o crescimento inclui o instrumento de testes de retenção.
- **LCP da fixture:** 1.300 → 2.404 ms; porém repetir o mesmo commit de baseline, sem otimização, produziu **4.084 ms**. Este LCP do Vite é instável (amplitude superior ao efeito observado), portanto não prova ganho nem regressão causal em ambiente Next; precisa de validação RUM/autenticada.
- **INP observado na fixture:** 664 → 64 ms; repetir o baseline deu **88 ms**. Também não é INP de utilizadores reais.

## Alterações implementadas

1. Painéis montados sob demanda e retidos na memória React enquanto o aluno e o contexto autenticado forem os mesmos. O componente `RetainedActionPanels` evita desmontar formulários e anexos em cada troca; `React.memo` evita renderização das abas ocultas. A chave de retenção separa utilizador, escola, polo e aluno; contexto inclui ano letivo, com a atualização do ano sem destruir automaticamente rascunhos.
2. Importação dinâmica dos módulos de matrícula, notas e dossiê integral, usando Next.js existente, sem dependência de produção adicional.
3. Invalidação dos dados após operações canónicas. Pagamentos não exibem sucesso financeiro liquidado até o servidor confirmar o estado atualizado; falha de recarga bloqueia a apresentação de saldo supostamente atual. Estados **liquidado** e **aprovado pela secretaria** continuam separados pelo contrato existente.
4. Proteção de concorrência com geração de requisição para rejeitar respostas atrasadas do dossiê do aluno; troca de aluno troca a fronteira inteira do cache em memória. Navegação e `atendimentoAlunoId` preservam a seleção e mantêm **Nova Matrícula** independente.
5. Proteção contra perda de trabalho: abas ocultas mantêm `input` e anexos montados, com aviso de saída/abandono quando existe entrada pendente. Os rascunhos de admissão e rematrícula com recuperação de sessão usam escopo de operador + polo + escola, têm expiração e limpeza no logout; o formulário de nova matrícula conserva autorizações e autosave canónico.
6. Entrada modal sem identidade autenticada explícita permanece no caminho conservador, **sem retenção em memória**, para não arriscar partilha entre operadores.

## Testes e evidências

- Playwright/Chromium com Vite local e endpoints inteiramente simulados: texto digitado, anexo de comprovativo, mudança de abas, preservação de rascunho durante atualização, Nova Matrícula sem aluno herdado, troca de utilizador/escola/polo/aluno e confirmação de saída. Testes de contrato cobrem URL e gerações de requisição.
- **105 JPEGs de fixture:** 7 abas × 5 resoluções (1366×768, 1536×864, 1920×1080, 768×1024, 390×844) × zoom CSS 100%, 125% e 150%; **nenhum overflow horizontal do documento** no cenário capturado. Zoom CSS **não é** teste do controlo nativo de zoom do Chrome; detalhes em `evidence/README.md`.
- Workflow CI permanente `Balcao Performance Budgets` verifica orçamento de requisições, commits, JS de fixture e bundle Next, além de testes de contrato, typecheck, lint e build. Suite completa do portal é executada pelas workflows de consolidação existentes.
- Dados dos testes, logs, relatórios e imagens são **100% sintéticos**. Não houve operações financeiras reais, deploy, migração, alteração RLS nem motor financeiro.

## Limites e riscos residuais

1. **Não foi feito E2E autenticado** contra Next.js + Supabase descartável para cobranças, emissão/impressão e rematrícula, nem medição de consultas pesadas em PostgreSQL. A fixture React é controlada, mas não prova velocidade ou RLS reais em produção.
2. A taxa de consultas por hora real depende da carga da escola. Medição de uso ocioso e ciclos sintéticos são verificáveis, mas não substituem APM/RUM.
3. Manter sete painéis em memória reduz re-fetch, mas potencialmente aumenta o heap; não foi obtido heap profile prolongado de 8 horas. O teste de 60 s ocioso confirma que não há polling acrescido.
4. A proteção financeira privilegia dados corretos à velocidade, inclusive com recarga depois da mutação.
5. A PR #211 toca `CommandCenterPanel`, e a PR #212 implementa o copiloto. Precisam de reconciliação de diffs antes do merge. Nem transferência de turma nem avisos foram reimplementados nesta PR.

**Status:** PR #213 dedicada, sem merge/deploy. A publicação deve continuar gated por revisão, homologação funcional autenticada e métricas de utilizadores reais.

### Double-check (21/10/2026)

A segunda revisão identificou que o marcador de trabalho pendente podia permanecer ativo após uma gravação confirmada, provocando alertas falsos de abandono. Foi corrigido com `savedAction` + `saveRevision`: somente a aba cuja operação canónica concluiu tem o marcador limpo. Atualizações em segundo plano **não** limpam o marcador, e outros rascunhos mantêm a proteção. O E2E sintético agora verifica ambos os casos: gravação confirmada limpa a proteção, atualização de servidor sem gravação não limpa nem remonta o rascunho. A CI do novo HEAD deve ser reexecutada após a correção.
