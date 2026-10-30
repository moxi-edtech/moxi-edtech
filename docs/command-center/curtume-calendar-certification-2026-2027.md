# Curtume — certificação técnica do calendário 2026/2027

**Data da auditoria:** 29/10/2026  
**Escola:** COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME  
**Escopo:** ano letivo `ano=2026` (2026/2027), calendário MED do subsistema pré-escolar e ensino primário/secundário regular e de adultos, períodos, eventos, provas, turmas, matrículas e principais rotas consumidoras.

## Veredicto

**10/11 verificações SQL aprovadas.**
- **Dados académicos do Curtume: alinhados com os quatro campos de calendário operacional e as versões dos modelos MED cadastrados.**
- **Proveniência documental: NÃO certificada.** O catálogo tem `fonte_documento_url` e `publicado_em` ausentes para os modelos utilizados. A simples designação `FINAL-ACTUALIZADO` não comprova a publicação normativa.
- **Consumo pelas APIs: correções em PR #299; não homologado em produção.** Os novos testes automáticos e o typecheck aguardam CI. Autenticação real dos portais e comportamento pós-deploy ainda devem ser testados.

Não emitir certificado integral ou afirmar que todas as rotas estão 100% sincronizadas antes de superar os bloqueios restantes.

## Evidência SQL repetível

Fonte: `supabase/ops/tests/certify_curtume_calendar_2026_2027.sql`, consulta exclusivamente de leitura no Supabase real. Sem alterações a notas, frequência, avaliações, histórico, financeiro ou matrículas.

| Verificação | Resultado | Total inspecionado |
|---|---|---:|
| Ano ativo único | Aprovado | 1 |
| Datas do ano de acordo com os modelos MED | Aprovado | 3 ofertas |
| Perfis publicados e compatíveis por subsistema | Aprovado | 3 ofertas |
| Trimestres e respetivas datas | Aprovado | 3 |
| Trimestres com origem e versão válidas | Aprovado | 3 |
| Eventos oficiais completos | Aprovado | 31 |
| Eventos com origem e versão válidas | Aprovado | 31 |
| Turmas associadas à sessão correta | Aprovado | 22 |
| Matrículas associadas a turmas da sessão correta | Aprovado | 512 |
| Classes de exame identificadas | Aprovado | 22 turmas |
| Documento normativo oficial vinculado e datado | **Pendente** | 3 ofertas |

## Descoberta importante: eventos consolidados entre subsistemas

O calendário operacional contém 31 eventos únicos, mas:
- perfil `PRE_ESCOLAR`: 17 itens não periódicos; 17 estão presentes;
- perfil `REGULAR_ADULTOS`: 29 itens não periódicos; 29 estão presentes;
- alguns eventos comuns foram consolidados com proveniência do pré-escolar, deixando apenas 14 registos com `source_template_id` do perfil regular.

Por isso, **filtrar apenas por source_template_id perde 15 eventos relevantes do ensino regular**, apesar de todos existirem no calendário da escola. A PR #299 introduz `selectApplicableOfficialEvents`, que compara nome, tipo, início e fim com os itens publicados aplicáveis ao curso, ao aluno autorizado e à sessão. A 6.ª e a 9.ª classes recebem ainda a proteção `is_classe_exame` para exames não classificados por série no modelo do MED.

### Verificação de visibilidade por classe (Supabase, só leitura)

A correspondência com os itens publicados, aplicada às turmas de 2026/2027, devolveu:

| Turma | Eventos aplicáveis do perfil | Eventos de exame nacional |
|---|---:|---:|
| Pré-escolar | 17 | 0 |
| 1.ª a 5.ª classes | 25 por classe | 0 |
| 6.ª classe | 29 | 4 |
| 7.ª e 8.ª classes | 25 por classe | 0 |
| 9.ª classe | 29 | 4 |

Os trimestres e as provas trimestrais são preservados; exames não classificados por série no catálogo são expostos apenas quando `turmas.is_classe_exame=true`. Isto demonstra coerência do **cálculo sobre os dados**, não uma execução autenticada do portal.

**Esta lógica está codificada, não comprovada em produção.**

## Inventário dos consumidores examinados

| Consumidor | Contrato de ano/período | Evidência ou reparo |
|---|---|---|
| Portal aluno: eventos da Home | Ano ativo, matrícula autorizada, oferta/curso e calendário do subsistema | **Corrigido na PR #299**, sem operação de escrita |
| Portal professor: calendário | Ano académico selecionado, eventos MED por `ano_letivo_id`; eventos gerais fora da fonte MED | **Corrigido na PR #299** |
| Secretaria: calendário | `resolveAcademicYearContext`, eventos MED por `ano_letivo_id` | Contrato encontrado no código |
| Professor: períodos letivos | `resolveAcademicYearContext` e `ano_letivo_id` | Contrato encontrado no código |
| Escola: períodos por turma | `assertAcademicYearEntity` e `ano_letivo_id` | Contrato encontrado no código |
| Escola: consulta de períodos | `resolveAcademicYearContext` e `ano_letivo_id` | Contrato encontrado no código |
| Secretaria: pauta trimestral | Contexto académico, turma, disciplina e período existente no ano | **Corrigido na PR #299** para recusar trimestre inexistente |
| Professor: presenças | Contexto académico, turma e período por intervalo de datas | Contrato encontrado no código |
| Secretaria: fecho de frequência | Ano e período validados | Contrato encontrado no código |
| RAA: reapreciação | Contexto académico, trimestre do ano selecionado | Contrato encontrado no código |
| Secretaria: pauta oficial e mapa de aproveitamento | Contexto académico, turma/períodos do ano | Contratos encontrados no código; E2E pendente |
| Secretaria: fechamento académico | `ano_letivo_id` explícito e período de fecho | Contrato encontrado no código |
| Matrícula/admissão | Novo preflight de ano/turma/calendário | **Corrigido na PR #299**, mantém candidatura em caso de desvio |

As rotas de notas, pautas, provas, exames, frequência e rematrícula precisam de **E2E autenticado**, incluindo permissões, classes normais versus classes de exame e verificações nos portais, para validar comportamento de ponta a ponta. Uma leitura estática não substitui estes testes.

## Testes automáticos acrescentados

- `apps/web/tests/unit/decree-calendar-sync-health.spec.ts`: auditoria de limites, trimestres, proveniência, exames, perfil por subsistema, autorização, rotas consumidoras e eventos partilhados.
- `.github/workflows/decree-calendar-certification.yml`: `node --test --import tsx` + typecheck com dependências bloqueadas.
- `apps/web/tests/unit/admissions-workspace-integration.spec.ts`: preservação da candidatura e recuperação contextual.

## Condições de certificação integral

1. Associar aos modelos MED usados no Curtume a **publicação oficial verificável**, data e versão legítima, após conferência com a fonte primária.
2. Aprovar o novo workflow de CI, typecheck e testes existentes; confirmar que o commit está integrado na `main`.
3. Homologar as rotas de aluno, professor, secretaria e Balcão com utilizadores reais autorizados e dados de 2026/2027, incluindo classe 6/9 e aluno do pré-escolar.
4. Validar num ambiente publicado que eventos comuns, exames e provas não atravessam ano, escola ou subsistema.
5. Reexecutar o script SQL. Os 11 checks devem estar aprovados; repetir os cenários regressivos.

**Assinatura operacional:** certificação de dados académicos parcial — não é atestado de conformidade jurídica nem de produção.
