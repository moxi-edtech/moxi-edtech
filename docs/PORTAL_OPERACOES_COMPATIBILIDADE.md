# Portal Operações — Política de Compatibilidade

Data: 2026-08-01
Status: ativo

## Portal canónico

`/escola/[id]/operacoes/**` é a superfície canónica da operação escolar K12.
O portal reúne as capacidades de Admin, Secretaria e Financeiro sem reduzir a
matriz de permissões das APIs e das páginas de origem.

## Autorização

O layout de Operações valida no servidor:

1. sessão autenticada;
2. resolução da escola solicitada;
3. membership em `escola_users`;
4. papel pertencente a `K12_OPERACOES_ROLE_GROUP`.

Super-admin mantém o bypass já previsto pelo produto. O portal não concede
permissões novas: APIs, RLS e guards das telas reutilizadas continuam sendo a
autoridade para leituras e mutações.

## Financeiro dentro de Operações

O namespace `/operacoes/financeiro/**` é reescrito internamente para as telas
existentes em `/financeiro/**`. A URL visível e o shell permanecem em Operações.
Home e dashboards têm regras específicas para evitar redirects de retorno ao
portal financeiro legado.

## Admin e Secretaria legados

Rotas com equivalência confirmada usam redirect temporário (`307`) para
Operações. São cobertos:

- dashboard;
- alunos, professores, turmas e classes;
- admissões, matrículas e rematrículas;
- operações académicas;
- avisos e comunicação;
- documentos;
- calendário;
- importações e exportações;
- relatórios;
- recebimentos e fecho;
- configurações administrativas.

Não existe redirect wildcard global. Rotas sem equivalente confirmado continuam
no legado até receberem destino e teste próprios, evitando 404 ou mudança de
comportamento silenciosa.

## Regras de evolução

- Novos links internos devem usar `/operacoes/**`.
- Links financeiros contextuais devem normalizar para
  `/operacoes/financeiro/**`.
- Redirects permanecem temporários durante a janela de compatibilidade.
- Um redirect só pode tornar-se permanente após telemetria confirmar ausência de
  consumidores legados relevantes.
- Reexports antigos podem ser removidos apenas depois do redirect equivalente e
  do respetivo gate automatizado.

## Gates obrigatórios

- matriz de papéis permitidos e negados;
- cobertura das superfícies financeiras essenciais;
- preservação de query strings em links contextuais;
- classificação de Operações como contexto K12 no middleware;
- redirects Admin/Secretaria não permanentes;
- typecheck, ESLint direcionado e `git diff --check`.

## Metas de performance

- dashboard operacional: p95 inferior a 200 ms;
- agregações do cockpit: somente MV/view derivada;
- rewrites internos: sem round-trip adicional;
- redirects: apenas em entradas legadas.
