# APPLY DIFF — 20260701_ONBOARDING_LIFECYCLE_ALIGNMENT

Objetivo: alinhar o significado operacional de onboarding, provisionamento e setup escolar entre o CRM do parceiro e o portal K12.

Escopo previsto:

- corrigir o gate do portal K12 para não tratar `ano_letivo` activo como onboarding escolar concluído
- expor no payload do parceiro o estado real de setup escolar pós-provisionamento
- alinhar a UI do parceiro para distinguir onboarding operacional, provisionamento e setup escolar
- alinhar as páginas de onboarding/configurações da escola para usar `onboarding_finalizado` e `needs_academic_setup`
