# Validação UI existente — KLASSE Formação

Data: 2026-04-08
Escopo auditado:
- `apps/web/src/app/(formacao-backoffice)/**`
- `apps/web/src/app/(formacao-formador)/**`
- `apps/web/src/app/(formacao-formando)/**`
- Tokens base em `apps/web/tailwind.config.js`

## 1) Inventário real do que já existe

### Estrutura de layouts
- **Backoffice Formação** com shell lateral dedicado (`BackofficeShell`) e controlo de role no layout.
- **Formador** e **Formando** com layout mínimo (sem sidebar/topbar), apenas `children` dentro de `min-h-screen bg-slate-100 text-sm`.

### Páginas existentes (stubs/placeholder)
- Backoffice: dashboard/cohorts/onboarding e subpáginas de cohort (overview, formandos, sessões, materiais, certificados).
- Formador: honorários (extrato, pendente, recibos).
- Formando: conquistas (badges, perfil público).

### Estado funcional inferido
- A UI de Formação está em **fase inicial**: consistência básica visual, porém baixo nível de densidade funcional (páginas maioritariamente informativas).

## 2) Aderência ao Design System KLASSE (fornecido)

## PASS

1. **Sidebar do backoffice**
   - `w-64` (256px), `bg-slate-950`, active state com `bg-slate-900 + ring-1 ring-klasse-gold/25 + text-klasse-gold`.
   - Alinhado com o token de sidebar.

2. **Iconografia de navegação (Lucide)**
   - Uso de `lucide-react` e ícones com texto (sem ícone isolado no desktop).
   - Tamanho aplicado nos itens (`h-5 w-5` = 20px), alinhado ao token de sidebar.

3. **Base visual enterprise**
   - Cards com `rounded-xl`, `border-slate-200`, `bg-white`, `shadow-sm`.
   - Base tipográfica `text-sm` aparece nos layouts e páginas.

4. **Tokens institucionais definidos no Tailwind**
   - Presença explícita de `klasse.green (#1F6B3B)`, `klasse.gold (#E3B23C)` e `slate.950 (#020617)`.

## GAPS (críticos para evolução)

1. **Cobertura incompleta de UI por persona (Formador/Formando)**
   - Não existe navegação dedicada (sidebar/topbar) para Formador/Formando.
   - Impacto: navegação fragmentada, baixa descobribilidade e inconsistência entre jornadas.

2. **Sem sistema de ações visível nas páginas Formação**
   - Quase não há botões de ação primária/secundária/destrutiva aplicando os tokens definidos.
   - Impacto: não valida na prática o contrato de botões e estados interativos.

3. **Token de foco de inputs (ring-4 gold/20) ainda não demonstrado no módulo Formação**
   - Páginas atuais são majoritariamente estáticas e não exercitam formulários relevantes.
   - Impacto: risco de divergência futura quando fluxos transacionais entrarem.

4. **Sem evidência de grid/padrão de tabela/listagem da Formação**
   - Não há listagens densas com paginação/ordenação/filtros nos caminhos auditados.
   - Impacto: risco de cada feature nova inventar seu próprio padrão.

## 3) Risco técnico (visão cética)

- **Risco de “falso pronto”**: a UI parece consistente porque os ecrãs ainda são simples; quando entrar CRUD real (financeiro/cobrança/faturas/honorários), a aderência ao design system pode quebrar rapidamente.
- **Risco de desalinhamento multi-tenant**: sem componentes padronizados por persona, equipes diferentes podem divergir em navegação e ergonomia.
- **Risco operacional**: o módulo Formação está com boa base visual, mas sem prova de robustez de UX em cenários de carga (tabelas extensas, filtros compostos, estados vazios/erro).

## 4) Veredito objetivo

**Veredito: PARCIALMENTE ADERENTE (MVP UI base OK, produto UI incompleto).**

- Fundamentos visuais: **OK**
- Navegação multi-persona: **INCOMPLETO**
- Interações de negócio (inputs, botões, tabelas, estados): **INCOMPLETO**
- Pronto para escala de feature: **NÃO**

## 5) Próximos passos recomendados (prioridade)

