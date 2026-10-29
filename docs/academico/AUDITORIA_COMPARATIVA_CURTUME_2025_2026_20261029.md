# Curtume — auditoria comparativa 2025/2026 → 2026/2027

**Consulta:** 29/10/2026 · **Fonte:** Supabase de produção, somente leitura.  
**Escola:** `3744879f-2e19-4671-8995-78604302d8c5`.  
**Scope:** matrículas e transições; não altera notas, históricos, turmas, financeiro nem módulo fiscal.

## Anos letivos confirmados

| Referência | Registro `anos_letivos.ano` | Vigência | Estado |
|---|---:|---|---|
| Origem 2025/2026 | 2025 | 2025-09-01 a 2026-07-31 | `ativo=false`, arquivado em 2026-08-05 |
| Destino 2026/2027 | 2026 | 2026-09-01 a 2027-08-31 | `ativo=true` |

## Conferência das matrículas

- Origem 2025: **564** matrículas, uma por aluno; **550 pendentes** e **14 concluídas**.
- Destino 2026: **511** matrículas, uma por aluno; **510 ativas** e **1 pendente**.
- **321** alunos existem nos dois anos, distribuídos em:
  - **282** em classe superior; **280** progrediram uma classe e **2** saltaram duas classes;
  - **38** na mesma classe, **não necessariamente reprovados**;
  - **1** em classe inferior (3.ª → 2.ª), requer revisão.
- **243** matrículas antigas sem matrícula correspondente no ano seguinte; isto **não implica abandono nem conclusão**.
- **190** matrículas novas sem matrícula correspondente em 2025; isto **não prova nova admissão sem consultar candidatura/transferência**.

## Decisões académicas pré-existentes

| Resultado registado | Matrículas | Classe origem → destino | Situação |
|---|---:|---|---|
| Aprovado | 12 | 1.ª → 2.ª | `historico_anos.snapshot_status=aberto` |
| Reprovado | 1 | 2.ª → 2.ª | `historico_anos.snapshot_status=aberto` |
| Reprovado | 1 | 8.ª → 8.ª | `historico_anos.snapshot_status=aberto` |

Os 14 históricos têm `data_fechamento`, **mas nenhum está juridicamente bloqueado**; a ratificação escolar e o fecho legal permanecem etapas separadas. Todos os 14 estão sem notas associadas à matrícula de origem.

## Lacunas verificadas

1. **6 matrículas destino ativas sem `origem_transicao_matricula_id`**, apesar de o aluno ter origem única em 2025: **5 Pré-Escolar → 1.ª** e **1 da 7.ª → 7.ª**. Das 321 matrículas destino com origem correspondente, 315 têm o vínculo correto. Não corrigir a ligação sem conferir a operação de origem, o motivo e a auditoria de admissão/transição.
2. **3 transições atípicas** (todas com origem pendente e destino ativo): **Pré-Escolar → 2.ª**, **7.ª → 9.ª**, **3.ª → 2.ª**. Podem refletir registo incorreto, ingresso excepcional ou decisão escolar. Não reclassificar automaticamente.
3. **Metadados de classe incompletos**: em todas as 10 classes Curtume consultadas, `classes.numero IS NULL` e `classes.ordem=0`; `turmas.classe_num` e `turmas.ano_numero` também vieram nulos nos grupos analisados. As contagens de progressão acima derivam **exclusivamente do nome da classe** (ex.: `7ª Classe`) e precisam de confirmação antes de virar regra automática. No repositório, `apps/web/src/lib/rematricula/classe-numero.ts` trata o fallback do nome; não inferir `0` de `NULL`.
4. **Notas 2025**: apenas **13 classificações para 5 alunos**, em **6 avaliações**, vinculadas a **2 turma-disciplinas**. O GradeEngine já reportou as 564 origens como `incompleto`. **Não fabricar notas positivas/negativas a partir da classe de destino.**
5. Existe **1 matrícula 2026 pendente e inativa na 8.ª classe**, a analisar pelo fluxo habitual.

## Ações seguintes, em ordem

