# Resumo da Sessão — Onboarding, Currículo e Horários

Data: 2026-07-03

## Objetivo

Reduzir fricção no onboarding académico para que a escola consiga sair do setup com:

- currículo publicado,
- turmas base geradas,
- horário base publicado quando possível,
- correções guiadas na própria UI,
- sem bloqueios duros por carga horária incompleta.

## Diagnóstico inicial

Foi validado no código e no PostgreSQL que:

- os presets curriculares existem e têm `weekly_hours` gravado;
- o gerador de horários de `auto-resolve` não respeitava `weekly_hours`;
- ele apenas preenchia slots em round-robin para limpar bloqueios de readiness;
- a publicação do quadro era travada pela API quando a carga horária não batia exatamente;
- a UI também bloqueava o botão de publicar quando faltava carga.

Conclusão prática:

- o sistema já conseguia “limpar alertas”;
- mas ainda impedia operação em vez de permitir avanço com correção rápida.

## Mudanças implementadas

### 1. Publicação do quadro ficou permissiva

Arquivo:

- `apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts`

Mudança:

- a API deixou de retornar `400 CARGA_HORARIA_INCOMPLETA` ao publicar;
- agora publica mesmo com carga faltante ou divergente;
- devolve `warnings` estruturados:
  - `CARGA_HORARIA_MISSING`
  - `CARGA_HORARIA_MISMATCH`

Resultado:

- o quadro pode ser publicado para destravar a escola;
- as pendências continuam visíveis, mas não impedem operação inicial.

### 2. UI do quadro deixou de bloquear publicação

Arquivo:

- `apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx`

Mudança:

- o botão de publicar deixou de depender de `missingLoadCount === 0`;
- o aviso de carga faltante foi rebaixado para orientação;
- ao publicar com pendências, a UI mostra toast de “publicado com pendências”.

Resultado:

- o usuário avança;
- o sistema comunica claramente o que ainda precisa de ajuste.

### 3. Correção de carga na própria tela do quadro

Arquivo:

- `apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx`

Mudança:

- o banner de disciplinas sem carga passou a:
  - listar disciplinas afetadas;
  - sugerir a carga padrão do preset (`MED`) quando disponível;
  - permitir `Usar MED Xh`;
  - permitir `Editar` para abrir o modal já focado na disciplina;
  - permitir `Preencher em lote`.

Também foi reaproveitado o modal já existente:

- `DisciplinaModal`

Resultado:

- a correção de carga passou a acontecer sem sair da tela;
- o fluxo ficou orientado por ação rápida, não por navegação manual.

### 4. Corrigir carga já redistribui o quadro

Arquivo:

- `apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx`

Mudança:

- após `Usar MED Xh`, o sistema já roda auto-completar;
- após `Preencher e redistribuir`, o sistema corrige cargas e já refaz o grid;
- a redistribuição é salva como draft automaticamente.

Resultado:

- o usuário não precisa corrigir carga e depois ir manualmente redistribuir;
- a experiência virou “corrigir e continuar”.

### 5. Finalização do onboarding ficou operacional

Arquivo:

- `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts`

Mudança:

O `finalize` passou a orquestrar também:

- auto-atribuição de professores;
- auto-configuração de cargas faltantes;
- criação de slots padrão quando ausentes;
- publicação de um horário base por turma quando possível.

O endpoint agora devolve `summary` com:

- currículos publicados;
- cursos processados;
- turmas planeadas;
- professores auto-atribuídos;
- cargas auto-corrigidas;
- horários publicados;
- horários pendentes;
- turmas com horário publicado;
- turmas com pendência;
- ações recomendadas;
- próximos passos.

Resultado:

- o onboarding passou a tentar deixar a escola operacional de fato, não só “configurada”.

### 6. Auto-gerador passou a respeitar melhor `weekly_hours`

Arquivos:

- `apps/web/src/lib/horarios/buildBaseHorarioAssignments.ts`
- `apps/web/src/app/api/escola/[id]/admin/setup/auto-resolve/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts`

Mudança:

- foi criado um helper compartilhado para montar o horário base;
- ele passou a distribuir slots priorizando `carga_horaria_semanal` / `weekly_hours`;
- o `auto-resolve` deixou de usar round-robin puro;
- o `finalize` do onboarding passou a publicar horários usando a mesma lógica.

Resultado:

- disciplinas com maior carga ocupam mais tempos no quadro base;
- a distribuição ficou mais próxima do esperado curricularmente;
- o sistema continua permissivo quando a capacidade semanal não comporta tudo.

