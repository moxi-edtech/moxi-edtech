# Plano de Evolução V2 — Admissões Inteligentes e Autonómicas

**Data:** 2026-06-11  
**Status:** Proposta (Design Doc)  
**Autor:** Gemini CLI (Senior Staff Engineer Perspective)  
**Escopo:** Automação de Funil, Inteligência Comercial, Escalabilidade Assíncrona

---

## 1. Visão Geral
A V1 resolveu a integridade dos dados e o desacoplamento acadêmico. A V2 foca em transformar o KLASSE de um sistema de registro em um **motor de crescimento**, automatizando a conversão de pré-candidaturas em matrículas efetivas com o mínimo de intervenção humana e o máximo de inteligência comercial.

## 2. Pilares Estratégicos

### 2.1. Motor de Scoring e Priorização (Priority Queue)
Implementar um sistema de pontuação automática para que a secretaria foque nos leads com maior probabilidade de conversão ou maior valor estratégico.

*   **Atributos de Score:**
    *   **Vínculo Familiar (+50 pts):** Irmãos já matriculados (retenção).
    *   **Completude (+20 pts):** Todos os documentos/campos preenchidos no cofre.
    *   **Senioridade (+10 pts):** Antiguidade da pré-candidatura.
    *   **Interação (+15 pts):** Clicou em links de e-mail ou WhatsApp enviados pelo sistema.
*   **Implementação:** Coluna `score` na tabela `candidaturas`, atualizada via Trigger ou Worker em background.

### 2.2. "Shadow Matching" e Previsão de Capacidade
Permitir o planejamento do ano letivo futuro antes mesmo da criação das turmas oficiais.

*   **Turmas Virtuais:** Criação de templates de turmas (ex: "10ª Classe - Manhã - Virtual") para o próximo ano.
*   **Vagas Preditivas:** Um painel de visualização que soma: `Alunos Atuais (Renovação Provável) + Candidaturas Aprovadas + Pré-candidaturas de Alto Score`.
*   **Alerta de Overbooking:** Notificações proativas quando a demanda em uma determinada classe excede a capacidade planejada em 20%.

### 2.3. Ciclo de Engajamento Automatizado (Nurturing)
Reduzir o "esquecimento" do lead durante o período de espera entre a pré-candidatura e a abertura das matrículas.

*   **Self-Service Promotion:** O encarregado recebe um link dinâmico: "As vagas abriram! Clique aqui para promover sua pré-candidatura e pagar a reserva agora."
*   **Integração WhatsApp/Email:** Fluxos automáticos de status:
    *   *T-minus 30 dias:* "Estamos preparando o próximo ano."
    *   *T-minus 7 dias:* "Garanta seus documentos no Cofre."
    *   *Dia D:* "Link de pagamento exclusivo para pré-candidatos."

### 2.4. Deep Analytics e "Funnel Leakage"
Identificar onde a escola está perdendo dinheiro e alunos.

*   **Lost Reasons:** Campo obrigatório ao arquivar/rejeitar uma pré-candidatura (ex: "Preço", "Distância", "Escola Concorrente").
*   **Relatórios Executivos:**
    *   Taxa de conversão por origem (Redes Sociais vs. Direto).
    *   Tempo médio de resposta da secretaria (SLA).
    *   Valor financeiro em "espera" (Potencial de receita das pré-candidaturas).

## 3. Arquitetura Técnica (Upgrade)

### 3.1. Processamento Assíncrono (Event-Driven)
Migrar operações em lote (como promover 500 candidatos) para um modelo assíncrono.
*   **Fila de Tarefas:** Uso de uma tabela de `background_jobs` ou serviço de mensageria.
*   **WebSockets:** Atualização em tempo real na interface da secretaria conforme o lote é processado.

### 3.2. Auditoria e Snapshots de Transição
*   Gravar um JSON `metadata_snapshot` em cada mudança de status, capturando o estado do objeto antes e depois da promoção, permitindo "Undo" de operações em lote e auditoria comercial rigorosa.

## 4. Próximos Passos
1.  **POC de Scoring:** Implementar a lógica de pontuação na Inbox atual.
2.  **Mapeamento de Lost Reasons:** Definir o catálogo de motivos de desistência com os diretores.
3.  **Mecanismo de Promoção Self-Service:** Desenvolver o portal do candidato para auto-promoção.

---
*KLASSE V2 — Transformando intenção em faturamento.*
