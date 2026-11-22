# KLASSE — Contexto académico por operação e Arquivo Académico
Data: 2026-11-22  
Branch: `feat/academic-history-contextual-20261122` (base: `main`)  
Estado: implementação incremental; não declarar cobertura global sem E2E.

## Problema e decisão
O seletor `AcademicYearSelector` na topbar alterava o `ano_letivo_id` para módulos diferentes. O `AppShell` transportava esse filtro pela sidebar, inclusive entre operações não relacionadas. A Central de Documentos tinha ainda um ano local distinto do ano da URL; ao enfileirar documentos escolhia a URL prioritariamente, permitindo construir um pedido incompatível com a turma do formulário (a API devia bloqueá-lo).

**Decisão:** ano atual automático por operação; ano anterior explícito no dossier, pedido de documento ou Arquivo Académico. Não utilizar cookie, `localStorage` nem estado universal como fonte do ano letivo. A URL pode transportar o ano para partilha/deep link **da mesma operação**, mas a navegação para outro módulo regressa ao seu contexto normal. A API e o banco continuam a validar o `session_id`/ID canónico.

## Superfícies desta entrega
1. **AppShell** — retirar seletor universal e faixa vazia; manter alerta contextual quando a página está explicitamente em modo histórico. Sidebar deixa de propagar parâmetros de ano de uma operação para outras.
2. **Arquivo Académico** — entrada em Operações Académicas de Operações e Secretaria; anos anteriores vêm do endpoint autenticado `/api/secretaria/school-sessions`; seleção não altera o contexto das outras páginas; cartões para alunos, turmas, documentos e reconciliação.
3. **Central de Documentos (QuickDocHub)** — seleção do ano local baseada em `anos_letivos.id`, inclusive deep link validado contra a lista autorizada; filas de lotes enviam sempre esse ID; mudança de ano limpa turma, filtros dependentes e período. Os trimestres vêm de `/api/secretaria/relatorios/mapa-aproveitamento?ano_letivo_id=...`.
4. **Documentos Oficiais em lote** — seletor de ano próprio; seleção de turmas vem do novo GET filtrado por `turmas.session_id` em escola/ano; períodos consultados com ano explícito e confirmados contra a resposta; impede mistura de seleção local e URL. O POST canónico mantém os guards de escrita em ano encerrado.
5. **Listas de matrículas** — link direto de arquivo com `ano_letivo_id` valida a opção recebida; seletor da página partilha o ano escolhido na URL sem mudar a sidebar.
6. **Dossier do aluno** — o componente de percurso 360º já existente apresenta os anos com intervalo completo (`2025/2026`) e abre um detalhe focalizado no ano pedido, sem duplicar a timeline nem trocar o ano do portal. Ano inexistente apresenta recuperação para todos os anos.

## Conceito de domínio
- `escola_id`: autorização multi-tenant do utilizador.
- `ano_letivo_id`: período académico canónico, identificado pelo UUID e não pelo ano civil isolado.
- `aluno_id`: pessoa; mantém identidade entre matrículas e anos.
- `matricula_id`/`turma_id`: registros do período de origem; validar pertença à escola e à sessão.
- `periodo_letivo_id`: subperíodo validado no mesmo ano da turma/matrícula.
- `data_emissao` versus `ano_referencia`: conceitos diferentes nos documentos oficiais.

Não sincronizar automaticamente notas finais históricas para avaliações trimestrais. `HIST_FINAL` é nota final documental, não avaliação MAC/NPP/NPT. Não reabrir anos fechados nem repetir migrations de reconciliação para simplificar UX. A regularização histórica usa os endpoints/RPCs atuais com evidência e auditoria; o Arquivo Académico é uma porta de navegação, não uma fonte de dados alternativa.

