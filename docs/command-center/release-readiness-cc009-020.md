# Release readiness — Command Center CC-009 a CC-020

**Branch da fase D:** PR empilhada após [#248](https://github.com/moxi-edtech/moxi-edtech/pull/248). **Não autoriza merge, deploy ou migrations na produção.** O CC-001 (replay histórico) é realizado pelo proprietário em paralelo e não foi alterado.

## Matriz de evidências

| Assunto | Cobertura automatizada | Limite honesto |
| --- | --- | --- |
| CC-009 | Filtros SQL combinados `AND`, ordenação e cursor no servidor, tenant RLS na fixture (55 alunos, escola B, busca maliciosa) | Sem reprodução de todas as policies instaladas |
| CC-011 | Contrato de seis operações no Balcão existente, matriz de permissões, API consulta capacidades por escola e aluno | Apenas o serviço de destino comprova operações de escrita; GoTrue real em réplica ainda bloqueado |
| CC-012 | 700 transições de estado isolado; mudanças de utilizador/escola/polo/ano invalidam; retorno com foco testado no React | Transferência/cancelamento simultâneos com DB real aguardam sessão autenticada |
| CC-017 | ID de correlação e erros allowlist nos endpoints auxiliares, sem PII nos logs | Todos os endpoints fora de Command Center conservam contratos próprios |
| CC-018 | axe (A/AA), teclado, foco e 100/125/150% em fixtures 5 larguras | NVDA/VoiceOver manual só o proprietário pode homologar |
| CC-014/015/016/020 | [Medições reproduzíveis e limitações](../performance/command-center-cc014-016-020-20261022.md) | p95 A–Z aumentou na comparação sintética, precisa atenção antes do release |
| CC-008/010/013 | Configuração por escola fail-closed e perguntas exactas: [decisões A](decisoes-por-escola-cc008-010-013.md) | Não ativar filtros indefinidos, exportação sem política ou reconciliação de mensalidades legadas |
| CC-019 | Screenshots de componente React real com 5 larguras × 3 zooms; 3 atendimentos sintéticos consecutivos, captura e foco | Isto **não** é E2E autenticado nas 5 vistas com GoTrue e banco integral |

## Reconciliação com branches concorrentes

Não misturar alterações de produção de branches sem gates de revisão. O roteiro `apps/web/scripts/performance/command_center_merge_rehearsal.py` usa literalmente `git merge-tree --write-tree` para cada PR contra a main e para o conjunto num commit **sintético** via `git commit-tree`. Não avança referências locais/remotas, não faz `git merge` nem escreve na main. Em conflitos estritamente reconhecidos, `-Xours` constrói **apenas** a árvore descartável para executar a suite; os conflitos **não são considerados resolvidos no GitHub**.

| Conflito conhecido | Decisão no Command Center | Gate de integração real |
| --- | --- | --- |
| `Topbar.tsx` (main/#213/#247/CC) | Preservar largura responsiva `clamp(230px,27vw,420px)`, pesquisa modal e descarte do contexto nas mudanças do utilizador/escola/polo. Evitar encolher tipografia. | Reconciliar com `userScope` e `poloScope` do Balcão #213, manter guarda do modal antes de integrar |
| `visual-harness/main.tsx` (Balcão #216 e CC/IA) | Preservar o registo actual de portais, Command Center e IA; testar Balcão #216 separadamente. | Separar fixtures do Balcão num módulo próprio, importá-lo na mesma entrada Vite, sem suprimir testes existentes |
| `useGlobalSearch.ts` (professor #231 e CC) | A branch CC já inclui `professor`, `classe` e `curso` no portal Secretaria; manter ordenação, privacidade e resultados de professor no modal | Confirmar a equivalência da intenção da #231 e não duplicar resultados/atalhos |
| Financeiro #232 | Sem conflito textual na simulação; o motor de cobrança e estados não foram reescritos | Aplicar correção de idempotência em primeiro lugar e revalidar as leituras financeiras |

**Ordem recomendada para revisão futura, sem execução:** #232 (segurança financeira) → #213 (Balcão P1) → #216 (Balcão P2) → #192 (KLASSE IA) → #247 (layout) → #231 (professor) → cadeia do Command Center #234 → #236 → #237 → #238 → #239 → #240 → #241 → #243 → #245 → #246 → #248 → PR D. A #235 (UX de Classe) deve ser comparada com a #236 antes de ser incluída, para evitar duplicação. A #211 (workspace/matrícula/notas) exige reconciliação própria com o Balcão antes de release.

## Blockers não resolvíveis com simples execução de testes

1. **CC-001 está com o proprietário.** O PostgreSQL descartável actual contém o SQL e parte das policies de contrato, não todas as migrations e policies da instalação. Precisamos de replay verde do histórico integral, com as contas fictícias criadas pelo próprio teste e GoTrue. Comando gated (somente cópia descartável, **nunca projeto conectado**):
   `supabase start && supabase db reset --local`.
   Após isso, homologar os dados escolares e financeiros artificiais na réplica e repetir o roteiro de GoTrue/RLS.
2. **Polo:** o catálogo instalado não tem vínculo de polo canónico aprovado para o Command Center. A API falha fechada; não se pode declarar que polo X vê apenas polo X e polo Y apenas polo Y sem schema e política de produto. O proprietário deve indicar o modelo canónico de escola/polo/utilizador/turma e a matriz dos papéis que podem ver a visão organizacional. **Não alterar RLS ou permissões por suposição.**
3. **Regras de negócio por escola:** perguntas A exactas continuam pendentes, com exportação desactivada e matrícula incompleta indisponível até aprovação.
4. **WCAG assistivo:** executar NVDA no Windows e VoiceOver no macOS, focando a pesquisa, filtros, cinco vistas, três atendimentos, zoom 100/125/150 e o retorno à origem. Registrar apenas contas/testes fictícios.
5. **p95/bytes:** a RPC operacional devolve mais campos. A medição sintética registou p95 maior para a leitura A–Z. Aprovar o orçamento após repetir na réplica com workload equivalente.

## Gates de publicação (passos explícitos, NÃO executados)

- Confirmar **cada PR no seu HEAD final**: `gh pr checks 248 -R moxi-edtech/moxi-edtech` e análogos para toda a cadeia; aguardar `gh run watch <id> -R moxi-edtech/moxi-edtech --exit-status`.
- Registar aprovação humana das políticas da escola e dos conflitos funcionais acima. Só então transformar drafts em revisão: `gh pr ready <numero> -R moxi-edtech/moxi-edtech`.
- Aplicar migrations versionadas **apenas depois de revisão de segurança, backup e gate do proprietário**; não executar `supabase db push` a partir destes PRs.
- Autorizar merges e deploy **separadamente**; estes artefactos não realizam nem inferem autorização para `gh pr merge`, promoção Vercel ou SQL em produção.
