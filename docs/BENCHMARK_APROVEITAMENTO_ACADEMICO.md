# Benchmark de Aproveitamento Académico — KLASSE

> **Estado:** decisão de produto / arquitetura  
> **Sprint:** DATA-INT  
> **Data:** 2026-10-04  
> **Objetivo:** permitir comparação pedagógica útil entre escolas sem reduzir qualidade escolar a um ranking simplista.

## 1. Decisão

O KLASSE deve evoluir para oferecer **benchmark de aproveitamento académico**, inicialmente privado e agregado.

O produto **não deve lançar, nesta fase, um ranking público de “melhores escolas”** baseado apenas em taxa de aprovação.

A razão é metodológica: aprovação isolada não é medida suficiente de qualidade. Diferenças de currículo, classe, política de avaliação, cobertura das notas, dimensão da amostra e contexto operacional podem tornar comparações diretas enganosas e criar incentivos para inflação de notas.

## 2. Unidade mínima de comparação

A comparação deve ocorrer, no mínimo, por:

- disciplina;
- classe/nível;
- período académico;
- regime/currículo compatível;
- estado de publicação/fecho da avaliação;
- cobertura mínima dos resultados.

Quando esses critérios não forem satisfeitos, o KLASSE deve marcar o indicador como **não comparável** em vez de produzir uma classificação artificial.

## 3. Métrica base

Exemplo:

```text
Matemática — 10.ª Classe
Alunos avaliados: 184
Aprovados: 151
Aproveitamento: 82,1%
Cobertura das notas: 100%
Período: Ano letivo 2026
```

A fórmula, denominador, tratamento de faltas, recurso, extraordinário, dependências e demais estados académicos devem ser definidos pelo contrato académico/RAA. O benchmark não cria uma segunda autoridade sobre resultados.

## 4. Experiência inicial

A escola identifica apenas a si própria. As demais escolas compõem grupos agregados de referência.

Exemplo:

```text
MATEMÁTICA — 10.ª CLASSE

Sua escola                     78%
Grupo comparável               72%
Faixa de referência          68–76%

Diferença vs grupo          +6 p.p.
Variação vs período anterior -3 p.p.
```

Pode haver decomposição por disciplina e classe:

```text
Matemática
├── 7.ª classe   83%
├── 8.ª classe   79%
├── 9.ª classe   74%
└── 10.ª classe  78%

Física          69%
Química         76%
Português       88%
```

## 5. Grupo comparável

O KLASSE não deve comparar indiscriminadamente todas as escolas.

O grupo de referência deve considerar dimensões disponíveis e metodologicamente justificadas, como:
- classe/nível;
- disciplina;
- período;
- currículo/regime;
- tipo/perfil operacional da escola quando relevante;
- cobertura dos dados;
- dimensão mínima da amostra.

Não utilizar localização, natureza pública/privada ou outra característica como ajuste de desempenho sem metodologia previamente documentada.

## 6. Qualidade e elegibilidade

Uma escola/indicador só participa do benchmark quando satisfizer gates mínimos.

A implementação deverá definir e testar:
- tamanho mínimo da amostra;
- cobertura mínima de notas;
- resultados publicados/fechados;
- ausência de inconsistências críticas;
- janela temporal equivalente;
- versão compatível da regra académica;
- freshness/`as_of`.

Dados incompletos devem reduzir confiança ou excluir o indicador da comparação; nunca devem ser silenciosamente tratados como zero.

## 7. Proteção contra incentivos perversos

O benchmark não pode incentivar aprovação artificial.

Por isso:
- taxa de aprovação não será apresentada como sinónimo de “qualidade”;
- o KLASSE deverá permitir leitura conjunta com frequência, distribuição de resultados, cobertura e evolução temporal;
- alterações retroativas relevantes permanecem auditáveis;
- resultados dependem do SSOT académico e do lifecycle RAA;
- não existe edição manual do benchmark;
- o cálculo é determinístico e server-side.

## 8. Privacidade

No benchmark privado:
- a escola vê a própria identidade;
- concorrentes não são identificados;
- grupos de referência devem ter cardinalidade mínima;
- agregados que permitam inferência/reidentificação devem ser suprimidos;
- nenhum aluno, professor ou encarregado é exposto.

A participação e o uso dos dados seguem `docs/POLITICA_PARTILHA_INSTITUCIONAL_DADOS.md`.

## 9. Publicação de ranking identificável

Publicar algo como:

```text
Escola A — 92%
Escola B — 84%
Escola C — 71%
```

é uma capacidade diferente do benchmark privado e fica **fora do escopo deste sprint**.

Qualquer futura publicação identificável exige, antes:
1. metodologia pública e versionada;
2. comparabilidade demonstrável;
3. amostra e cobertura mínimas;
4. mecanismos anti-manipulação;
5. autorização/base jurídica aplicável;
6. política de contestação/correção;
7. período de referência explícito;
8. revisão institucional/jurídica.

Não usar a expressão “melhores escolas de Angola” com base apenas no aproveitamento calculado pelo KLASSE.

## 10. Consultas de inteligência

A camada deve permitir perguntas institucionais como:

- Em quais disciplinas a escola está abaixo do grupo comparável?
- Quais disciplinas mais melhoraram desde o período anterior?
- Onde houve queda de aproveitamento acompanhada de aumento de faltas?
- Em quais classes a cobertura de notas ainda impede comparação?
- Quais indicadores exigem atenção pedagógica?

A IA apenas interpreta indicadores autorizados e calculados deterministicamente. Não calcula nem altera resultados académicos e não recebe acesso irrestrito às tabelas.

## 11. Integração com DATA-INT

### DATA-INT-001
Mapear fontes académicas, SSOT, versão curricular, período e qualidade necessária.

### DATA-INT-002
Adicionar agregações de aproveitamento por disciplina/classe/período e estruturas de grupo comparável.

### DATA-INT-003
Expor `as_of`, cobertura, amostra, qualidade e motivo de não comparabilidade.

### DATA-INT-004
Servir benchmark por boundary server-side tenant-aware.

### DATA-INT-005
Medir evolução longitudinal sem reescrever baseline histórico.

### DATA-INT-006
Tratar qualquer utilização institucional externa como exportação/partilha governada.

### DATA-INT-007
Testar cross-tenant, amostra mínima, dados incompletos, RAA, performance, reidentificação e regressões.

## 12. Resultado esperado

O objetivo não é criar uma tabela de vencedores.

O objetivo é permitir que uma direção responda com evidência:

> “Onde estamos melhor ou pior do que escolas realmente comparáveis, como isso mudou e quais disciplinas precisam de intervenção?”

Esse é o uso do benchmark como **inteligência institucional pedagógica**.