### 7. Blocos duplos e disciplinas práticas ficaram melhores

Arquivos:

- `apps/web/src/lib/horarios/buildBaseHorarioAssignments.ts`
- `apps/web/src/app/api/escola/[id]/admin/setup/auto-resolve/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts`

Mudança:

- o helper passou a considerar metadados leves por disciplina:
  - `requiresDouble`
  - `isPractical`
- disciplinas práticas e/ou com carga maior passaram a tentar ocupar pares consecutivos no mesmo dia;
- quando não há espaço para o bloco, o sistema cai para distribuição normal.

Resultado:

- horários base de laboratório/oficina/prática ficaram mais úteis;
- disciplinas mais pesadas têm mais chance de sair agrupadas em blocos coerentes;
- isso melhorou o quadro inicial sem transformar o fluxo em algo rígido ou bloqueante.

### 8. Tela final do onboarding virou resumo real

Arquivo:

- `apps/web/src/components/escola/onboarding/AcademicSetupWizard.tsx`

Mudança:

- o passo final deixou de redirecionar automaticamente em 2 segundos;
- ao concluir, o usuário vê:
  - resumo de currículos publicados;
  - total de turmas planeadas;
  - horários publicados e pendentes;
  - auto-ajustes aplicados;
  - links rápidos para editar depois;
  - passo a passo curto de alterações;
  - pendências restantes com CTA de correção.

Atalhos incluídos:

- Calendário
- Turmas e currículo
- Quadro de horários
- Dashboard

Resultado:

- a escola sai do onboarding com visão clara do que já está pronto;
- ajustes posteriores ficaram explícitos e fáceis de encontrar.

### 9. Setup Académico com "Zero Cliques" (Preset Herdado do CRM)

Mudança:
- A coluna `curriculum_preset` foi adicionada a `crm_leads` e `onboarding_requests` para carregar o modelo de ensino selecionado pelo parceiro comercial no portal de influencers.
- Os endpoints de provisionamento do super-admin (`provision/route.ts` e `create-and-provision/route.ts`) passam a ler este preset do onboarding e realizar a instalação/publicação de disciplinas automaticamente no provisionamento.
- A página de proposta em PDF renderiza o Modelo de Ensino escolhido de forma formatada e legível.

Resultado:
- A escola já nasce com currículo instalado e ativo no primeiro login do admin.

### 10. Provisionamento Automático de Contas Organizacionais Chave

Mudança:
- Colunas para níveis de ensino e 3 contatos organizacionais (Secretaria Geral, Diretoria Financeira e Coordenação Pedagógica) adicionadas ao CRM Leads e Onboarding Requests.
- UI do Drawer do Lead adaptada com checkboxes para níveis e campos de nome/e-mail/telefone para os 3 contatos.
- Preview da proposta em PDF renderiza esses contatos e níveis de forma formal.
- RPCs e APIs ajustadas para salvar, propagar e chamar `ensureStaffUser` no provisionamento, criando e convidando os respectivos usuários automaticamente.

Resultado:
- Os diretores, secretários e administradores financeiros recebem suas credenciais e links de acesso autodeclarados no e-mail logo ao provisionar a escola, poupando setup manual de equipe.

### 11. Remoção Completa do Envio de Documentos Legais

Mudança:
- A etapa `docs_legais` (Envio de documentos legais) foi completamente removida do fluxo de onboarding para evitar burocracia e acelerar a ativação da escola.
- A função de ordenação `onboarding_step_sort_order` foi redefinida no PostgreSQL para ordenar apenas as 6 etapas críticas: `diagnostico` -> `planilhas` -> `validacao` -> `config` -> `treinamento` -> `live`.
- A RPC `seed_onboarding_steps_v2` foi redefinida para excluir o registro de `docs_legais` de todas as requisições de onboarding ativas e atualizar a validação técnica (`validacao`) para depender apenas de planilhas (`planilhas`).
- O dicionário `STEP_META` nos arquivos do portal de acompanhamento e portal do parceiro foi ajustado para remover `docs_legais`.

Resultado:
- A jornada de onboarding é simplificada de 7 para 6 etapas, eliminando o bloqueio por documentação burocrática inicial e permitindo o go-live focado na experiência de uso imediato do sistema.

### 12. Checklist de Implantação Automatizado por Consultas de Banco (Checks Reais)

