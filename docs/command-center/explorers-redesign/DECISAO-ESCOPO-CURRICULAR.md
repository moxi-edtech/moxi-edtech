# Decisão de produto — currículo por ano e versão nos cinco exploradores

**Estado:** aprovado como direção de produto em 23/10/2026; implementação e homologação pendentes na PR #261 (draft).
**Âmbito:** Curso, Classe, Turma, Professor e Disciplina, com impacto especial no explorador de Disciplina e nos vínculos de Turma.
**Fonte:** inspeção de leitura do Supabase do KLASSE, contrato das rotas e auditoria EX-001–EX-014.
**Não autoriza:** alteração automática de dados, RLS, migrações, merge ou produção.

## Decisão

**Não criar nem apresentar uma segunda lista de “matrizes inativas” ou “histórico de matrizes” dentro do explorador operacional.** O KLASSE já possui um modelo de currículo versionado.

A fonte de verdade curricular é composta por:

1. **Escola + ano letivo canónico (UUID)**, explicitamente selecionados pelo utilizador e verificados no servidor.
2. **`curso_curriculos`**: `id`, `escola_id`, `curso_id`, `classe_id`, `ano_letivo_id`, `version` e `status` (estados observados: `published` e `archived`). A versão e o estado do currículo não são substituídos pelo booleano de uma linha.
3. **`curso_matriz`**: `curso_curriculo_id`, `disciplina_id`, `curso_id`, `classe_id`, `ativo` e os atributos pedagógicos. `ativo` diz respeito à linha, não identifica sozinho o ano, a versão ou uma publicação.
4. **Atribuições factuais**: `turma_disciplinas.curso_matriz_id`, vínculos de docente e horários realmente publicados. Não eliminar associações porque a linha da matriz está hoje inativa.

**Na navegação diária:** resolver currículo pelo **mesmo ano letivo e escola**. Apresentar apenas o conjunto curricular aplicável na versão legitimamente selecionada, sem duplicar a mesma associação Curso/Classe/Disciplina em duas secções (“ativa”/“inativa”). Identificar a versão quando necessário, mas não mostrar listas concorrentes.

**No histórico:** consultar a versão/documento curricular do ano escolhido, **não** reconstruir o passado a partir do valor atual de `curso_matriz.ativo`. Se o esquema não fornecer uma fotografia imutável da linha à data, indicar a limitação; não inventar datas de desativação ou narrativas de substituição.

**Em auditoria autorizada:** manter acesso aos registos subjacentes, incluindo arquivados/inativos e ligações históricas, mediante contexto e permissão; esta não é uma secção adicional do explorador comum.

## Evidência do Supabase (fotografia de 23/10/2026; consultas SELECT)

| Observação | Contagem |
|---|---:|
| Linhas em `curso_matriz` | 866 |
| Linhas `ativo = true` | 557 |
| Linhas `ativo = false` | 309 |
| Linhas inativas pertencentes a currículos `published` | 218 |
| Linhas inativas pertencentes a currículos `archived` | 91 |
| Linhas inativas com currículo de 2025 | 259 |
| Linhas inativas com currículo de 2026 | 50 |
| Combinações escola/disciplina/curso/classe com linha ativa e inativa **no mesmo ano** | 50 |
| Combinações apenas inativas **no respetivo ano** | 218 |
| Vínculos turma–matriz que apontam a linhas inativas | 146 |
| Destes, com uma ligação equivalente ativa na mesma turma | 65 |
| Vínculos turma–matriz cuja versão curricular aponta para **outro ano letivo UUID** | 486 |
| Destes, com a matriz inativa | 50 |

**Cuidado com agregações:** as 309 linhas inativas têm correspondentes ativos quando se ignora o ano; **isso não significa que haja uma versão ativa no mesmo ano**. Há 218 combinações sem linha ativa no respetivo ano. O estado `published` no currículo e o `ativo=false` da linha coexistem em 218 registos; por isso, nenhuma equivalência automática entre esses campos é válida.

Dos 146 vínculos para linhas inativas, os 146 estão em turmas de **2025** (ano registado como inativo); 96 usam currículo de 2025 e 50 apontam para um currículo de 2026. Os restantes desvios de ano, entre as 486 associações, incluem 275 ligações currículo 2025 → turma 2026 e 161 ligações currículo 2026 → turma 2025 em linhas ativas. **São ocorrências a investigar, não instruções para reescrever FKs.**

