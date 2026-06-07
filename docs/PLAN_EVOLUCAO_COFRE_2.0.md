# Plano de Evolução — Cofre do Candidato (V2.0)

**Objetivo:** Transformar a consulta de status em um Dashboard Interativo ("Cofre") que guia o encarregado até a matrícula final.

## 1. Mudanças Visuais e de UX

### A. Stepped Progress Bar (Funnel)
Substituir o badge de status por uma linha do tempo horizontal no topo do Vault:
- **Passo 1: Submetido** (Sempre verde se chegou aqui)
- **Passo 2: Análise Documental** (Laranja se em análise, Verde se OK, Vermelho se pendente)
- **Passo 3: Pagamento** (Ativo apenas se status for `aguardando_pagamento`)
- **Passo 4: Matriculado** (O destino final)

### B. "Next Action" Card (Hero do Dashboard)
Um card de alta visibilidade logo abaixo do progresso que diz exatamente o que fazer:
- **Pendente:** "⚠️ Corrija seus documentos para continuar."
- **Aguardando Pagamento:** "💳 Sua vaga está reservada! Envie o comprovante em até [TIME]."
- **Aguardando Compensação:** "⏳ Recebemos seu pagamento. Estamos validando."
- **Matriculado:** "🎉 Bem-vindo! Sua matrícula está ativa. Baixe seu comprovante abaixo."

### C. Sidebar ou Layout Seccionado
Organizar as informações em blocos mais claros:
- **Coluna Principal:** Progresso, Próxima Ação, Dossiê de Documentos.
- **Coluna Lateral (ou bloco separado):** Dados Bancários (se necessário), Configuração de Senha, Suporte WhatsApp.

## 2. Implementação Técnica

### Arquivos Afetados:
- `apps/web/src/app/(publico)/admissoes/[escolaSlug]/consultar/StatusInquiryForm.tsx`

### Novos Componentes Internos:
- `VaultProgress`: Linha do tempo visual.
- `NextActionCard`: Card dinâmico de CTA.
- `SupportSection`: Link rápido para o WhatsApp da escola.

## 3. Cronograma Sugerido
1. **Fase 1:** Implementar `VaultProgress` e `NextActionCard`.
2. **Fase 2:** Refatorar o layout para ser mais "Dashboard" (melhor uso de espaços e sombras).
3. **Fase 3:** Adicionar suporte visual a pendências (ícones de alerta no dossiê mais destacados).
