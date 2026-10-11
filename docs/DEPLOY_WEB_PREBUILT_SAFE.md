# Deploy seguro do app.klasse.ao via prebuilt

Use este fluxo somente como fallback quando o deploy normal da Vercel estiver bloqueado por limite de build/deployment.

## Comando

```bash
bash scripts/deploy-web-prebuilt-safe.sh
```

O script publica **somente** o projeto Vercel `moxi-edtech`, responsável por `app.klasse.ao`.

## Proteções

1. Lê o deployment `READY` que está atualmente em produção.
2. Extrai o SHA que está servindo `app.klasse.ao`.
3. Atualiza `origin/main` e usa exatamente esse HEAD como alvo.
4. Bloqueia o deploy se o SHA de produção não for ancestral do SHA alvo.
5. Cria um worktree isolado do SHA alvo; mudanças locais não entram no build.
6. Roda instalação, typecheck, UI standards e testes de segurança.
7. Executa `vercel build --prod` localmente.
8. Envia o artefato com `vercel deploy --prebuilt --archive=tgz` como preview.
9. Só promove o preview após ele ficar `READY` e passar smoke tests.
10. Depois da promoção, valida `app.klasse.ao` e confirma o SHA ativo.
11. Se qualquer verificação pós-promoção falhar, promove novamente o deployment anterior.

## Dry-run da guarda anti-regressão

O modo abaixo não faz build nem upload:

```bash
KLASSE_DEPLOY_DRY_RUN=1 \
KLASSE_PRODUCTION_SHA_OVERRIDE=<sha-atual> \
bash scripts/deploy-web-prebuilt-safe.sh
```

`KLASSE_PRODUCTION_SHA_OVERRIDE` é aceito **apenas** em dry-run. Em deploy real, o SHA é obrigatoriamente obtido da Vercel.

## Regras

- O deploy real sempre usa `origin/main`.
- O projeto deve ser exatamente `prj_YjDBpI3emmjWUB5cF7K7IsV7oNFg` / `moxi-edtech`.
- `auth.klasse.ao`, landing e formação não são tocados.
- Não use `KLASSE_FORCE_REDEPLOY=1` sem motivo operacional; se produção e `main` já estiverem no mesmo SHA, o script encerra sem publicar.
