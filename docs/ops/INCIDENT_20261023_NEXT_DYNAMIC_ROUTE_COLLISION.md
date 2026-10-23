# Incidente P0: colisão de rotas dinâmicas Next.js

Data: 2026-10-23; aplicação: app.klasse.ao.

## Evidência

Vercel registrou o erro "You cannot use different slug names for the same dynamic path ('matriculaId' !== 'id')": pelo menos 216 ocorrências envolvendo cinco utilizadores. A mesma falha aparece em activity-feed, estado-hoje, caixa, pagamentos recentes, pesquisa de alunos e contexto acadêmico.

A falha também aparece no deployment do workspace financeiro (2028b1cc), anterior ao commit de permissões do Command Center (9ce82433). Auditoria de apps/web/src/app na main: 2.551 entradas, 1.053 endpoints e páginas e um único conflito identificado entre os nomes dos parâmetros dinâmicos.

## Causa raiz

A PR #253 introduziu apps/web/src/app/api/secretaria/admissoes/matriculas/[id]/workspace-context/route.ts junto das rotas existentes apps/web/src/app/api/secretaria/admissoes/matriculas/[matriculaId]/... . O Next.js não aceita esses nomes diferentes para o mesmo segmento dinâmico. Um erro de inicialização do roteador pode derrubar APIs não relacionadas.

A PR #255 move workspace-context para [matriculaId] e adapta a leitura do parâmetro, preservando o mesmo URL externo e a autorização multi-escola; o tree corrigido não apresenta mais colisões.

## Lacuna no processo de release

Nenhum gate global de CI verificava a coerência de parâmetros dinâmicos Next.js. Vercel READY não comprova a integridade do roteamento no runtime. O novo gate executa um teste de regressão sintético e audita a árvore de rotas em toda PR e push main.

## Verificação antes de encerrar o incidente

1. Exigir CI verde para a PR #255 e correspondência do SHA do deployment.
2. Realizar smoke autenticado de feed operacional, estado-hoje, cartões financeiros, pesquisa de alunos e workspace-context.
3. Comparar logs da nova versão apenas após o tráfego real; erros históricos persistem no agrupamento.
4. Se surgirem outros erros, investigar separadamente. Não assumir que remover a colisão garante saúde de todos os módulos.
5. Não aplicar migrations ou modificar a lógica financeira como parte deste conserto.