Mudança:
- A verificação técnica da checklist foi transformada em **checagens automatizadas no banco de dados**, eliminando marcações manuais falsas.
- Criada a função `get_real_school_implantation_checklist(p_escola_id)` no PostgreSQL, que verifica em tempo real:
  - **Acesso da Equipa:** Existência de perfis administrativos vinculados (`escola_users`).
  - **Currículo:** Existência de currículo publicado (`curso_curriculos`).
  - **Turmas:** Presença de registros na tabela `turmas`.
  - **Disciplinas/Pautas:** Vinculação ativa na tabela `turma_disciplinas`.
  - **Alunos:** Existência de matrículas ativas (`matriculas`).
  - **Financeiro:** Presença de tabelas financeiras de propinas (`financeiro_tabelas`).
- Os 3 itens humanos e operacionais (**Formação da Secretaria, Formação de Docentes e Sistema em Operação**) continuam com marcação manual do operador.
- Redefinidas as RPCs `update_influencer_onboarding_implantation_checklist` e `get_afiliado_member_portal` para consolidar o estado real e o manual dinamicamente.
- No frontend, os checkboxes dos itens automáticos são desabilitados para clique e ganham o selo **"Sistema"**, impedindo fraudes.

Resultado:
- A homologação técnica é 100% verídica e depende de ações concretas executadas no sistema, garantindo um processo de auditoria seguro e de alta qualidade.

## Arquivos alterados

- `apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts`
- `apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx`
- `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts`
- `apps/web/src/components/escola/onboarding/AcademicSetupWizard.tsx`
- `agents/outputs/APPLY_DIFF_20260703_HORARIO_PUBLISH_SOFT_GATE.md`
- `apps/web/src/app/api/super-admin/onboarding/[id]/provision/route.ts`
- `apps/web/src/app/api/super-admin/onboarding/[id]/create-and-provision/route.ts`
- `apps/web/src/app/crm/proposta/preview/page.tsx`
- `apps/web/src/app/influencers/[codigo]/_components/CrmLeadDetailsSheet.tsx`
- `apps/web/src/app/influencers/[codigo]/page.tsx`
- `apps/web/src/app/api/influencers/[codigo]/crm/leads/[leadId]/commercial/route.ts`
- `apps/web/src/app/influencers/[codigo]/_components/partner-dashboard-model.ts`
- `apps/web/src/lib/escolas/create-school.ts`
- `apps/web/src/app/onboarding/acompanhar/[token]/page.tsx`
- `apps/web/src/app/influencers/[codigo]/_components/OnboardingSchoolDetailsSheet.tsx`
- `apps/web/src/app/influencers/[codigo]/_components/Escola360TabContent.tsx`
- `supabase/migrations/20270702150000_add_curriculum_preset_to_onboarding.sql`
- `supabase/migrations/20270703120000_add_organization_contacts_to_onboarding.sql`
- `supabase/migrations/20270703130000_bypass_legal_documents_blocking_onboarding.sql`
- `supabase/migrations/20270703140000_optimize_implantation_checklist_items.sql`
- `supabase/migrations/20270703150000_make_onboarding_checklist_live_db_checks.sql`

## Verificações executadas

Executado com sucesso:

- `pnpm -C apps/web exec tsc --noEmit --pretty false`

Executado com warnings antigos, sem erros novos:

- `pnpm -C apps/web exec eslint ...`

Observação:

- os warnings restantes eram principalmente `no-explicit-any` e imports/vars não usados já existentes no código.

## Comportamento final esperado

Depois desta sessão, o fluxo esperado é:

1. A escola termina o onboarding académico.
2. O backend publica currículo, gera turmas e tenta deixar o horário base publicado.
3. Se faltarem cargas, a UI permite corrigir em 1 clique com base no preset.
4. Ao corrigir carga, o quadro redistribui automaticamente.
5. O horário base tenta respeitar melhor a carga semanal e formar blocos práticos quando fizer sentido.
6. O usuário termina vendo um resumo final com próximos passos e links de edição.

## Limitações atuais

- o gerador de horário base ainda não faz distribuição precisa por carga horária ideal;
- ele melhorou bastante, mas continua abaixo do gerador completo/manual;
- ele continua priorizando um quadro publicável/base operacional;
- quando a estrutura da escola é incompleta demais, o resumo final mostra pendências em vez de bloquear.

## Direção recomendada para continuação

Próximos incrementos naturais:

1. Fazer o auto-gerador respeitar melhor `weekly_hours` por disciplina.
2. Melhorar a lógica de distribuição para reduzir divergências já no primeiro publish.
3. Exibir no resumo final quais disciplinas/turmas ficaram fora do padrão ideal.
4. Adicionar reexecução guiada do horário base diretamente do resumo final do onboarding.
