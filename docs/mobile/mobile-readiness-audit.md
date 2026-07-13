# Mobile readiness audit - KLASSE Mobile V1

Data: 2026-07-11
Repositorio auditado: `/Users/gundja/moxi-edtech`

## Veredito executivo

O produto ja tem base PWA funcional para iniciar KLASSE Mobile V1 com foco em web app instalavel:

- Next.js App Router em `apps/web`.
- Manifesto em `apps/web/public/manifest.json`.
- Service worker em `apps/web/public/sw.js`.
- Registo global do service worker em `apps/web/src/components/system/ServiceWorkerRegister.tsx`.
- Sincronizacao offline global em `apps/web/src/components/system/OfflineSyncRegister.tsx`.
- IndexedDB local em `apps/web/src/lib/offline/store.ts`.
- Fila offline basica em `apps/web/src/lib/offline/queue.ts`.
- Push web ja iniciado com `usePushNotifications`, `api/aluno/push/subscribe` e worker Inngest.

## Decisao aprovada

O caminho aprovado e incremental, sem refatoracao completa do produto.

- Manter Next.js/PWA como base do mobile.
- Fazer refatoracao cirurgica apenas em rotas, layout mobile, manifesto, offline e pontos de seguranca.
- Lancar KLASSE Aluno primeiro.
- Preparar KLASSE Professor depois, com foco especial em notas e frequencias offline.
- Adiar Capacitor/app store ate fechar rotas canonicas, manifesto mobile e offline confiavel.

Esta decisao reduz risco porque preserva as rotas, APIs, autenticacao e regras de negocio ja existentes.

O produto ainda nao esta pronto como app mobile empacotada de producao:

- `capacitor.config.ts` existe, mas esta configurado como shell remoto para `https://app.klasse.ao`.
- As pastas nativas `android` e `ios` existem.
- Os scripts Capacitor existem no `package.json`.
- Deep links dependem de credenciais reais ainda nao preenchidas: SHA-256 Android e Apple Team ID.
- Push nativo ainda depende de plugin nativo, `google-services.json`, APNS e entitlements/capabilities finais.
- O manifesto atual e centrado no aluno: `name` = `Klasse - Portal do Aluno`, `start_url` = `/aluno/dashboard`.
- O service worker faz cache de dados apenas para `/api/aluno/*` e `/api/public/*`; professor nao esta coberto nessa estrategia.

## Estado por app

### KLASSE Aluno

Estado: parcialmente pronto para PWA, ainda nao pronto para app store.

Rotas reais existem para:

- Dashboard
- Academico
- Avisos
- Disciplinas
- Documentos
- Financeiro
- Horario
- Identidade
- Perfil
- Desabilitado

APIs reais existem para dados academicos, financeiro, documentos, perfil, push e rematricula.

Lacunas principais:

- Rotas duplicadas entre `/(portal-aluno)/aluno/*` e `/escola/[id]/aluno/*`; e preciso definir a canonica mobile.
- Manifesto inicia em `/aluno/dashboard`, enquanto tambem existem rotas school-scoped.
- Cache offline depende do service worker e de fetch direto; nao ha matriz por operacao nem status visivel por dado.
- Operacoes de escrita do aluno, como perfil, rematricula, solicitacao/emissao de documentos e comprovativos, nao usam fila offline com conflito.

### Capacitor / App Store

Estado: iniciado como shell remoto, nao pronto para producao.

Implementado:

- `apps/web/capacitor.config.ts` existe.
- `apps/web/android` e `apps/web/ios` existem.
- Android tem intent-filter com `VIEW`, `BROWSABLE`, `autoVerify` e host `app.klasse.ao` para `/aluno/*` e `/professor/*`.
- iOS tem entitlement `com.apple.developer.associated-domains` para `applinks:app.klasse.ao`.

Bloqueios externos:

- `assetlinks.json` ainda exige o SHA-256 real do certificado de assinatura Android.
- `apple-app-site-association` ainda exige o Apple Team ID real.
- Push nativo exige `@capacitor/push-notifications`, Firebase/FCM (`google-services.json`) e APNS configurado no Apple Developer.
- Como `server.url` aponta para `https://app.klasse.ao`, o app nativo carrega o site remoto; isto nao e um bundle local/offline do Next.js.

Gate de release:

- Gerar artefactos reais com `pnpm mobile:deeplinks:generate` apos definir `KLASSE_ANDROID_SHA256_CERT_FINGERPRINTS` e `KLASSE_APPLE_TEAM_ID`.
- Validar ausencia de placeholders e consistencia nativa com `pnpm mobile:deeplinks:check`.

### KLASSE Professor

Estado: funcional no web, mais atrasado como mobile/PWA.

Rotas reais existem para:

- Inicio professor
- Calendario
- Fluxos
- Frequencias
- Materiais
- Notas
- Perfil