## Comportamento da experiência
| Entrada | Contexto inicial | Histórico | Escrita |
|---|---|---|---|
| Dashboard, notas, frequência, turmas | ano ativo da escola | arquivo ou pesquisa contextual | só no ano/período autorizado |
| Alunos | ano atual no módulo | dossier e percurso académico | apenas em registos editáveis |
| Turmas e classes | turmas atuais; classes pertencem ao catálogo | turmas vinculadas a ano específico | não alterar turmas fechadas |
| Documentos oficiais | ano ativo | seleção no pedido ou arquivo | lote oficial histórico bloqueado até existir emissão excepcional autorizada |
| Lista nominal | turma e ano do próprio pedido | lista histórica permitida pelas políticas vigentes | não altera matrícula |
| Financeiro | conta corrente, incluindo dívidas antigas | filtro competência/ano | cobrança preserva competência original |
| Reconciliação Histórica | caso ou matrícula de origem | entra pelo arquivo/dossier | operações especiais auditadas, nunca um `WRITE` genérico |

## Limites explícitos desta branch
- O Arquivo Académico abre consumidores existentes, sem substituí-los. A visão cronológica completa do dossier ainda exige evolução dedicada do componente de percurso do aluno.
- Emissão de **novos** lotes oficiais de pautas/certificados para anos fechados permanece proibida pelo contrato atual. Segunda via deve reutilizar documento oficial versionado e sua proveniência; não contornar `ACADEMIC_YEAR_CLOSED`.
- O Balcão mantém o seletor **local** enquanto seus fluxos de rematrícula e regularização de origens/destinos não estiverem totalmente desacoplados. Não removê-lo sem E2E.
- Dados de `anos_letivos` projetados/planeados não devem aparecer como arquivo histórico.
- Nenhuma migration ou nova RPC é necessária para esta primeira etapa; não criar duplicidade de notas, matrículas, turmas ou documentos.

## Segurança e critérios de aceitação
- [ ] Sessão não autenticada, escola de outro tenant, e papel sem acesso não consultam nem mutam dados.
- [ ] Link histórico da turma 2025/2026 nunca carrega a turma da escola ou sessão 2026/2027.
- [ ] Trocar ano na Central de Documentos limpa a seleção de turma e período antigos.
- [ ] No lote, GET de turmas e GET de trimestres usam exatamente o mesmo `ano_letivo_id`.
- [ ] POST com turma de outro ano é rejeitado pela API com `409 CROSS_YEAR_ENTITY_MISMATCH`.
- [ ] Documento histórico sem snapshot/fecho válido não é emitido.
- [ ] Ano encerrado não permite nova pauta/certificado em lote pelo formulário operacional.
- [ ] Duas abas com anos distintos não se interferem. Sidebar regressa ao padrão do módulo destino.
- [ ] Nenhuma query de notas/documentos faz fallback implícito para matrícula mais recente.
- [ ] E2E com escola Curtume, Secretaria, Operações e casos reais autorizados antes de merge.

## Próximos PRs recomendados
1. **Dossier cronológico**: matrícula por ano, resultados, notas e documentos por fonte canónica; consulta histórica sem mudar ano do portal.
2. **Emissão/segunda via histórica**: selecionar snapshot oficial, auditar motivo de reemissão, preservar versão/referência/validade; adaptar endpoint específico em vez de contornar guard de escrita.
3. **Balcão e professores**: suprimir seletores residuais quando entidade contextual estiver demonstravelmente completa; preparar próximo ano via Virada e não por seleção global.
4. **Relatórios e financeiro**: filtros locais de competência e comparação, mantendo valores de anos anteriores na conta corrente.

### Fontes de verdade
- `apps/web/src/lib/academic-year/context.ts`
- `apps/web/src/lib/academic-year/navigation.ts`
- `apps/web/src/lib/documentos/listaNominalPolicy.ts`
- `apps/web/src/components/secretaria/BalcaoHistoricalAcademicRecovery.tsx`
- `docs/ops/curtume-notas-finais-reconciliacao-20261121.md`

## Publicação
Validar typecheck, lint, testes unitários, integração e smoke autenticado; abrir PR como draft até concluir os gates. Sem merge/deploy automáticos nesta branch.
