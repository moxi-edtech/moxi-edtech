# KLASSE Impact — Angola School Digital Management Pilot

> **Estado:** proposta de programa / preparação institucional e comercial  
> **Orientação:** duas frentes complementares — impacto institucional e procurement/comercial  
> **Relação:** KLASSE Intelligence / DATA-INT

## 1. Objetivo

Estruturar um programa de piloto e evidência que permita posicionar o KLASSE simultaneamente em duas frentes:

1. **Institucional / Impacto** — demonstrar melhoria mensurável na eficiência administrativa, qualidade dos dados e capacidade de decisão escolar.
2. **Comercial / Procurement** — preparar o KLASSE para participar de oportunidades financiadas por programas de desenvolvimento, diretamente, em consórcio ou como fornecedor/subcontratado.

As duas frentes usam a mesma base técnica e a mesma evidência. Não são dois projetos independentes.

## 2. Princípio de ligação entre as frentes

```text
implementação nas escolas
→ baseline e métricas
→ evidência verificável
→ credibilidade institucional
→ elegibilidade comercial
→ novos contratos/pilotos
→ maior escala de evidência
```

A frente institucional produz prova. A frente comercial transforma essa prova em capacidade de contratação e escala.

## 3. Frente A — Institucional / Impacto

### 3.1 Posicionamento

O KLASSE deve ser apresentado como **infraestrutura digital de gestão escolar adaptada ao contexto angolano**, com capacidade para:

- reduzir processos administrativos manuais;
- melhorar qualidade, completude e atualidade dos dados;
- aumentar rastreabilidade;
- gerar indicadores confiáveis;
- apoiar gestão baseada em evidências;
- preparar interoperabilidade e reporting institucional futuros.

Não posicionar inicialmente o programa como “projeto de IA”. IA é uma camada de interpretação sobre dados autorizados e indicadores determinísticos.

### 3.2 Piloto recomendado

Piloto inicial em 10–20 escolas, sujeito a capacidade operacional e parceria institucional.

Eixos:

- digitalização operacional;
- qualidade e governança de dados;
- gestão baseada em evidências;
- capacitação dos utilizadores;
- avaliação de impacto.

### 3.3 Indicadores de impacto

Medir, quando houver baseline confiável:

- tempo matrícula → ativação;
- tempo pagamento → reconciliação;
- retrabalho/erros administrativos;
- frequência registada no prazo;
- notas/avaliações completas no prazo;
- disponibilidade de indicadores;
- tempo para produzir relatórios;
- utilização por perfil;
- resolução de pendências;
- qualidade/completude dos dados.

Sem baseline confiável, marcar como indisponível. Não reconstruir retroativamente resultados sem evidência.

### 3.4 Evidência e avaliação

Idealmente incluir parceiro académico/avaliador independente para:

- validar metodologia;
- revisar fórmulas;
- acompanhar baseline;
- apoiar análise longitudinal;
- reduzir conflito de interesse;
- aumentar credibilidade institucional.

### 3.5 Governança

Aplicar as regras de:

- `docs/POLITICA_PARTILHA_INSTITUCIONAL_DADOS.md`;
- proteção reforçada de dados de menores;
- minimização;
- autorização específica para partilha;
- trilha de auditoria;
- tenant isolation;
- exposição apenas de indicadores autorizados.

## 4. Frente B — Comercial / Procurement

### 4.1 Objetivo

Preparar a Moxi/KLASSE para responder a oportunidades de contratação associadas a projetos de transformação digital, educação, gestão pública e dados.

### 4.2 Modos de entrada

Possíveis formas:

- fornecedor direto;
- subcontratado de integrador;
- consórcio;
- parceiro tecnológico local;
- fornecedor de SaaS;
- fornecedor de implementação e capacitação;
- fornecedor de dados/reporting/interoperabilidade.

### 4.3 Prontidão documental

Manter pacote atualizado com:

- apresentação institucional;
- descrição técnica do KLASSE;
- arquitetura;
- segurança e isolamento multi-tenant;
- SLA;
- suporte;
- política de privacidade;
- política de eliminação de dados;
- política de partilha institucional;
- matriz de funcionalidades;
- referências/pilotos;
- estudos de caso;
- capacidade de formação;
- CVs/perfis da equipa-chave;
- documentação legal/fiscal da empresa;
- evidência de capacidade operacional.

