# KLASSE — Contrato único de classes e cursos (onboarding e admin)
Data: 2026-10-29. PR empilhada sobre #288. Escopo exclusivo de estrutura académica.

## Contrato

Uma escola instala uma **oferta formativa** composta por curso, classes, currículo por classe, matriz e turmas. A configuração é partilhada pelos seguintes caminhos:

1. **Admin → Configurações → Turmas e Currículo / Instalar preset:** `curriculo_install_orchestrated` ou `applyCurriculumPreset`.
2. **Onboarding académico → Finalizar:** `core/finalize` → `curriculo_install_orchestrated` → `gerar_turmas_from_curriculo`.
3. **Onboarding legacy → Aplicar matriz:** `onboard_academic_structure_from_matrix`, mantido por compatibilidade.
4. **Admin → Criar classe:** `/api/escolas/[id]/classes`.
5. **Admin → Criar curso:** apenas grava a entidade de curso; **não** significa currículo publicado nem instalação completa.

Em **todos** os escritores, `classes.curso_id` deve apontar para um curso da **mesma** `escola_id`. Para classes numéricas inequívocas (`1ª Classe` até `13ª Classe`, bem como `1º Ano` até `13º Ano`), a regra é `classes.numero = classes.ordem = número`. `Pré-Escolar` mantém `numero=NULL` e `ordem=0`. Classes sem rótulo normalizável exigem metadados explícitos da escola: não adivinhar.

As `turmas` pertencem à classe e ao curso da mesma escola, no ano letivo selecionado, e repetem a `classe_num` oficial se numérica. `turmas.ano_numero` **não** é número de classe; permanece intocado.

`curso_matriz` e `curso_curriculos` não podem ligar `classe_id` de outro curso/tenant. A matriz não pode apontar para uma versão de currículo de outra classe. O currículo pode ter `classe_id=NULL` apenas nos rascunhos legados sem versão por classe.

## Fonte única

- Parser partilhado no frontend: `apps/web/src/lib/academico/class-level.ts`.
- Guardas transacionais no backend: `20271029140000_global_academic_class_metadata_contract.sql`, com validação de tenant/curso e preenchimento dos metadados.
- A API admin expõe `numero` e preserva `curso_id` nas listagens, criação e respostas.
- Instalação via presets fornece `numero` e `ordem` explicitamente; as RPCs antigas são protegidas por triggers no Supabase.

## Migração histórica sem inventar dados

O backfill apenas interpreta rótulos inequívocos e não reatribui cursos, turmas, alunos, notas ou históricos. Para identificadores ambíguos, a configuração fica à revisão da escola.

Em auditoria anterior: nenhuma divergência de curso/tenant em 139 turmas, 866 linhas de matriz e 97 currículos; mas 13 classes numeradas sem `numero` (Colégio Teste II e Escola Graciano), 24 com `ordem=0` na Escola KLASSE e 46 turmas com `classe_num=NULL` onde existe uma classe numerada.
Uma instalação não está operacionalmente pronta só porque existe linha em `cursos`. Exigir currículo publicado por classe e turmas consistentes, e conferir a matriz de disciplinas no checklist do onboarding.

## Não-regressão

- Não conceder privilégio novo a `anon` ou `authenticated`; funções `SECURITY DEFINER` de triggers têm `EXECUTE` revogado.
- Ação bloqueada com código `23514` quando alguém tenta associar classe de outro curso ou escola.
- `NULL` não é interpretado como Pré-Escolar.
- Nenhuma nota, matrícula, decisão pedagógica, cobrança, recibo ou módulo fiscal é alterado.
- Confirmar TypeScript, unit tests, CI e teste transacional no Supabase antes de integrar.
