# Política Fiscal — Retenção e Acesso ao Ledger

Data: 2026-03-26
Status: Publicada (aguarda aprovação formal)
Escopo: `fiscal_documentos`, `fiscal_documentos_eventos`, `fiscal_saft_exports`, `audit_logs` fiscais.

## Objetivo

Definir retenção mínima, regras de acesso e trilha de auditoria para dados fiscais e evidências associadas.

## Princípios

- Ledger fiscal é append-only para eventos.
- Sem exclusão destrutiva de histórico fiscal ativo.
- Menor privilégio para acesso operacional.
- Rastreabilidade completa de leitura e alteração.

## Tabela de retenção

- `fiscal_documentos`: retenção mínima 10 anos.
- `fiscal_documentos_eventos`: retenção mínima 10 anos.
- `fiscal_saft_exports`: retenção mínima 10 anos.
- `audit_logs` fiscais: retenção mínima 10 anos.

Observação:
- Prazos acima são baseline interno; prevalece exigência legal/regulatória superior.

## Regras de acesso por papel

- `owner`: acesso total operacional e auditoria.
- `admin`: acesso total operacional, sem alterar políticas.
- `operator`: emissão/operação diária, sem governança.
- `auditor`: leitura e exportação para auditoria, sem operações de emissão.

## Regras de acesso técnico

- Toda rota fiscal exige autenticação e vínculo fiscal válido.
- Acesso por `empresa_id` com isolamento por tenant.
- Ações críticas devem gerar evento em ledger e audit log.
- Exportações SAF-T devem registrar checksum e período.

## Regras de descarte e anonimização

- Não apagar documentos/eventos fiscais dentro do prazo de retenção.
- Após prazo, descarte apenas com aprovação formal e trilha de auditoria.
- Dados pessoais em artefatos auxiliares podem ser minimizados quando legalmente permitido, sem comprometer auditoria fiscal.

## Evidências mínimas de conformidade

- Logs de acesso e operação por `request_id`.
- Registro de eventos fiscais (`RECTIFICADO`, `ANULADO`, `SAFT_EXPORTADO`).
- Exportações com `checksum_sha256`.
- Registro de aprovações de retenção e descarte.

## Processo de revisão

- Revisão trimestral por Financeiro + Segurança + Engenharia.
- Revisão extraordinária em caso de alteração legal.
- Versionamento deste documento com histórico de mudanças.

## Referências

- `docs/fiscal/api/fiscal-documentos.md`
- `docs/fiscal/api/fiscal-saft.md`
- `docs/fiscal/certificacao/backlog-fiscal-fase6-infra-governanca.md`