## Contrato de experiência

- **Disciplina:** apresentar uma única secção “Matriz curricular”, respeitando ano, currículo e versão. Não expor `curriculoHistorico` como uma segunda lista visível. A presença de uma disciplina no catálogo, numa matriz, numa turma e na carga docente são evidências distintas.
- **Curso e Classe:** usar o mesmo ano/versionamento como escopo das métricas e vínculos; classe reutilizada noutro ano não apaga as turmas válidas do ano selecionado.
- **Turma:** priorizar alunos, disciplinas e docentes do ano selecionado. Um vínculo real para linha inativa/versão divergente continua consultável; a interface mostra uma mensagem contextual de “vínculo a verificar”, sem tratar o professor como ausente.
- **Professor:** vínculos históricos permanecem rastreáveis mesmo com perfil desativado ou indisponível; ausência de identidade não equivale à inexistência da atribuição.
- **Resultados incompletos:** contagens parciais continuam explicitamente parciais. Nunca usar lista truncada para afirmar inexistência de matriz, professor, turma ou aluno.

## Política de resolução do currículo — proposta a validar antes de codar

1. Autenticar, autorizar papel e escola; resolver o `ano_letivo_id` do contexto.
2. Resolver `curso_curriculos` para a **mesma escola, curso, classe (quando aplicável) e ano letivo**. Verificar `status`, `version` e multiplicidade antes de escolher uma versão. **Não** assumir que `MAX(version)` é o currículo correto se existirem vários `published`; essa regra requer contrato explícito e teste com o banco instalado.
3. Ler `curso_matriz` via `curso_curriculo_id` da versão determinada, sem misturar linhas de outros currículos/anos. Para a operação vigente, interpretar o `ativo` da linha no contexto da versão; para consulta histórica, preservar a proveniência e não assumir fotografia temporal imutável.
4. Relacionar Turma/Professor/Disciplina somente com provas de `escola_id`, `ano_letivo_id`, IDs canónicos e vínculo efetivo. Se a FK da turma aponta para matriz de outro ano, **manter o vínculo e sinalizar inconsistência para auditoria**; não apresentá-lo como cobertura comprovada do ano solicitado.
5. Manter o resultado `limitado/parcial` enquanto houver truncamento ou fontes não reconciliadas. Falta de perfil docente apenas altera a identificação exibida, não a evidência do vínculo.

## Implementação pendente (PR #261)

A base atual da PR #261 ainda compõe `curriculo` e `curriculoHistorico` a partir de `curso_matriz.ativo` e mostra uma secção inativa na vista de Disciplina. **Esse comportamento está supersedido por esta decisão, mas não foi removido neste commit documental.**

- **EX-006 (reorientar):** adaptar API, compositor, tipos e vista Disciplina ao escopo `curso_curriculos` + ano letivo + versão. Remover a lista operacional de matrizes inativas; manter proveniência para gestão/auditoria. Não apagar dados.
- **EX-005/EX-010:** aplicar a mesma regra a Curso/Classe e à cobertura por turma, sem quebrar a reutilização de classes.
- **Auditoria de vínculos entre anos:** investigar 486 ligações com matriz curricular de ano diferente, segmentadas por escola, ano e estado, em ambiente controlado; definir se são legados válidos ou relações inconsistentes antes de qualquer correção.
- **Testes obrigatórios:** matrizes de 2025 vs 2026 com mesma combinação; dois currículos/versões no mesmo ano; `published` com linha `ativo=false`; currículo `archived`; turmas com vínculo a matriz de ano distinto; identidade docente ausente; truncagem; escola A/B e RLS; navegação histórica autenticada.
- **Gates:** testes unitários + integração de contrato + CI + smoke autenticado. Não promover a PR nem publicar até substituir a semântica antiga e validar com os dados atuais.

## Não objetivos

- Criar uma nova tabela ou um sistema paralelo de histórico curricular.
- Tratar `ativo=false` como exclusão de disciplina, de aluno, de docente ou de prova histórica.
- Migrar/reapontar automaticamente qualquer uma das 486 associações.
- Corrigir dados diretamente em produção como consequência desta decisão.

**Relação com a documentação anterior:** esta decisão prevalece sobre a proposta de duas listas `curriculo`/`curriculoHistorico` descrita no README da fundação. O README deve apontar para esta decisão enquanto a implementação é reconciliada.