1. Criar `FormadorShell` e `FormandoShell` com o mesmo contrato visual do `BackofficeShell`.
2. Extrair componentes de superfície (`FormacaoPageCard`, `FormacaoSectionHeader`, `FormacaoEmptyState`) para reduzir variação.
3. Definir biblioteca de botões de ação por contexto (Primary/Secondary/Destructive) e aplicar nos fluxos de honorários/cohorts.
4. Introduzir pelo menos 1 tela de listagem real com filtros + paginação + estados loading/empty/error para “provar” padrão.
5. Fechar checklist de acessibilidade mínima (focus visible, contraste, navegação por teclado) antes de expandir módulo financeiro Formação.

## 6) Validação contra o novo requisito operacional (3 vias de entrada)

### Resultado direto (sem rodeios)

**Hoje, no código auditado de Formação, estas 3 vias ainda NÃO existem como fluxos implementados de ponta a ponta.**

Matriz de cobertura:

| Via | Requisito | Estado no código atual | Gap bloqueante |
|---|---|---|---|
| Via A — Balcão | Cadastro rápido + criação Auth + matrícula + fatura no salvar | Não encontrado fluxo de UI/API de admissão Formação com transação completa | Sim |
| Via B — Upload B2B | Upload Excel + loop de criação em lote + email provisório + fatura única empresa | Não encontrado pipeline de importação Formação com faturação B2B agregada | Sim |
| Via C — Self-Service | Link público `.../inscricao/turma-xyz` + onboarding direto ao portal | Não encontrado endpoint/página pública de inscrição Formação | Sim |

## 7) Validação da lógica Presencial vs Online (modality-aware)

### Regra esperada
- `modalidade = presencial` → validar lotação em transação (hard stop ao exceder limite).
- `modalidade = online` → lotação flexível/configurável.
- Outputs distintos por modalidade (comprovativo/sala para presencial; ativação digital para online).

### Estado atual
- **Não há evidência suficiente no módulo Formação UI/API auditado** para confirmar que essa regra já está codificada em backend transacional dedicado de Formação.
- Portanto, assumir que “já está pronto” aqui seria erro de engenharia.

### Risco crítico se implementar sem transação
- Corrida concorrente (dois registos simultâneos ocupam a mesma última vaga).
- Estado parcial (cria Auth mas falha matrícula/fatura).
- Inconsistência entre financeiro e académico.

## 8) Desafio de duplicidade (BI/Passaporte) — validação cética

A tua direção está correta: **unicidade por identificador civil** além do email.

### O que precisa ficar explícito para produção
1. Índice único multi-tenant na entidade de perfil de formando:
   - Chave recomendada: `(escola_id, bi_normalizado)` se a regra for unicidade por escola.
   - Se quiser unicidade global de pessoa em toda a plataforma, usar `bi_normalizado` global + estratégia de vinculação por tenant.
2. Normalização antes de persistir:
   - remover espaços, hífens, pontos, upper-case, prefixos de documento.
3. Fluxo de reuso de identidade:
   - ao colisão de BI: não falhar seco sempre; oferecer “adicionar matrícula nesta turma” com consentimento/auditoria.
4. Guardrails anti-abuso:
   - rate-limit por IP e fingerprint nos fluxos Self-Service.
   - idempotency key em operações de criação (principalmente Via B lote).

## 9) Recomendação de execução (ordem para não quebrar produção)

1. **Backend transacional primeiro (P0)**
   - RPC/Function única por via de entrada para garantir atomicidade: `auth_user + perfil + matricula + faturacao`.
2. **Política de conflito BI (P0)**
   - decidir formalmente: unicidade por escola vs global plataforma.
3. **UI Balcão minimalista (P1)**
   - formulário curto (Nome, BI, Email, Telefone, Curso) + feedback de conflito BI com CTA de reaproveitamento.
4. **Upload B2B (P1)**
   - processamento assíncrono com job id, retries, DLQ lógico e relatório por linha.
5. **Self-Service público (P2)**
   - token de turma assinado, expiração, captcha/rate limit e anti-automação.

## 10) Decisão arquitetural pendente (obrigatória antes de codar)

Sem esta decisão, qualquer implementação fica frágil:

- **Identidade do formando é global (cross-tenant) ou local por escola?**

Se for global, ganhas anti-duplicação real da pessoa; se for local, simplificas isolamento tenant mas aceitas duplicação cross-tenant.
