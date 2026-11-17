# Listas nominais — decisões de produto (2026-11-16)

Padrão: docs/product/graciosidade.md. PRs empilhadas: P0 histórico → P1 acesso → P1 PDF → P2 lote.

## Modos e estados (P0)
- **Lista do ano letivo (histórica):** considera apenas a sessão académica da turma/classe seleccionada. Inclui activas, concluídas, transferidas e trancadas. A saída (transferida/trancada) é identificada. Exclui pendentes, canceladas e estados desconhecidos, informando as quantidades por motivo.
- **Lista operacional actual:** somente matrículas com estado activo e indicador activo. Exclui as demais, informando quantidades e razões.
- **Incluir todos os estados:** escolha administrativa explícita, preservando o estado individual. Nunca converter transferida/cancelada em activa.
- Sessão não activa: predefinição histórica. Sessão activa: predefinição operacional. O modo, o ano e as contagens são impressos.

## Isolamento e permissões
Manter os mesmos guards de emissão existentes: não alterar RLS, papéis, esquema fiscal, financeiro ou regras de matrícula. A política comum de inclusão só actua sobre dados já restritos ao tenant e à sessão no backend.
As PRs abertas do Command Center (#236–#238) introduzem política própria de exportação auditada no Command Center, com CC-013 por decidir. **Não copiar essa política nem reactivar a rota nova nesta PR**. Convergência por revisão antes do merge; nenhuma alteração aos ficheiros da PR #238.

## Evidência sintética
Fixture com duas matrículas concluídas inactivas que o filtro anterior devolvia vazias, além de estados transferida/trancada/cancelada/pendente. Cobertura unitária de inclusão e reconciliação de totais. Não utilizar dados reais de alunos.

## Próximas PRs
Acção directa com autorização por escola/polo; PDF com número de processo, margens e paginação verificadas; lote idempotente e XLSX nominal. Nenhuma migration de dados nesta PR.

## P2 — lote e Excel nominal (PR empilhada)

- **ZIP por pedido**: um PDF por turma, manifest com IDs e hashes, sem nomes de alunos nos caminhos e metadados.
- **Limites**: até 10 turmas/pedido e 10 pedidos novos/hora por operador. Fila existente em Inngest continua assíncrona, com consultas da UI a cada 15 segundos (antes, 5).
- **Falhas parciais**: ZIP das turmas com sucesso descarregável; estados por turma; repetir somente falhas preservando PDFs anteriores.
- **Proteção do worker**: service role exige que o job, a escola e as turmas do evento coincidam com os itens previamente autorizados. A reconciliação usa os itens persistidos.
- **Excel (.xlsx)**: exportação nominal por turma e classe inteira, com número de processo, situação e identificação da turma; células textuais sem fórmulas. Sem BI, nascimento nem naturalidade.
- **CSV**: a rota experimental de exportação foi removida desta PR. São suportados exclusivamente PDF e Excel para listas nominais. O PDF básico permanece independente do QR.
- **Auditoria fail-closed**: PDF por turma/classe, XLSX e cada documento nominal em lote; regista operador, escola, entidade, ano, modo, quantidade de linhas e presença de campos sensíveis, sem conteúdo.
- **Reprocessamento**: idempotência versionada grava somente opções não pessoais. Lotes antigos com opções não recuperáveis são recusados em vez de mudar silenciosamente o modo.

## Isolamento entre polos — revisão do esquema (2026-11-17)

Uma verificação somente de leitura no Supabase confirmou que **já existem** as relações
`escola_polos`, `escola_turma_polos` e `escola_user_polos`. A afirmação anterior
de ausência de modelo canónico estava desactualizada. As políticas
`cc_polo_turmas_all` e `cc_polo_matriculas_all` estão configuradas como
`RESTRICTIVE` para `authenticated`, e incluem
`cc_security.allowed_turma(escola_id, turma_id, ano_letivo)`.

Estado observado em 17/11: zero escolas com isolamento por polo activado,
zero polos activos e zero vínculos turma↔polo ou operador↔polo.
Dessa forma, não existem polos operacionais para realizar E2E autenticado real
neste projecto. **Não confundir a presença de RLS com uma homologação de
isolamento entre dois polos**: essa validação é obrigatória antes de
activar o primeiro polo ou autorizar a exportação para um operador limitado a
um polo. A emissão usa o cliente autenticado (não service_role), respeitando
a RLS restritiva de turmas e matrículas. O worker de lotes conserva a
autorização do evento e dos itens persistidos antes de utilizar service_role.

## Homologação pendente

- PDFs sintéticos de 55 alunos, nomes repetidos com processos distintos, textos longos, acentos e turma vazia: extração de texto, paginação, bboxes de margens e PNGs anexados pelo CI.
- Testes unitários e de contrato para Excel contra formula injection, estado parcial do lote, reprocessamento e verificações de tenant no worker.
- Ainda não provado: E2E autenticado com dois polos activos, sessão expirada, volume real e impressão em papel; validar antes de activar o isolamento por polo.
- Esta PR só contém código e testes. Nenhuma migration nova, migração aplicada ou deploy. A integração depende de CI verde e revisão da compatibilidade com a main; a activação futura do isolamento entre polos requer homologação específica.
