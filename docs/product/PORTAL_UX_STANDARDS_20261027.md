# Portal UX Standards — P0/P1

**Escopo:** Portais KLASSE (primeiro consumidor: Aluno). Fundação de apresentação, sem alterar autenticação, APIs, preço, RLS, ledger, matriz curricular ou estados do RAA.

## Componentes canónicos

| Componente | Contrato |
|---|---|
| `PortalSurface` | Card neutro, compacto, sem gradientes ou duplicação de painel de conformidade |
| `PortalSection` | Cabeçalho editorial com `aria-labelledby`, ação contextual opcional |
| `PortalAction` | `Link` para navegar; `button` para executar; pelo menos 44 px de altura, foco visível |
| `PortalEmptyState` | Uma mensagem breve, contexto opcional, no máximo uma ação |
| `PortalLoadingState` | `role=status`, `aria-live=polite`, esqueletos ocultos de leitores de ecrã |
| `PortalStatus` | Estados semânticos visíveis, não infere autorização, pagamento ou avaliação |
| `PortalStatCard` | Métrica informada por dado real ou `null` (sem dados), nunca inventada |
| `PortalTabs` | Teclas esquerda/direita, Home/End, roving focus e `aria-controls`; não assume router |

## Regras funcionais

1. **Estado e ação:** para cada situação mostrar apenas a informação e a próxima ação relevante. Ex.: `Pagamento pendente → Pagar`; `Em análise → Acompanhar`; `Taxa por definir → Informação`.
2. **Sem dados ≠ zero:** cartões não assumem que nota ou estado financeiro ausente é 0 ou aprovado.
3. **Acesso a notas:** só as APIs autorizadas podem devolver avaliações; componentes de apresentação nunca alteram `is_liberado`.
4. **Links preservam contexto:** `aluno`, `ano_letivo_id` e escola devem ser conservados. Mudanças de tab atualizam `aba` no histórico local, sem remontagem.
5. **Acessibilidade:** botões e links com foco visível e pelo menos 44 px, estados polidos; testar com teclado e VoiceOver. WCAG 2.2 AA exige homologação manual, além da automação.
6. **Compatibilidade:** `AlunoCard` e `SectionTitle` continuam disponíveis, com tokens de tema; preferir os novos componentes em implementações futuras.
7. **Reuse, não duplicação:** mensagens escolares continuam sob `components/ui/alert.tsx` (`Notice`); fundações de design tokens globais seguem a PR #159, em paralelo.

## Adaptação aplicada

- Dashboard: três cartões pequenos (`Avisos`, `Notas`, `Vencidas`) com valores reais e navegação ao contexto correto; listagem de alertas e aulas usa ações e secções partilhadas.
- Secretaria Digital: cards compactos, ações primárias e de acompanhamento, estados, loading e empty partilhados.
- Académico: `PortalTabs` reutilizável; painéis `Notas`, `Disciplinas`, `Documentos` preservam montagem, aluno e ano.

## Verificação e rollout

A PR é separada e não altera produção enquanto a quota da Vercel estiver bloqueada. Rodar testes `aluno-accessibility-aa`, `aluno-academico-mobile-navigation`, `aluno-dashboard-editorial`, `aluno-cards-graceful-states`, `portal-ui-standards` e a matriz visual de cinco larguras × três zooms. Validar manualmente VoiceOver/Safari antes de afirmar conformidade WCAG 2.2 AA. Fazer merge apenas após CI verde e verificação de conflitos.
