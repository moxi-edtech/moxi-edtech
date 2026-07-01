# P4 - Handoff Operacional de Onboarding até o Provisionamento

Versao: 1.0.0
Data: 2026-07-01
Modulo: CRM / Portal Admin / Super Admin
Perfil principal: super_admin / operador (Operações Moxi / KLASSE)

## 1. Objetivo

Definir o procedimento operacional padrão para transição de uma escola desde a conversão comercial até o provisionamento ativo em banco de dados, incluindo a validação de etapas de onboarding, a triagem e o uso de resolutores automatizados de 1-clique para sanar bloqueadores operacionais.

## 2. Quando usar

- Sempre que um novo colégio fechar contrato comercial e for qualificado no CRM.
- Durante a conferência de documentos e planilhas enviados pela escola.
- No momento de rodar o provisionamento final da escola para produção.

## 3. Responsáveis

- **Triagem Preliminar:** Parceiro Comercial (Operador Comercial).
- **Validação e Homologação de Dados:** Equipe de Operações KLASSE (Super-Admin).
- **Provisionamento:** Super-Admin da KLASSE.

## 4. O Fluxo de Onboarding de 7 Etapas

O ciclo de vida do onboarding da escola é composto por 7 etapas sequenciais no banco de dados (`onboarding_steps`), cada uma com seu respectivo responsável:

| Ordem | Código da Etapa | Descrição | Responsável | Ação de Conclusão |
|---|---|---|---|---|
| 1 | `diagnostico` | Diagnóstico Inicial | Parceiro | Concluído automaticamente quando o Lead do CRM é convertido em pedido de onboarding. |
| 2 | `docs_legais` | Envio de Documentos Legais | Escola | Concluído quando a escola anexa e envia o NIF e documentos oficiais. |
| 3 | `planilhas` | Upload de Planilhas | Escola | Concluído quando a escola anexa e envia as planilhas de alunos e professores. |
| 4 | `validacao` | Validação Técnica | **KLASSE** | Concluído após triagem positiva da equipe técnica Moxi/KLASSE sobre a integridade dos dados enviados. |
| 5 | `config` | Configuração Operacional | Parceiro | Parametrização inicial de anos letivos, turmas e matrizes curriculares. |
| 6 | `treinamento` | Treinamento de Equipe | Parceiro | Capacitação da equipe administrativa e docente da instituição. |
| 7 | `live` | Go-Live e Abertura | **KLASSE** | Executado no painel Super-Admin com a criação definitiva das credenciais e banco de produção. |

---

## 5. Passo a Passo do Handoff Técnico

### Fase A: Da Conversão ao Cadastro Preliminar
1. O parceiro qualifica a escola no CRM e clica em **"Converter em Onboarding"** no painel de leads.
2. A etapa `diagnostico` é gerada como `concluido` e a responsabilidade passa à **Escola** para envio de documentação (Passos 2 e 3).
3. A escola acessa o link público de acompanhamento (`/onboarding/acompanhar/[token]`), baixa os modelos Excel oficiais (`.xlsx`) de alunos e professores, e faz o upload dos arquivos.

### Fase B: Triagem de Dados e Validação (KLASSE)
1. O operador comercial analisa preliminarmente os arquivos no Drawer de Detalhes da Escola em **"Arquivos e Staging de Importação"**, classificando as categorias e movendo para `pronto_para_klasse`.
2. A equipe da KLASSE inspeciona a planilha, executa a verificação técnica e aprova os documentos no painel administrativo, marcando a etapa `validacao` como `concluido`.

### Fase C: Setup e Resolução de Bloqueadores Críticos (1-Clique)
Antes de liberar o provisionamento, a escola deve estar operacionalmente pronta. A maturidade é medida por consultas de prontidão em tempo real no banco (`get_school_operational_readiness`).

Se houver bloqueadores, utilize os novos botões assistentes de **Auto-Resolução de 1-Clique** na tela de **Status do Sistema** (`/admin/configuracoes/sistema`):

1. **Atribuição Inconsistente de Professores (`TEACHER_ASSIGNMENT_INCONSISTENCY`):**
   * *Problema:* Existem disciplinas cadastradas sem docente associado.
   * *Solução:* Clique em `⚡ Auto-Atribuir Professores`. O sistema aciona a função remota `auto_assign_school_teachers_by_specialty`, vinculando as matérias aos professores correspondentes por match automático de especialidade/nome.
2. **Quadro de Horários Ausente (`HORARIOS_PUBLISH_MISSING`):**
   * *Problema:* A escola não possui um horário semanal publicado, impedindo aulas e chamadas.
   * *Solução:* Clique em `⚡ Auto-Gerar Horários`. O backend lineariza as cargas horárias ativas, preenche os slots livres correspondentes ao turno da turma e publica a grade de horários instantaneamente.

### Fase D: O Provisionamento Final
1. No painel de Super-Admin (`/super-admin/onboarding`), selecione o pedido de onboarding da escola.
2. Certifique-se de que a mensagem *"Todas as etapas do onboarding estão concluídas. O pedido está elegível para provisionamento"* é exibida.
3. Clique em **"PROVISIONAR ESCOLA"**.
4. O banco executa a RPC `provisionar_escola_from_onboarding`, injeta as configurações de staging diretamente no banco de produção da escola (`public.escolas`), e dispara o provisionamento do administrador local.

---

## 6. Resultados Esperados

- Escola totalmente configurada e ativa na plataforma em produção.
- Zero erros de bloqueio de setup pendentes.
- Transição limpa e rastreável documentada nos logs de auditoria do sistema.
