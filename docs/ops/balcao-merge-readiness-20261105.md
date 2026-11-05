# Preparação do merge — Balcão

PR: https://github.com/moxi-edtech/moxi-edtech/pull/322

Commits funcionais: a9f2573fd (operações excecionais), 545515797 (secretaria, efeitos canónicos e auditoria), 66b2c1cdb (experiência guiada e frequência). 600c303c5 regista a aprovação. 732033260 corrige o falso positivo de credenciais dos serviços PostgreSQL locais do CI; 11 testes permitem só os dois literais exatos no workflow e rejeitam desvios e credenciais adicionais.

A branch foi publicada e a PR aberta em draft. Base main: 89cdaca62. Sem conflitos de conteúdo. Os checks remotos iniciaram. Nenhum merge, migration remota ou deploy efetuado nesta preparação.

## Bloqueios

O AGENTS.md exige `can_merge: false` quando existe violação CRITICAL e o Performance Gate bloqueia o merge nessa condição. A revalidação dirigida dos problemas globais anteriores confirmou:

- SEC-001-b2dab294: `/api/teste-rpc` usa escola do pedido e não contém resolveEscolaIdForUser.
- SEC-002-ac701c12: DELETE de turma mantém service role em endpoint humano fora das exceções documentadas.

Os dois ficheiros são idênticos à main; não foram introduzidos pelo Balcão. O terceiro finding anterior, SEC-003 na cópia de calendário, já está corrigido. Evidência integral no `agents/outputs/REPORT_SCAN.md` e JSON correspondente. Não foi criado PASS global nem dispensado o contrato para executar o merge.

AUT006-HOSTED permanece uma pendência de homologação/release: executar o percurso autenticado hospedado com pagamento e recibo. A execução local e o novo CI usam fixtures declaradas de autenticação/transporte/Storage.
