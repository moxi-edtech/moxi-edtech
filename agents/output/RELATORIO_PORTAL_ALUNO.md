# Relatório — Portal Aluno

Data: 2026-03-02
Escopo: revisão do estado atual do portal aluno após os últimos ajustes de layout, APIs e guardas de autorização.

## 1) Estado atual

- O portal aluno já está integrado com dados reais em endpoints `/api/aluno/*` para home, académico e financeiro.
- A seleção de `studentId` está protegida por validação de vínculo via `auth.uid()` + vínculos de aluno/encarregado.
- Fluxo de comprovativo financeiro está ativo (upload + transição para `em_verificacao`).

## 2) Riscos/pendências identificadas

1. **Coordenadas bancárias hardcoded no drawer**
   - Banco/IBAN/referência exibidos com valores fixos na UI.
   - Impacto: risco operacional e inconsistência entre escolas.

2. **Académico com campos MAC/NPP/PT sem origem dedicada**
   - UI exibe os 3 campos com base no mesmo valor trimestral no componente atual.
   - Impacto: semântica académica incompleta para boletim detalhado.

3. **RLS ainda orientada a tenant (escola) em partes sensíveis**
   - Há hardening por escola, mas o reforço por vínculo real aluno/encarregado ainda deve ser completado no banco.
   - Impacto: segurança depende mais da camada de aplicação do que da política de dados.

4. **Teste anti-IDOR parcial**
   - Existe teste de helper de autorização, mas falta suíte de integração/API cobrindo tentativas cruzadas endpoint a endpoint.

## 3) Backlog recomendado (prioridade)

### P0
- Externalizar coordenadas bancárias por escola (fonte de configuração real).
- Criar políticas RLS por vínculo real para: mensalidades, notas, frequências e documentos.
- Adicionar testes de integração anti-IDOR para:
  - `/api/aluno/financeiro`
  - `/api/aluno/boletim`
  - `/api/aluno/boletim/pdf`
  - `/api/aluno/financeiro/comprovativo`

### P1
- Evoluir payload académico para suportar MAC/NPP/PT e MT com origem separada e rastreável.
- Melhorar telemetria/auditoria para registrar tentativas de `studentId` não autorizado.

### P2
- Refinos de UX (mensagens de estado, skeletons e acessibilidade do drawer).

## 4) Conclusão

O portal está funcional com dados reais e proteção de seleção de aluno na camada de aplicação, mas ainda requer fechamento de segurança no banco (RLS por vínculo) e testes de integração anti-IDOR para atingir maturidade de produção.
