# KLASSE Intelligence — Direção de Produto

> **Estado:** decisão de produto / arquitetura  
> **Sprint:** DATA-INT  
> **Data:** 2026-10-04

## 1. Tese

O KLASSE deve transformar dados gerados pelos fluxos operacionais da escola em inteligência institucional acionável.

Princípio:

```text
operação
→ evento/dado governado
→ indicador determinístico
→ tendência/benchmark
→ explicação
→ decisão humana
```

O KLASSE calcula os factos. A IA ajuda o utilizador autorizado a compreendê-los. A IA não é SSOT e não altera resultados académicos/financeiros.

## 2. Camadas

### Camada 1 — Operação
Matrícula/rematrícula, alunos, turmas, frequência, avaliação, financeiro/propinas, documentos e comunicação.

### Camada 2 — Inteligência da escola
Radar académico, risco académico explicável, progressão, saúde operacional, evolução longitudinal e impacto do KLASSE.

### Camada 3 — Inteligência da rede
Benchmark anonimizado entre grupos metodologicamente comparáveis.

### Camada 4 — Inteligência institucional
Observatório, investigação e futuras colaborações institucionais. Exige governança, escala, anonimização e base jurídica adequadas.

## 3. Radar Académico

Visão por disciplina, classe e período:

```text
Português      87%  ↑ 4 p.p.
Biologia       81%  ↑ 2 p.p.
Matemática     68%  ↓ 7 p.p.  atenção
Física         61%  ↓ 11 p.p. atenção
Química        76%  →
```

Deve permitir drill-down para cobertura das notas, frequência, turma, período e evolução.

Uma queda não implica causalidade nem culpa do professor. O sistema apresenta evidência e contexto.

## 4. Risco Académico Explicável

Objetivo: identificar sinais precoces antes do resultado final.

Sinais possíveis:
- queda de frequência;
- queda persistente de desempenho;
- avaliações em falta;
- múltiplas disciplinas em deterioração;
- dependências/recurso relevantes;
- outros sinais academicamente validados.

Todo alerta deve informar os fatores que o originaram.

Evitar score opaco produzido por LLM. A primeira versão deve usar regras determinísticas/versionadas. Qualquer modelo estatístico futuro exige validação, monitorização e explicabilidade.

O alerta não reprova, bloqueia ou sanciona aluno automaticamente.

## 5. Progressão Escolar

Indicadores por escola, ano, classe e período, respeitando o lifecycle RAA:

```text
1.240 alunos
1.087 transitaram
61 inscrição condicional
34 recurso
42 retidos
16 concluíram
```

Permitir evolução longitudinal, por exemplo:

```text
Taxa de progressão 2025: 83,1%
Taxa de progressão 2026: 87,7%
Variação: +4,6 p.p.
```

O cálculo não cria estados paralelos: utiliza as autoridades académicas existentes.

## 6. Frequência × Desempenho

O KLASSE pode apresentar associações entre frequência e aproveitamento:

```text
Frequência     Aproveitamento
95–100%        91%
90–94%         84%
80–89%         71%
<80%           48%
```

Regras:
- não apresentar correlação como causalidade;
- exibir tamanho da amostra;
- usar apenas períodos/classes comparáveis;
- respeitar cardinalidade mínima;
- indicar cobertura e `as_of`.

## 7. Saúde Operacional

Cockpit para direção:

```text
Matrículas concluídas       96%
Notas lançadas              91%
Frequências atualizadas     94%
Reconciliação financeira    87%
Documentos pendentes         23
Processos bloqueados          8
```

Cada indicador deve abrir o conjunto operacional que explica o número, respeitando permissões.

O cockpit não deve fazer contagens exatas caras diretamente no cliente. Utilizar camada agregada apropriada conforme ROADMAP.

## 8. Benchmark longitudinal da própria escola

Antes de comparar instituições, priorizar comparação da escola consigo própria:

```text
                     2025   2026
Aproveitamento        73%    81%
Frequência            88%    92%
Inadimplência         21%    14%
Notas no prazo        67%    89%
```

Comparações devem preservar a versão das fórmulas e indicar quando uma mudança metodológica quebra comparabilidade.

## 9. Impacto do KLASSE

Na entrada de uma escola, quando possível, estabelecer baseline para medir impacto em 30/60/90/180 dias.

Possíveis métricas:
- tempo matrícula → ativação;
- pagamento → reconciliação;
- tempo de processos administrativos;
- retrabalho/erros;
- notas entregues no prazo;
- processos manuais pendentes;
- adoção por perfil.

Nunca inventar baseline retroativo. Quando não houver medição anterior confiável, marcar como indisponível.

Esses dados podem sustentar ROI, renovação e estudos de caso, sujeitos às políticas de partilha.

## 10. Observatório KLASSE — hipótese futura

Com massa crítica e governança suficiente, considerar um observatório com dados agregados/anonimizados das escolas participantes.

Possíveis temas:
- aproveitamento por disciplina;
- progressão;
- frequência;
- distribuição por classes;
- tendências temporais;
- diferenças regionais quando houver cardinalidade segura.

Não publicar estatísticas que permitam reidentificar escola ou pessoa por combinação de filtros.

O Observatório não faz parte da entrega inicial do DATA-INT e depende de política de participação, base jurídica, revisão metodológica e gates anti-reidentificação.

## 11. Papel da IA

A IA pode responder, sobre indicadores já autorizados:

- O que merece atenção esta semana?
- Quais disciplinas mais pioraram?
- Onde o aproveitamento está abaixo do grupo comparável?
- Quais mudanças acompanharam a queda de desempenho?
- Quais indicadores estão incompletos?

A IA deve:
- receber apenas contexto autorizado;
- citar/identificar indicadores de origem;
- informar período e freshness;
- distinguir associação de causalidade;
- não inventar métricas ausentes;
- não executar ações académicas/financeiras irreversíveis;
- passar por autorização server-side para ferramentas.

## 12. Prioridade de implementação

Núcleo recomendado do KLASSE Intelligence:
1. camada agregada confiável;
2. evolução longitudinal;
3. Radar Académico;
4. Saúde Operacional;
5. baseline/impacto;
6. benchmark privado;
7. risco académico explicável;
8. Observatório somente numa fase posterior.

## 13. Relação com documentos existentes

Esta direção complementa:
- `docs/POLITICA_PARTILHA_INSTITUCIONAL_DADOS.md`;
- `docs/BENCHMARK_APROVEITAMENTO_ACADEMICO.md`;
- contrato canónico de matrícula/rematrícula/RAA;
- `agents/ops/ROADMAP.md`.

Em conflito, as autoridades de domínio e as regras de segurança/governança prevalecem sobre a camada de inteligência.