APIs reais existem para agenda, atribuicoes, calendario, dashboard, materiais, notas, pauta, periodos, presencas, profile e alunos por turma.

Pontos fortes:

- Frequencias e notas ja usam `enqueueOfflineAction` quando offline.
- APIs de notas e presencas exigem header `idempotency-key`.

Lacunas principais (Status de Implementação):

- **O service worker nao inclui `/api/professor/*` na estrategia de data cache:** ✅ Resolvido (Rotas chaves do professor agora são cacheadas de forma seletiva).
- **A fila offline nao registra status, tentativas, erro, proxima tentativa, conflito ou versao-base:** ✅ Resolvido (Atualizado para V2 via IndexedDB e fila em `store.ts` e `queue.ts`).
- **O `idempotency-key` e exigido, mas nao foi encontrado uso persistente do idempotency key no servidor para deduplicacao real:** ✅ Resolvido (Implementado no backend com validação e lock atômico no banco via `idempotency_keys`).
- **Notas e frequencias ainda nao carregam snapshots offline robustos para selecao de turma, alunos, periodos e pauta:** Em progresso (Planejado para as próximas sprints).

## Sprint recomendado com rotas reais

### Sprint 0 - Auditoria e contrato mobile

Objetivo: fechar a superficie real do V1 antes de empacotar.

Entregaveis:

- `mobile-readiness-audit.md`
- `mobile-route-matrix.md`
- `offline-operation-matrix.md`
- `mobile-security-review.md`

Decisoes obrigatorias:

- Canonica Aluno aprovada para entrada mobile: manter `/aluno/*`.
- Canonica Professor recomendada para entrada mobile: manter `/professor/*`.
- Tratar `/escola/[id]/aluno/*` e `/escola/[id]/professor/*` como compatibilidade/contexto escolar, com redirecionamento quando necessario.
- Sequencia aprovada: KLASSE Aluno primeiro, KLASSE Professor depois.
- Definir manifesto por perfil antes do Capacitor: ✅ Resolvido (manifestos separados por layout).

### Sprint 1 - Offline confiavel

Objetivo: tornar escrita offline auditavel e recuperavel.

Escopo minimo:

- Evoluir IndexedDB `klasse-offline` para versao 2.
- Adicionar na fila: `status`, `retryCount`, `lastAttemptAt`, `lastError`, `nextRetryAt`, `conflictData`, `mutationId`, `baseVersion`, `payloadHash`.
- Processar fila com backoff.
- Tratar `409` como conflito, nao como erro generico.
- Persistir idempotencia no backend para notas e presencas.
- Incluir `/api/professor/*` no cache do service worker com criterio por endpoint.

Rotas prioritarias:

- Professor: `/professor/notas`, `/professor/frequencias`.
- Aluno: `/aluno/dashboard`, `/aluno/horario`, `/aluno/financeiro`, `/aluno/documentos`, `/aluno/perfil`.

### Sprint 2 - Shell mobile/PWA instalavel

Objetivo: preparar app instalavel consistente.

Escopo minimo:

- Manifesto(s) por app/perfil.
- Icones e splash adequados.
- Safe area, viewport, teclado, bottom nav e estados offline: ✅ Parcial (Viewport Fit Cover, Zoom bloqueado no input e banners offline implementados).
- Estrategia de deep link para rotas canonicas: 🟡 Parcial (Android/iOS declarados, mas AASA/AssetLinks dependem de credenciais reais).
- Definir e adicionar Capacitor apenas depois do contrato de rotas e offline: 🟡 Parcial (shell remoto criado; validacao PWA/offline ainda e criterio de liberacao).

### Sprint 3 - Capacitor/app store

Objetivo: empacotar somente depois de validar PWA mobile.

Entrada minima:

- Aluno validado como PWA em mobile real.
- Manifesto e assets finais.
- Offline de leitura do aluno funcionando.
- Operacoes sensiveis marcadas como online-only ou com fila dedicada.
- Logout limpando cache/snapshots sensiveis.

Escopo:

- Adicionar `capacitor.config.*`: ✅ Resolvido (capacitor.config.ts adicionado).
- Criar shells `android` e `ios`: ✅ Resolvido (pastas nativas android/ e ios/ adicionadas ao projeto).
- Configurar deep links para rotas canonicas: 🟡 Parcial (intent-filter Android e entitlement iOS adicionados; SHA Android e Team ID Apple ainda pendentes).
- Validar push e permissao de notificacao no ambiente nativo: ❌ Pendente (`@capacitor/push-notifications`, FCM/APNS e capabilities ainda nao estao fechados).

## Risco atual

Nao recomendo declarar Sprint 3 concluida nem submeter app store ainda. A base Capacitor existe como shell remoto, mas deep links e push nativo ainda dependem de credenciais/capabilities reais e validacao em dispositivos.
