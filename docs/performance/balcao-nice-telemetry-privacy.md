# N5 — Telemetria anónima: privacidade e orçamento

O módulo `apps/web/src/lib/balcao/balcaoTelemetry.ts` aceita somente uma enumeração fixa de tipos de ação (desk/payment/document/reenrollment/enrollment/profile/grade), contadores inteiros de erros e buckets de duração `under100`, `under250`, `under500`, `over500`. A API `count({action,durationMs,error})` constrói o próprio objeto, sem serializar objetos externos; campos adicionais maliciosos são descartados. **Proibido** incluir valores financeiros, nome, BI, alunoId, escolaId, userId, texto de formulário, IP, URL, free text e horas exatas.

**Estado por defeito:** `NEXT_PUBLIC_BALCAO_ANONYMOUS_METRICS` não configurado ⇒ desativado. Mesmo quando está `true`, o hook `useBalcaoTelemetry` intencionalmente não recebe `sender`; portanto não há **qualquer pedido de rede**, que poderia expor endereço IP a terceiros. Os contadores ficam na memória do componente e desaparecem ao sair/trocar operador. Não se escreve no Supabase, storage, logs, cookies nem consola. Isto preserva a privacidade mesmo sem proxy capaz de remover IP.

A biblioteca pura dispõe de `sender` injetável apenas para futura implementação aprovada de agregação anónima; `flush` tem intervalo mínimo de 300.000 ms (5 min) e máximo de 100–1000 eventos por lote. **Não** foi ligado um endpoint/transportador sem garantia formal de eliminação de IP e retenção de métricas; o pedido para telemetria enviável fica gated por revisão de privacidade. Não é um blocker para as melhorias locais de UX.

**Prova:** `apps/web/tests/unit/balcao-anonymous-telemetry.spec.ts`: execução desligada não envia; evento hostil com `alunoId`, `schoolId`, `userId`, IP, dados de formulário, montante, URL e responsáveis produz payload estritamente igual ao objeto esperado com contadores; intervalo mínimo de cinco minutos; cap de 100; categorias desconhecidas descartadas. O único valor na visualização é um contador de buckets.

**Custo na quota:** 0 requisições/hora novas, 0 produção, 0 Supabase; limite de rede testado no módulo mas não ativado. A análise do código não substitui revisão externa de transportador (se algum dia for ligado).
