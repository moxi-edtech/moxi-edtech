# Plano de Evolução: Calendário Académico Nacional (MED 686/25)

Este documento detalha a estratégia de implementação para alinhar o sistema **Moxi Edtech** com o **Decreto Executivo n.º 686/25** de Angola, que define o calendário escolar para o ano lectivo 2025/2026.

## 1. Visão Geral
O objectivo é permitir que as escolas configurem automaticamente os seus períodos lectivos, feriados e pausas pedagógicas seguindo o padrão nacional, integrando estas datas com o sistema de presenças e lançamento de notas.

## 2. Mudanças na Base de Dados (Supabase)

### 2.1 Nova Tabela: `calendario_eventos`
Armazenará feriados, pausas e datas especiais que não são trimestres.

```sql
CREATE TYPE tipo_evento_calendario AS ENUM (
  'FERIADO',
  'PAUSA_PEDAGOGICA',
  'PROVA_TRIMESTRAL',
  'EXAME_NACIONAL',
  'EVENTO_ESCOLA'
);

CREATE TABLE public.calendario_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
    ano_letivo_id UUID NOT NULL REFERENCES anos_letivos(id) ON DELETE CASCADE,
    tipo tipo_evento_calendario NOT NULL,
    nome VARCHAR(255) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    cor_hex VARCHAR(7) DEFAULT '#64748b',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 3. Configurações Oficiais (MED 2025/2026)
- **Abertura:** 01/09/2025 | **Término:** 31/07/2026
- **I Trimestre:** 02/09/2025 a 31/12/2025 (Provas: 08/12 a 19/12)
- **II Trimestre:** 05/01/2026 a 10/04/2026 (Provas: 16/03 a 27/03)
- **III Trimestre:** 13/04/2026 a 31/07/2026 (Provas: 08/06 a 19/06)

## 4. Estado da Implementação (Fase 1 - Concluída)

- [x] **1. Base de Dados:** Criada tabela `calendario_eventos` e atualizada RPC `upsert_bulk_periodos_letivos` para suportar pesos (30/30/40).
- [x] **2. Tipagem:** Sincronização completa de tipos TypeScript (`types/supabase.ts`).
- [x] **3. API Preset:** Rota `/api/escola/[id]/admin/calendario/preset-angola` funcional com dados do MED.
- [x] **4. Painel Admin:** Interface com Tabs e Modal de criação/remoção de eventos sincronizado com DB.
- [x] **5. Portal do Aluno:** Widget "Próximos Eventos" integrado na Home.
- [x] **6. Secretaria:** View Unificada (`vw_eventos_escola_unificados`) integrando eventos manuais e oficiais.
- [x] **7. Segurança de Transição:** Bloqueio inteligente na rematrícula baseado em datas de exames nacionais.
- [x] **8. Sincronização de Admissões:** Portal público prioriza automaticamente o novo ano lectivo (2025/2026).

## 5. Estratégia de Sincronização
- **SSOT:** `calendario_eventos` é a fonte única para feriados e pausas pedagógicas.
- **Cascata:** Mudanças no calendário Admin reflectem-se instantaneamente no Aluno e na Secretaria via View SQL.
- **Virada de Ano:** a virada transacional deve validar o calendário do ano destino antes de ativar a nova sessão. Um ano novo sem períodos letivos e eventos base não deve receber turmas, matrículas e mensalidades operacionais.

## 6. Próximas Evoluções (Fase 2)
1. **Diário de Classe:** Bloqueio automático de faltas em feriados.
2. **Notificações:** Alertas automáticos para provas e pausas.
3. **Validador de Gaps:** Identificar períodos lectivos não cobertos por pausas.
4. **Gate de Cutover:** expor no SSOT de `operacoes-academicas` se o calendário do ano destino está pronto para a virada.

---
*Referência: Decreto Executivo n.º 686/25 – Ministério da Educação (MED), Angola.*
