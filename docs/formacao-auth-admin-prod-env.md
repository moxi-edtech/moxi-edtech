# Formacao auth-admin production env

## Contexto

`apps/formacao` chama o job protegido `apps/web/src/app/api/jobs/auth-admin/route.ts` para criar/consultar utilizadores durante fluxos administrativos.

Em desenvolvimento, o token pode vir de `apps/formacao/.env.local`. Em producao, `.env.local` nao existe no runtime, por isso o segredo precisa estar configurado no provider do deploy.

## Variaveis obrigatorias

Configurar o mesmo valor de `AUTH_ADMIN_JOB_TOKEN` nos dois projetos:

- `moxi-formacao`: usado pelo caller em `apps/formacao/lib/auth-admin-job.ts`.
- `moxi-edtech-web`: usado pelo receiver em `/api/jobs/auth-admin`.

Tambem e necessario configurar no projeto `moxi-formacao`:

- `KLASSE_AUTH_ADMIN_JOB_BASE_URL=https://<dominio-canonico-do-app-web>`

## Comandos Vercel

```bash
vercel env add AUTH_ADMIN_JOB_TOKEN production --cwd apps/formacao
vercel env add AUTH_ADMIN_JOB_TOKEN production --cwd apps/web
vercel env add KLASSE_AUTH_ADMIN_JOB_BASE_URL production --cwd apps/formacao
```

Se o ambiente usar `CRON_SECRET` como token partilhado, ele precisa existir com o mesmo valor nos dois projetos. `AUTH_ADMIN_JOB_TOKEN` e preferivel por ser mais especifico.

Depois de alterar env vars de producao, fazer redeploy do projeto `moxi-formacao` e do projeto `moxi-edtech-web`.