1. Validar documentalmente as **14 decisões anteriores** e ratificá-las pela rotina existente; depois proceder ao fecho legal autorizado.
2. Reconciliar, pela escola, as **3 transições atípicas**; manter destino e origem sem alterações até existir evidência suficiente.
3. Investigar os **6 vínculos ausentes** junto dos logs/auditoria da rematrícula, evitando duplicar matrículas e evitando updates diretos sem fonte validada.
4. Completar metadados canónicos de classe sob migração controlada, depois de validar a matriz curricular da escola e os consumidores RAA/Balcão/portais; preservar o fallback legado enquanto necessário.
5. Colocar os **550 resultados pendentes** em fila de decisão com referência documental e autor; **ausência de notas não é reprovação**. Distinguir decisão administrativa documentada de nota numérica real.
6. Confirmar situação dos **243 sem continuidade**, incluindo candidatos a conclusão da 9.ª classe, transferência e abandono, sem inferir estado final automaticamente.
7. Só publicar documentos oficiais com snapshot legal bloqueado e decisão sustentada por evidência.

**Critério de segurança:** nenhuma alteração nas tabelas `notas`, `historico_anos`, `matriculas`, nem nas RPCs de fecho foi realizada nesta auditoria. Os dados acima são contagens para a Curtume, não autorização para aprovação em massa.

**Referência:** `docs/academico/RESULTADOS_PRELIMINARES_CURTUME_2025_20261029.md` e `docs/academico/RECONCILIACAO_HISTORICA_EVIDENCIA_20261029.md`.

## Implementação de integridade — 29/10/2026

### Aplicado e verificado no Supabase live

- **9 registos de classe numerada** normalizados em `classes.numero` e `classes.ordem`; o Pré-Escolar permanece `numero=NULL`, `ordem=0`.
- **42 turmas numeradas** (21 em 2025/2026 e 21 em 2026/2027) tiveram `turmas.classe_num` normalizado a partir da classe oficial; as 2 turmas de Pré-Escolar permanecem com `classe_num=NULL`.
- **3 guards transacionais** instalados: normalização de classes/turmas por tenant Curtume, integridade do `origem_transicao_matricula_id` por escola/aluno/ano e validação de turma e vínculo antes do congelamento legal de históricos.
- Os dados académicos não foram inventados nem alterados: 550 origens de 2025 continuam em revisão, 14 decisões anteriores aguardam ratificação, 13 notas reais continuam associadas a 5 alunos. O módulo fiscal continua intocado.

As migrations remotas constam no ledger como
`20261029102650_curtume_class_metadata_and_transition_lineage_20261029`,
`20261029103216_curtume_legal_history_destination_guard_20261029` e
`20261029103555_curtume_turma_classe_number_consistency_20261029`.
O repositório mantém shims dessas versões e versões completas de replay em
`20271029110000`, `20271029120000` e `20271029130000`.
Não executar scripts de produção duas vezes manualmente sem validar o ledger.

### Código preparado na branch

O endpoint de reconciliação lista alertas para vínculo ausente/divergente, salto, regressão, classe desconhecida e repetição a confirmar. Registar um resultado com matrícula destino existente exige vínculo de origem válido e classe compatível com o resultado confirmado. A interface **não seleciona aprovado por padrão**, mostra os alertas e oferece acesso contextual ao Balcão. O fecho legal é protegido adicionalmente na base de dados, mesmo que o cliente contorne a UI.

### Pendências que não podem ser inventadas

O script repetível de diagnóstico `supabase/ops/scripts/audit_curtume_academic_year_transition.sql` retornou:

| Categoria | Alunos |
|---|---:|
| Transições ordinárias para conferência da escola | 277 |
| Matrícula destino sem vínculo explícito | **6** |
| Salto de classe | **2** |
| Regressão de classe | **1** |
| Mesma classe sem decisão registada | **35** |
| Sem matrícula no ano seguinte | **243** |
| **Total de origens** | **564** |

Essas categorias são **administrativas, não decisões do GradeEngine**. As 6 matrículas sem origem explícita foram criadas em lote com eventos `CREATE` e `MENSALIDADES_GERADAS`, sem assinatura pedagógica; a ligação formal não foi atribuída sem declaração verificável. As 3 transições atípicas e as 35 possíveis repetições precisam de confirmação escolar. Alunos sem matrícula no ano seguinte podem ter saído, concluído ou mudado de escola: não presumir estado.

**Não foram corrigidos casos individuais dependentes de atas, pautas ou declaração da direção**, nem fechados snapshots; isso é uma barreira deliberada de integridade. O próximo responsável escolar deve usar `Secretaria → Operações Académicas → Reconciliação académica histórica` para documentar e ratificar cada resultado, e `Balcão → Rematrícula` para rever as matrículas destino divergentes.

### Não afetado

Nenhuma migration, trigger ou API desta correção modifica `notas`, `avaliacoes`, mensalidades, pagamentos, recibos, AGT ou SAF-T.