### 4.4 Prontidão técnica

Requisitos mínimos:

- autenticação e autorização robustas;
- RLS/tenant isolation;
- auditoria;
- APIs versionadas;
- interoperabilidade;
- exportação CSV/JSON quando aplicável;
- observabilidade;
- recuperação de falhas;
- backup e continuidade;
- ambientes de teste/homologação;
- documentação de implantação;
- métricas de disponibilidade e desempenho.

### 4.5 Estratégia de procurement

Para cada oportunidade:

1. identificar entidade implementadora;
2. identificar projeto/programa financiador;
3. ler procurement plan e documentos oficiais;
4. mapear pacote/lote/atividade;
5. definir se entrada é direta, consórcio ou subcontratação;
6. avaliar elegibilidade;
7. preparar resposta técnica e comercial;
8. registrar prazo, estado e responsável;
9. preservar evidência e versão dos documentos enviados.

Não assumir que o Banco Mundial contrata diretamente o KLASSE. Em muitos casos a contratação ocorre pela entidade implementadora nacional.

## 5. Artefactos comuns às duas frentes

Criar e manter:

- one-pager institucional;
- deck de 8–12 slides;
- nota conceptual do piloto;
- teoria de mudança;
- framework de indicadores;
- plano de implementação;
- plano de formação;
- plano de M&E;
- matriz de riscos;
- data governance note;
- arquitetura técnica;
- procurement readiness checklist;
- capability statement;
- estudos de caso;
- proposta comercial modular.

## 6. Workstream A — Institucional / Impacto

Entregáveis:

- IMPACT-001: nota conceptual do piloto;
- IMPACT-002: teoria de mudança;
- IMPACT-003: baseline e indicadores;
- IMPACT-004: protocolo de avaliação;
- IMPACT-005: plano de implementação em escolas;
- IMPACT-006: plano de capacitação;
- IMPACT-007: governança e proteção de dados;
- IMPACT-008: pacote de apresentação institucional.

## 7. Workstream B — Procurement / Comercial

Entregáveis:

- PROC-001: capability statement;
- PROC-002: checklist de elegibilidade documental;
- PROC-003: checklist de prontidão técnica;
- PROC-004: modelo de análise de oportunidade;
- PROC-005: matriz de parceiros/consórcios;
- PROC-006: biblioteca de respostas técnicas;
- PROC-007: modelo de proposta comercial;
- PROC-008: pipeline de oportunidades.

## 8. Critério de sucesso

O programa é considerado pronto quando:

- existe um piloto com metodologia clara;
- métricas de baseline e follow-up estão definidas;
- o KLASSE consegue produzir evidência auditável;
- pacote institucional está pronto para apresentação;
- pacote de procurement está pronto para diligência;
- riscos legais e de dados estão explicitados;
- nenhuma proposta promete integração oficial ou conformidade não verificada;
- oportunidades podem ser avaliadas rapidamente com documentação reutilizável.

## 9. Relação com DATA-INT

DATA-INT fornece a infraestrutura de mensuração.

Em especial:

- DATA-INT-001: inventário/SSOT;
- DATA-INT-002: indicadores agregados;
- DATA-INT-003: proveniência/qualidade;
- DATA-INT-004: API segura;
- DATA-INT-005: baseline de impacto;
- DATA-INT-006: interoperabilidade futura;
- DATA-INT-007: validação/regressão;
- DATA-INT-008/009: benchmark e KLASSE Intelligence.

Sem dados confiáveis, o programa institucional não deve alegar impacto e o programa comercial não deve usar métricas promocionais não demonstradas.

## 10. Próxima decisão

Priorizar em paralelo:

- conclusão da fundação DATA-INT necessária para medição;
- criação do pacote institucional mínimo;
- preparação do procurement readiness checklist;
- identificação de 1–2 potenciais parceiros académicos/institucionais;
- acompanhamento estruturado de oportunidades relevantes.
