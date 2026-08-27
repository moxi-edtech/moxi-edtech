# Apply Diff — assessment policy and document engine foundations

run_id: C4FA2ED5-424D-4B17-8F69-98ECF0C8D660
timestamp: 2026-08-21
scope: new versioned foundation tables only

## Acção proposta

Criar tabelas versionáveis para policies de avaliação, decisões futuras e templates/exports de documentos oficiais.

## Salvaguardas

- nenhum cálculo legal é implementado;
- policies `pending`, `draft` ou `under_review` não podem gerar `assessment_decisions`;
- status `approved` exige evidência normativa mínima;
- templates oficiais permanecem placeholders até fonte documental validada;
- RLS e grants mínimos por tenant/Super Admin;
- nenhuma tabela atual de notas, avaliações ou documentos emitidos será alterada.

## Aplicação live

A migration será aplicada somente após o arquivo ser criado e revisado. Nenhum dado existente será migrado ou reclassificado.
