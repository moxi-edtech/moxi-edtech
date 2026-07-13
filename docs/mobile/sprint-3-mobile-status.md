# Sprint 3 mobile status

Data: 2026-07-12

## Veredito

Sprint 3 nao esta concluida.

Estado correcto:

- Offline V2: encaminhado para continuar validacao.
- Capacitor: iniciado como shell remoto.
- Deep links: parcialmente configurados, bloqueados por credenciais reais.
- Push nativo: pendente.
- App store: nao liberado.

## O que ficou fechado neste corte

- Android declara deep links para `https://app.klasse.ao/aluno/*` e `https://app.klasse.ao/professor/*` com `VIEW`, `DEFAULT`, `BROWSABLE` e `autoVerify`.
- iOS declara `com.apple.developer.associated-domains` com `applinks:app.klasse.ao`.
- Notas e presencas nao removem mais a chave de idempotencia depois que a RPC principal confirmou sucesso.
- A documentacao deixa explicito que o Capacitor atual carrega `https://app.klasse.ao` via `server.url`, portanto e shell remoto, nao bundle local/offline do Next.js.

## Bloqueios que dependem de credenciais

- Gerar `apps/web/public/.well-known/assetlinks.json` com o fingerprint SHA-256 do certificado Android de release.
- Gerar `apps/web/public/.well-known/apple-app-site-association` com o Apple Team ID real da conta Apple Developer.
- Instalar e sincronizar `@capacitor/push-notifications` quando FCM/APNS estiverem prontos.
- Adicionar `apps/web/android/app/google-services.json` real para FCM.
- Configurar APNS e Push Notifications capability no Apple Developer/Xcode.

## Geracao dos deep links reais

Definir variaveis:

```bash
export KLASSE_ANDROID_SHA256_CERT_FINGERPRINTS="AA:BB:CC:..."
export KLASSE_APPLE_TEAM_ID="ABCDE12345"
export KLASSE_ANDROID_PACKAGE_NAME="ao.klasse.app"
export KLASSE_APPLE_BUNDLE_ID="ao.klasse.app"
export KLASSE_DEEPLINK_HOST="app.klasse.ao"
export KLASSE_DEEPLINK_PATHS="/aluno/*,/professor/*"
```

Gerar artefactos:

```bash
pnpm mobile:deeplinks:generate
```

Validar antes de release:

```bash
pnpm mobile:deeplinks:check
```

O check deve falhar enquanto `assetlinks.json` ou `apple-app-site-association` ainda contiverem placeholders.

## Criterio de conclusao

- `assetlinks.json` validado pelo Android App Links.
- `apple-app-site-association` validado em dispositivo iOS real.
- Deep link abre `/aluno/*` e `/professor/*` sem cair em browser.
- Push nativo recebido em Android e iOS com app fechado, em background e foreground.
- Login/logout e limpeza de cache sensivel validados em dispositivo real.
