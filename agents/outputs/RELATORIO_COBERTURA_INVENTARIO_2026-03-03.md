# KLASSE — Validação de cobertura do inventário (documentos + progressão)
Data: 2026-03-03  
Escopo validado no código: rotas API secretaria/aluno/admin, prints oficiais, orquestração de fechamento acadêmico e políticas de cobrança.

## Veredito executivo (cético)
Seu inventário base está **desatualizado em pontos críticos**. Hoje a cobertura real está mais madura do que o diagnóstico descreve, especialmente em:  
1) comprovante de matrícula canônico,  
2) boletim trimestral individual,  
3) lote assíncrono server-side para boletim/certificado,  
4) workflow único de fechamento acadêmico com estados, preflight, retry e auditoria.

## Cobertura validada por necessidade

| Necessidade | Status validado agora | Evidência objetiva | Observação cética |
|---|---|---|---|
|| Boletim/comprovante de matrícula no ato | **COBERTO** | Autoemissão implementada na conversão/confirmação (`admisso es/convert`, `matriculas/massa`, `matriculas/massa/por-turma`) usando helper dedicado + auditoria (`COMPROVANTE_MATRICULA_AUTOEMITIDO` / `COMPROVANTE_MATRICULA_REUTILIZADO`). Print oficial dedicado permanece ativo. | Governança agora é operacional (quando habilitar/monitorar), não ausência técnica. |
| Boletim trimestral individual por aluno | **COBERTO** | `boletim_trimestral` é tipo oficial de emissão e existe print próprio. Além disso, a rota de notas aponta para o mesmo print, unificando semântica. | O risco aqui deixa de ser “feature ausente” e vira “consistência de template/assinatura legal”. |
| Boletim por turma / lote | **COBERTO (server-side assíncrono)** | `documentos-oficiais/lote` aceita `boletim_trimestral` e `certificado`; função Inngest gera PDFs, ZIP, checksum, manifest, status e retry/cancel/download. | Inventário antigo dizia client-loop; isso já foi superado no backend. |
| Declaração sem nota (frequência) individual | **COBERTO** | Emissão canônica contempla `declaracao_frequencia` e há print de frequência por documento. | Sem backlog funcional crítico aqui. |
| Pauta trimestral turma/lote | **COBERTO** | Rotas de pauta por turma + lote assíncrono com `pautas_lote_jobs` e processamento dedicado. | Continua sendo fluxo mais robusto. |
| Progressão ano acadêmico e fechamento trimestral sem perder histórico | **COBERTO (com ressalvas operacionais)** | Endpoint `fechamento-academico` orquestra preflight, fechamento, finalização, geração de histórico, lock legal, abertura do próximo ciclo e trilha de passos/job; wizard operacional já está ligado ao backend. | Já existe workflow único; o risco é SLA/observabilidade e UX de operação em escala. |
| Endpoint legado de declaração por matrícula | **COBERTO via compat layer (não 501)** | Endpoint legado responde, emite documento, e retorna headers de depreciação + successor endpoint. | Não está indisponível; está em sunset controlado. |
| Políticas de cobrança (mensalidades e serviços) | **COBERTO** | Portal admin salva `financeiro_tabelas` (tabelas de preço) e `servicos_escola` (catálogo). Mensalidades geradas agora guardam `tabela_id` para rastreio. | Rastreabilidade agora está em nível de mensalidade; auditoria de alterações ainda depende de logs. |

## Backlogs reais (repriorizados)

### P0 — Operação e confiabilidade (não feature-gap)
1. **Runbook executável + guardrails de sequência no fechamento**  
   Wizard e backend já existem; falta playbook de produção (pré-condições, rollback operacional, janela de manutenção, ownership por etapa).
2. **SLO/SLA e alertas para jobs críticos** (`fechamento_academico_jobs` e `pautas_lote_jobs`)  
   Falta contrato de tempo de execução e alerting proativo para “stuck jobs”.
3. **Rastreio de políticas de cobrança em mensalidades já existentes**  
   Nova coluna `tabela_id` cobre mensalidades futuras; falta backfill opcional para histórico se exigido.

### P1 — Escala e UX operacional
4. **Painel único de operações acadêmicas**  
   Consolidar status de fechamento + lotes oficiais + pendências numa visão única para secretaria/admin.
5. **Reprocessamento seletivo assistido por causa raiz**  
   Hoje há retry; faltam “recipes” de recuperação por classe de erro (dados faltantes, lock, permissões, storage).
6. **Padronização jurídica/branding dos PDFs**  
   Garantir assinatura, vocabulário, metadados e versão documental entre comprovante, boletim e certificado.

## Atualizações recentes
- Runbook operacional de fechamento acadêmico publicado em `docs/academico/runbook-fechamento-academico.md`.
- Link do runbook exposto no painel de fechamento e atalhos do admin.
- Painel único de operações acadêmicas exposto no admin via `/admin/operacoes-academicas` (reuso da secretaria).

### P2 — Governança e auditoria avançada
7. **Métricas históricas de ciclo acadêmico**  
   Lead time por etapa, taxa de falha por turma, reincidência por tipo de erro.
8. **Política formal de reabertura de snapshot legal**  
   Já existe suporte técnico para lock/reabertura auditada; falta política de negócio documentada (quem aprova, quando, evidências).
9. **Contratos públicos de API legada em sunset**  
   Publicar cronograma de descontinuação + telemetria de consumo para desligamento seguro.

## Conclusão direta
- Fundação técnica está **mais perto de 85-90%** para esse domínio (não 70%).  
- O backlog mais importante agora é **disciplina operacional**, não criação de endpoints novos.  
- Se você tratar isso como “falta de feature”, vai investir errado; o gargalo está em **confiabilidade, automação e governança de execução**.
