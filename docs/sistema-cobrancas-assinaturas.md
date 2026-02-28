# Sistema de Cobranças & Assinaturas
**Design técnico completo — Planos · Ciclos · Métodos · Painel**

| Atributo | Detalhe |
| :--- | :--- |
| **Modelo** | Misto |
| **Ciclo** | Mensal ou Anual |
| **Planos** | 3 (Essencial · Profissional · Premium) |
| **Métodos** | 4 (Transferência, Multicaixa, Cartão, Stripe) |
| **Meta Year 1** | 100 Escolas |
| **Data** | Fevereiro 2026 · Uso interno |

---

## 1. Estrutura de Planos
Três planos calibrados para a realidade do mercado angolano — do colégio privado pequeno à escola técnica com múltiplos campi. O plano define os limites, não o acesso às funcionalidades core.

### 1.1 Tabela de Planos

| Benefício | ESSENCIAL | PROFISSIONAL | PREMIUM |
| :--- | :--- | :--- | :--- |
| **Preço mensal** | Kz 60.000/mês | Kz 120.000/mês | Negociado |
| **Preço anual** | Kz 600.000/ano (2 meses grátis) | Kz 1.200.000/ano (2 meses grátis) | Negociado |
| **Alunos** | até 300 | até 800 | Ilimitado |
| **Utilizadores** | até 10 | até 30 | Ilimitado |
| **Turmas** | até 20 | até 60 | Ilimitado |
| **Storage** | 5 GB | 20 GB | 100 GB+ |
| **Portais** | Secretaria + Director | Todos os portais | Todos + API |
| **Documentos MED** | ✓ Incluído | ✓ Incluído | ✓ Incluído |
| **KLASSE Network** | Leitura | Leitura + contribuição | ✓ Completo |
| **Suporte** | Email 48h | Email 24h + chat | Dedicado |
| **SLA uptime** | 99% | 99.5% | 99.9% |

> **→ Princípio de pricing:** Nenhuma funcionalidade core é bloqueada por plano. Os limites são de capacidade (alunos, storage, utilizadores), não de features. Uma escola Essencial tem acesso completo ao Balcão Inteligente, ao portal do director, e aos documentos MED — só não consegue registar 500 alunos.

### 1.2 Limites e Enforcement
Quando uma escola atinge o limite do plano, o sistema não bloqueia abruptamente. Avisa com antecedência e oferece upgrade.

- **80%**: Notificação no dashboard do director — *"Está a aproximar-se do limite de alunos"*
- **95%**: Banner persistente + email automático ao director — *"Limite quase atingido · Considere fazer upgrade"*
- **100%**: Bloqueio de novos registos. Funcionalidades existentes continuam a funcionar. Prazo de 7 dias para upgrade.
- **+7 dias**: Após 7 dias sem upgrade, conta entra em modo leitura. Dados preservados. Acesso de escrita suspenso.

---

## 2. Ciclos de Cobrança
A escola escolhe o ciclo no momento de activação. Pode mudar de mensal para anual a qualquer momento — nunca o contrário a meio do ciclo.

### 2.1 Comparação de Ciclos

| Atributo | MENSAL | ANUAL |
| :--- | :--- | :--- |
| **Frequência** | Todo o mês (dia de activação) | Uma vez por ano |
| **Desconto** | Sem desconto | 2 meses grátis (~16% desconto) |
| **Flexibilidade** | Alta — cancela com 30 dias de aviso | Baixa — compromisso de 12 meses |
| **Ideal para** | Escolas a testar ou com cash flow irregular | Escolas comprometidas, poupança garantida |
| **Factura** | Mensal automatizada | Anual única + renovação antecipada (30 dias) |
| **Reembolso** | Pro-rata se cancelar a meio do mês | Pro-rata dos meses restantes se cancelar |

### 2.2 Lógica de Renovação Automática
O sistema executa um cron job diário que verifica assinaturas a renovar nos próximos 30 dias.

