# Vercel monorepo: evitar deployments desnecessários

## Diagnóstico (28/10/2026)

O repositório moxi-edtech/moxi-edtech possui vários projetos Vercel ligados ao mesmo monorepo pnpm.
Os cinco ficheiros `vercel.json` executavam `scripts/vercel-ignore-build.mjs`.
Esse comando é um **Ignored Build Step**: a Vercel cria um deployment, inicia um slot de build e cancela-o posteriormente.
O script também falhava de forma permissiva quando `VERCEL_GIT_PREVIOUS_SHA` não estava presente num clone raso.
Por isso, alterações irrelevantes podiam gerar deployments contabilizáveis e builds desnecessários.

## Configuração adotada

- Cada projeto de produção (`moxi-edtech`, `moxi-edtech-auth`, `moxi-edtech-landing`, `moxi-formacao`)
  deve ter **Skip deployment for unaffected projects** ativado no painel Vercel,
  em **Settings → Build and Deployment → Root Directory**.
- Desativar qualquer **Ignored Build Step** no painel: `commandForIgnoringBuildStep = null`.
- Os ficheiros `vercel.json` já não definem `ignoreCommand` e preservam crons e redirects.
- O `pnpm-workspace.yaml` mantém `apps/*` e `packages/*`. Cada pacote tem nome único e
  dependências internas explícitas no `package.json`.
- Verificar os Root Directories (`apps/web`, `apps/auth`, `apps/landing`, `apps/formacao`)
  e a opção de incluir ficheiros externos ao root, quando necessária.
- Projetos web legados devem ser revistos separadamente antes de serem reativados.
- `scripts/vercel-ignore-build.mjs` fica sem ligação ativa; **não o reutilizar** como `ignoreCommand`.
  Uma alteração futura que volte a introduzir `ignoreCommand` falhará no guard de CI.

## Homologação

1. Fazer um push que altere apenas `apps/web/src`: apenas o projeto web deve construir;
   auth deve aparecer como *skipped* nativo, sem logs de compilação.
2. Alterar uma dependência de workspace usada por web/auth: ambos devem construir.
3. Um commit apenas de documentação não deve gerar *Ignored Build Step* contabilizável.
   Alterações fora dos workspaces podem ser tratadas pela Vercel como alterações globais:
   observar esse comportamento; não substituir o native skip por um ignore script.
4. Confirmar o deployment `READY` de produção com o SHA integrado, e a associação do
   domínio `app.klasse.ao` antes de declarar publicação.
5. Se a integração GitHub mostrar `build-rate-limit`, separar o resultado histórico do
   *status* de novas tentativas; não repetir redeploys enquanto a quota estiver bloqueada.

Referências:
- https://vercel.com/docs/monorepos
- https://vercel.com/changelog/skipped-monorepo-deployments-no-longer-count-against-limits
- https://vercel.com/docs/project-configuration/project-settings
