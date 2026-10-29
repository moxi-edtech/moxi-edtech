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
