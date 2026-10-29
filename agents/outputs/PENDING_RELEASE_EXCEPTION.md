# Proposta de exceção de release — AppyPay
status: RECUSADA pelo utilizador; não aprovada, não ativa
id: EXC-RELEASE-APPYPAY-20261029
regra: gate global de merge/release do contrato 2.0.0
ficheiro: PR #285, integração AppyPay e integrações alteradas
motivo: os blockers globais documentados em REPORT_SCAN.md já existem em origin/main e impedem publicar a integração financeira isoladamente; esta proposta permite separar o release testado da correção do legado, sem atribuir PASS global ao repositório.
aprovado_por: pendente de decisão explícita do proprietário
data: 2026-10-29
expira_em: 2026-11-05

## Escopo exato proposto
Autorizar somente a publicação do PR #285 para a Escola KLASSE, após verificação de todos os ficheiros alterados, SQL aprovado, build, tipos, testes e verificação do webhook. A exceção dispensa, para este único release, a correção e a certificação integral dos ficheiros legados não alterados. Não permite introduzir novas violações, expandir a AppyPay a outra escola, mudar RLS existente ou desativar controles de runtime. Os relatórios globais continuam FAIL e os blockers permanecem registados para correção.

## Risco que precisa ser aceito
Os três blockers confirmados e os demais candidatos do legado não seriam corrigidos ou certificados antes deste release. A ausência de regressão no AppyPay não comprova que esses endpoints são seguros. Esta é uma exceção explícita ao bloqueio global do contrato, não um PASS técnico.

## Alternativa sem exceção
Corrigir os blockers e concluir a auditoria integral antes de qualquer merge/publicação. O domínio SQL já aprovado permanece instalado, com provedor inativo e sem cobranças.

## Como decidir
Aprovar explicitamente esta exceção temporária, ou instruir a correção/auditoria global antes da publicação. Nenhuma das duas decisões foi inferida da aprovação do SQL.

Decisão explícita: “Corrigir o legado antes de publicar”. Nenhuma exceção foi aplicada por este agente. Release externo #295 observado posteriormente com processamento AppyPay desativado.