```typescript
// Edge Function: billing/check-renewals (cron diário às 08:00 WAT)

export async function checkRenewals() {
  const hoje = new Date()
  const em30dias = addDays(hoje, 30)

  // Assinaturas a renovar nos próximos 30 dias
  const { data: renovacoes } = await supabase
    .from('assinaturas')
    .select('*, escolas(nome, email_billing)')
    .eq('status', 'activa')
    .lte('data_renovacao', em30dias.toISOString())
    .gte('data_renovacao', hoje.toISOString())

  for (const ass of renovacoes) {
    const diasRestantes = differenceInDays(ass.data_renovacao, hoje)

    if (diasRestantes === 30) await enviarAvisoRenovacao(ass, 30)
    if (diasRestantes === 7)  await enviarAvisoRenovacao(ass, 7)
    if (diasRestantes === 1)  await enviarAvisoUrgente(ass)

    // Tentativa automática só para Stripe
    if (diasRestantes === 0 && ass.metodo === 'stripe') {
      await tentarCobrancaStripe(ass)
    }
    // Transferência e Multicaixa: aguardam confirmação manual
  }
}
```

---

## 3. Métodos de Pagamento
Quatro métodos com graus de automação completamente diferentes. A arquitectura trata cada um separadamente.

### 3.1 Comparativa de Métodos

- **Transferência Bancária (Manual)**
  - Escola recebe referência bancária + NIB.
  - Super admin confirma o comprovativo manualmente.
  - **Tempo:** 1-3 dias úteis.

- **Multicaixa Express (Semi-automática)**
  - Sistema gera referência Multicaixa.
  - Webhook notifica o sistema após pagamento.
  - **Tempo:** Imediato ou 24h.

- **Cartão de Crédito / Débito (Automática - Stripe)**
  - Stripe guarda token; renovação automática.
  - Retry automático em falhas (3/5/7 dias).
  - **Tempo:** Imediato.

- **Stripe Internacional (Total)**
  - Checkout hospedado, suporte a USD.
  - Invoices automáticas por email.
  - **Tempo:** Imediato.

> **→ Realidade do mercado angolano:** A maioria das escolas piloto vai pagar por transferência bancária. Stripe fica para a expansão. Não constróis Stripe primeiro — constróis a confirmação manual primeiro e automatizas por fases.

### 3.2 Schema da Base de Dados

```sql
-- Assinaturas por escola
CREATE TABLE assinaturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id       UUID NOT NULL REFERENCES escolas(id),
  plano           app_plan_tier NOT NULL DEFAULT 'essencial',
  ciclo           TEXT NOT NULL CHECK (ciclo IN ('mensal','anual')),
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','activa','suspensa','cancelada')),
  metodo_pagamento TEXT NOT NULL
                  CHECK (metodo_pagamento IN ('transferencia','multicaixa','cartao','stripe')),
  data_inicio     TIMESTAMPTZ NOT NULL,
  data_renovacao  TIMESTAMPTZ NOT NULL,
  valor_kz        INTEGER NOT NULL,  -- em kwanzas, sem decimais
  stripe_subscription_id TEXT,       -- só para Stripe
  stripe_customer_id     TEXT,       -- só para Stripe
  multicaixa_referencia  TEXT,       -- só para Multicaixa
  notas_internas  TEXT,              -- visível só para super admin
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de pagamentos
CREATE TABLE pagamentos_saas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id   UUID NOT NULL REFERENCES assinaturas(id),
  escola_id       UUID NOT NULL REFERENCES escolas(id),
  valor_kz        INTEGER NOT NULL,
  metodo          TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pendente','confirmado','falhado')),
  referencia_ext  TEXT,   -- ID Stripe, ref Multicaixa, nº comprovativo
  comprovativo_url TEXT,  -- Storage URL para comprovativos de TRF
  confirmado_por  UUID REFERENCES usuarios(id),  -- super admin que confirmou
  confirmado_em   TIMESTAMPTZ,
  periodo_inicio  DATE NOT NULL,
  periodo_fim     DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: escolas só veem os seus dados
ALTER TABLE assinaturas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_saas ENABLE ROW LEVEL SECURITY;

CREATE POLICY escola_propria_assinatura ON assinaturas
  FOR SELECT USING (escola_id = get_current_escola_id());

-- Super admin vê tudo
CREATE POLICY super_admin_tudo ON assinaturas
  FOR ALL USING (get_current_role() IN ('super_admin','global_admin'));
```

