# POP/SOP - Pacote Operacional do CRM KLASSE

Versao: 1.1.0
Data base: 2026-07-01
Escopo: CRM comercial, onboarding, implantacao, capacitacao, suporte L1 e comissoes do parceiro operacional

## Objetivo

Consolidar em uma unica frente os documentos que devem apoiar o CRM do parceiro operacional, conforme o Anexo de SLA e Comissoes.

## Estrutura

- `parceiro/`: POPs do CRM comercial, onboarding, comissoes e acesso do parceiro.
- `admin/`: POPs operacionais usados pelo parceiro durante setup, capacitacao e suporte L1 nas escolas.
- `documentos/`: contrato, anexo de SLA/comissoes, checklist de recolha e material HTML do CRM.

## Regra de uso

O CRM deve priorizar estes documentos para orientar:

- prospeccao, demonstracao e follow-up comercial;
- conversao de leads em pedido de onboarding;
- setup de dados, curriculo, alunos, professores, financeiro e documentos;
- capacitacao de secretaria, direcao e docentes;
- suporte L1 com SLA;
- acompanhamento de comissoes e penalidades operacionais.

Regras semanticas deste pacote:

- `pedido de onboarding` nao significa escola provisionada;
- triagem do parceiro nao significa etapa concluida;
- aprovacao final da KLASSE e que conclui etapa documental;
- escola so deve ser tratada como pronta quando o readiness operacional estiver completo.

Quando um POP descrever uma acao ainda inexistente no codigo, tratar como backlog funcional do CRM ou fluxo de Super Admin, conforme indicado no proprio documento.
