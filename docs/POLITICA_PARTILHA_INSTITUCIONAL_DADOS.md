# Política de Partilha Institucional de Dados — KLASSE

> **Estado:** proposta arquitetural do sprint DATA-INT  
> **Data:** 2026-10-04  
> **Escopo:** partilha externa de dados e indicadores com MED, UNICEF, parceiros institucionais ou outros terceiros.

## 1. Princípio

O uso do KLASSE por uma escola **não autoriza automaticamente a partilha externa dos seus dados**.

A partilha institucional deve ser uma capacidade separada, controlada e auditável. Por padrão, permanece **desativada**.

Fluxo canónico:

```text
dados operacionais da escola
→ indicador/extração autorizável
→ finalidade + destinatário + escopo
→ base jurídica/autorizações aplicáveis
→ minimização/agregação
→ transmissão
→ registo imutável da partilha
```

A autorização da escola não substitui consentimento do titular, representante legal, obrigação legal ou outra base jurídica que seja exigida para o tratamento concreto.

## 2. Níveis de utilização

### Nível 1 — Uso interno

Dados utilizados para os processos normais do KLASSE: matrícula, frequência, avaliação, financeiro, documentos, comunicação e gestão escolar.

O tratamento segue os contratos, permissões, isolamento multi-tenant e bases jurídicas aplicáveis.

### Nível 2 — Indicadores agregados

Dados estatísticos minimizados, preferencialmente anonimizados, como:
- número de alunos ativos;
- frequência média;
- matrículas por estado;
- percentagem de notas lançadas;
- indicadores financeiros agregados;
- documentos emitidos;
- outros indicadores institucionais aprovados.

Nenhum agregado deve permitir reidentificação razoável de aluno, encarregado, professor ou outro titular.

### Nível 3 — Dados individualizados

Inclui nome, número de processo, contacto, notas individuais, frequência individual, informação financeira individual ou outros dados pessoais.

Este nível exige tratamento reforçado e não pode ser liberado apenas por uma opção genérica de partilha. Devem ser determinados finalidade, destinatário, escopo, base jurídica e requisitos adicionais aplicáveis, especialmente quando envolver menores.

## 3. Modelo de autorização

Toda autorização de partilha deve registrar, no mínimo:

- `escola_id`;
- responsável que autorizou;
- destinatário;
- finalidade específica;
- categorias de dados;
- nível de agregação;
- período abrangido;
- base jurídica declarada/a validar;
- data de início;
- data de expiração, quando aplicável;
- estado: `draft | active | suspended | revoked | expired`;
- versão do contrato/schema autorizado.

Não existe autorização global implícita para “partilhar dados com parceiros”.

## 4. Fail closed

Na ausência de autorização válida ou de base jurídica configurada para o fluxo, **nenhuma transmissão externa acontece**.

Revogar ou suspender uma autorização bloqueia novas transmissões. A revogação não apaga automaticamente evidência histórica legítima de transmissões já realizadas.

## 5. Minimização

A exportação deve utilizar o menor conjunto de dados necessário para a finalidade declarada.

Preferência:

```text
agregado anónimo
> pseudonimizado
> individualizado
```

Dados individualizados só são utilizados quando a finalidade não puder ser cumprida adequadamente com dados menos identificáveis e houver base jurídica válida.

## 6. Menores

Dados de alunos menores recebem proteção reforçada.

O KLASSE não presume que a autorização administrativa da escola seja suficiente para qualquer partilha de dados pessoais de menores. Antes de habilitar um fluxo individualizado devem ser validados os requisitos legais, contratuais e, quando aplicável, consentimento do encarregado/representante legal.

## 7. Registo de Partilha de Dados

Cada transmissão externa deve produzir evidência append-only contendo, no mínimo:

- autorização utilizada;
- escola;
- destinatário;
- finalidade;
- instante da transmissão;
- schema/versão;
- categorias e campos transmitidos;
- quantidade de registos;
- nível de agregação;
- resultado da transmissão;
- identificador técnico da operação;
- ator/sistema responsável.

Segredos, tokens e payloads pessoais completos não devem ser copiados para logs.

A escola deve conseguir consultar **o que foi partilhado, com quem, para quê e quando**.

## 8. Segurança e multi-tenant

- `escola_id` é obrigatório em todo boundary interno de autorização;
- nenhuma autorização de uma escola concede acesso a outra;
- RLS continua obrigatória onde aplicável;
- autorização server-side independente da interface;
- nenhum cliente acessa diretamente MVs/tabelas internas para exportação;
- jobs de exportação usam escopo mínimo;
- transmissões são idempotentes e auditáveis;
- falhas não podem causar fallback para dataset mais amplo.

## 9. Interoperabilidade

DATA-INT-006 deve definir contratos de exportação versionados (ex.: CSV/JSON), mas **não abrir API pública externa neste sprint**.

Qualquer futura integração MED/UNICEF/parceiro deverá passar por:
1. validação institucional/jurídica;
2. definição de finalidade;
3. definição de dataset mínimo;
4. autorização/base jurídica aplicável;
5. teste de isolamento e reidentificação;
6. aprovação explícita para produção.

## 10. Requisitos de produto

A futura interface de partilha institucional deve mostrar claramente:
- estado global da partilha: desativada/ativa;
- destinatário;
- finalidade;
- dados autorizados;
- período;
- responsável pela autorização;
- última transmissão;
- histórico;
- ação de suspender/revogar quando juridicamente aplicável.

Não usar apenas uma checkbox genérica “Aceito partilhar os meus dados”.

## 11. Requisitos para DATA-INT

Este documento passa a ser restrição arquitetural para:
- DATA-INT-001: classificar sensibilidade e possibilidade de partilha de cada fonte;
- DATA-INT-002: privilegiar agregados que reduzam risco de reidentificação;
- DATA-INT-003: incluir proveniência e qualidade;
- DATA-INT-004: manter boundary institucional privado e autorizado;
- DATA-INT-005: métricas de piloto permanecem tenant-scoped;
- DATA-INT-006: incorporar autorização, minimização, versionamento e auditoria;
- DATA-INT-007: testar fail-closed, revogação, cross-tenant e ausência de autorização.

## 12. Gate jurídico

Este documento define arquitetura e política de produto; **não constitui parecer jurídico nem certifica conformidade**.

Antes de ativar partilha externa real, o KLASSE deve validar a base jurídica aplicável em Angola, os requisitos da Agência de Protecção de Dados e as regras específicas do destinatário e da categoria de dados envolvida.