---

## 4. Fluxos de Activação por Método

### 4.1 Transferência Bancária — Fluxo Completo
1. **Seleção:** Escola escolhe plano/ciclo e Transferência Bancária.
2. **Instrução:** Sistema gera email com NIB e referência única (ex: KLASSE-2026-0042).
3. **Pagamento:** Escola realiza transferência externa ao sistema.
4. **Comprovativo:** Escola faz upload do comprovativo no portal.
5. **Notificação:** Super admin vê o comprovativo pendente no painel.
6. **Aprovação:** Clique único ativa a assinatura e notifica a escola.

---

## 5. Painel de Cobrança — Super Admin
A superfície mais importante para o controlo financeiro do negócio.

### 5.1 Dashboard Financeiro

| MRR | ARR | PENDENTES | VENCIDAS |
| :--- | :--- | :--- | :--- |
| **Kz 480K** | **Kz 5.76M** | **3** | **1** |
| +50% vs mês ant. | anualizado | comprovativos | escola em atraso |

### 5.2 Fila de Comprovativos Pendentes

| ESCOLA | PLANO | VALOR | AGUARDA | ACÇÃO |
| :--- | :--- | :--- | :--- | :--- |
| Colégio Horizonte | Profissional · Mensal | Kz 120.000 | 2 dias | [Ver] [Confirmar] [Rejeitar] |
| Escola Nova Vida | Essencial · Mensal | Kz 60.000 | 5 dias | [Ver] [Confirmar] [Rejeitar] |
| Instituto São Paulo | Profissional · Anual | Kz 1.200.000 | 1 dia | [Ver] [Confirmar] [Rejeitar] |

---

## 6. Painel de Cobrança — Escola
O director vê o estado da sua assinatura, o histórico de pagamentos, e submete comprovativos sem fricção.

### Vista do Director
- **Estado da Assinatura:** PROFISSIONAL · Mensal · ● Activa
- **Próxima Renovação:** 15 de Abril (Kz 120.000)
- **Método:** Transferência Bancária (NIB: 0040.0000.1234567.89 | Ref: KLASSE-2026-0042)

**Acções Disponíveis:**
- → Submeter comprovativo de pagamento.
- → Ver histórico de facturas.
- → Fazer upgrade de plano.
- → Gerir cartão (Stripe).

---

## 7. Plano de Implementação

### FASE 1: Antes do piloto · Mar 2026
- [ ] Schema SQL — tabelas `assinaturas` e `pagamentos_saas` com RLS.
- [ ] Fluxo de transferência bancária completo (o mais crítico).
- [ ] Painel super admin — fila de comprovativos + confirmar/rejeitar.
- [ ] Portal da escola — ver estado + submeter comprovativo.
- [ ] Cron de avisos de renovação (30d, 7d, 1d antes).

### FASE 2: Pós-piloto · Mai–Jun 2026
- [ ] Integração Multicaixa Express (referência + webhook).
- [ ] Dashboard financeiro consolidado (MRR, ARR).
- [ ] Vista por escola com histórico completo de pagamentos.
- [ ] Enforcement de limites de plano (80%, 95%, 100%).

### FASE 3: Escala · Set 2026+
- [ ] Integração Stripe (Checkout Sessions + Subscriptions).
- [ ] Portal do cliente Stripe para gestão de cartão.
- [ ] Relatórios financeiros exportáveis (Excel/PDF).
- [ ] API de billing para integrações externas.

> **A regra de ouro:** Não construas Stripe antes de teres 5 escolas a pagar por transferência bancária. A transferência manual resolve o problema de Abril.
