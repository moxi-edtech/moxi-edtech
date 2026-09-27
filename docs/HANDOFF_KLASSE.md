# Handoff KLASSE

> Escrito em 2026-09-23, no fim da sessão que corrigiu o radar de admissões.
> Para retomar: lê este ficheiro, o `AGENTS.md`, e o `git log`.

| | |
|---|---|
| Repo | `moxi-edtech` |
| Branch | `codex/reabertura-notas` |
| HEAD | `42db0d493` |
| Remote | `origin` · `git@github.com:moxi-edtech/moxi-edtech.git` |

---

## 1. O que decidimos nesta sessão

### 01 — Destravar o push da branch · `789f62fcc`

O hook `scripts/check-no-secrets.sh` bloqueava. Alterámos o scanner — allowlist para linhas
de dump de ACL com `service_role`, e auto-exclusão do próprio ficheiro — com autorização
explícita do utilizador, documentada em `agents/exceptions/EXC-SECRET-001.md`. O commit foi
um *squash* de três, para que nenhum blob ofensivo ficasse dentro do range do push.

**Regra que ficou:** alterar um controlo de segurança exige autorização que **nomeie o
controlo**. "Faz o push" ou "avança" não chegam — o classificador recusa, e é justo.

### 02 — Porque é que tudo ia para Preview · diagnóstico

Os três projectos Vercel têm `productionBranch: main`, e o `main` estava parado desde
2026-08-18. A produção é mantida **à mão**, por `vercel promote`. Consequência concreta
encontrada: `klasse.ao/termos`, `/privacidade` e `/exclusao-de-dados` devolviam **404**.

### 03 — Três migrations aplicadas em produção

Faltavam e o código dependia delas. Criaram `public.ebook_leads`, quatro tabelas do ProxyPay
(`school_payment_providers`, `payment_references`, `payment_provider_transactions`,
`payment_provider_events`) e a função de idempotência de threads WAHA. Tudo aditivo.
O rollback está em `/tmp/klasse_rollback_migrations.sql` — **não** no repositório, de propósito.

### 04 — Landing e web promovidos para produção · verificado ao vivo

Confirmado: `/termos`, `/privacidade` e `/exclusao-de-dados` passaram a **200**; o web ficou
`READY`; `auth.klasse.ao/login` dá 200; `app.klasse.ao` faz 307 para o login, como esperado.

### 05 — O bug 42501 no radar de admissões · `42db0d493`

A view `view_admissao_oportunidades_lista_espera` recebeu `security_invoker = true` a
2026-07-18, passando a executar com os privilégios de quem chama. Como a função
`admissao_turma_ocupacao_reservada` tinha sido trancada a `service_role` a 2026-06-03, o
pessoal de secretaria ficou sem `EXECUTE`. **O radar devolvia 500 desde 2026-07-18** — mais de
dois meses, sem ninguém ter tocado no código.

Correcção (migration `20270825130000`): embrulhar a contagem numa verificação de pertença
*dentro* da função, sem tocar na view. O `security_invoker` e o RLS continuam a fazer o
isolamento por escola.

### 06 — Duas opções que descartámos, e porquê

**Tirar o `security_invoker` da view** — não. A view não tem filtro de escola nenhum
(`SELECT … FROM turmas WHERE status_validacao = 'ativo'`). O isolamento vem inteiramente do
RLS a actuar como *caller*. Sem isso, a view correria como `postgres` e exporia a lista de
espera de **todas as escolas**, incluindo `nome_candidato`, que é PII.

**Dar `GRANT EXECUTE` a `authenticated` sem mais nada** — também não. A função é
`SECURITY DEFINER` e recebe `p_escola_id` como parâmetro, sem o validar. Isso abriria um
caminho directo de `.rpc()` pelo browser onde qualquer autenticado lê a ocupação de outra escola.

### 07 — Uma quase-regressão que a verificação apanhou

A primeira versão aplicada usava só `can_manage_school`. Mas num pedido com a **service role**
não há `auth.uid()`, portanto `is_super_admin()` e `check_super_admin_role()` devolvem `false`
— e a função passava a devolver `NULL`. Nos três endpoints públicos de admissão, que a chamam
com o cliente de service role, um `NULL` no gate de capacidade comporta-se como "sem limite":
durante alguns minutos a produção **deixou de travar turmas lotadas**. Pior do que o bug que
fui corrigir.

Corrigido com `is_internal_service_role()`, que testa `auth.role()` **e** o role real da
sessão. Só apareceu porque a bateria de testes incluía explicitamente `SET LOCAL role service_role`.

---

## 2. Acessos

### Git

Dois remotes. `origin` é o monorepo; `formacao` é um repositório **separado**.

```
origin    git@github.com:moxi-edtech/moxi-edtech.git
formacao  git@github.com:moxinexas-projects/moxi-formacao.git
```

O hook de pré-push é o `scripts/check-no-secrets.sh`. Modelo de varrimento: constrói a
**união dos caminhos alterados em todo o range do push** e faz grep de cada caminho em cada
commit. Por isso um *apagamento* arrasta blobs antigos para o scan, e corrigir num commit
posterior não resolve — a correcção tem de ficar fora do range, via squash.

### Vercel

CLI 48.10.0; token em `~/Library/Application Support/com.vercel.cli/auth.json`.

> **O `--scope` não é opcional.** Sem `--scope moxinexas-projects`, o CLI responde
> `Error: Deployment belongs to a different team`. Aplica-se a `promote`, `inspect`, `ls`.

```
vercel promote <deployment-url> --scope moxinexas-projects
```

| Projecto | projectId | Serve |
|---|---|---|
| `moxi-edtech-landing` | `prj_lY3RakaNlNRcimyoYBvn93EIFHfd` | klasse.ao |
| `moxi-edtech` | `prj_YjDBpI3emmjWUB5cF7K7IsV7oNFg` | app.klasse.ao (rootDirectory `apps/web`) |
| `moxi-edtech-auth` | `prj_V5wrRepX1kL1ORK11IWFCNoIkCS` | auth.klasse.ao |

Team: `moxinexas-projects` (`team_GkXi2qX0WmXpWQCLtnCWEcfN`). Para ver o que está em produção,
a API v6 aceita `projectId` + `teamId` + `target=production`.

### Base de dados (Supabase, produção)

Project ref `wjtifcpxxxotsbmvbgoq`, Postgres 17. Ligação pelo pooler:

```
PGPASSWORD='<password>' psql "host=aws-1-eu-north-1.pooler.supabase.com \
  port=6543 dbname=postgres user=postgres.wjtifcpxxxotsbmvbgoq sslmode=require"
```

*A password não está em ficheiro nenhum, de propósito — tem de ser dada outra vez.*

> **O `schema_migrations` não é fiável.** Já apareceram objectos que existiam na base e nunca
> ficaram registados — aplicados por outra via. Confiar no ledger dá conclusões erradas nos
> dois sentidos. Verifica sempre os **objectos reais** (`information_schema.tables`,
> `pg_proc`, `pg_trigger`). E `supabase db push` é perigoso aqui: tenta reaplicar tudo o que
> não está registado.

Nota de ambiente: o `psql` local é 14.17 e o servidor é 17.6 — **incompatíveis**, portanto
`pg_dump` não funciona. Para DDL aditivo, escreve um script de rollback explícito.

---

## 3. Armadilhas conhecidas

> **Nunca correr `pnpm build` com o dev a correr.**
> Partilham o mesmo `apps/web/.next/`. O build destrói os artefactos do dev server, que parte
> com `ENOENT … edge-instrumentation.js`. Para verificar código, usa `pnpm typecheck`.

> **O dev local aponta para a base de dados de PRODUÇÃO.**
> Tanto `apps/web/.env.development.local` como `apps/web/.env.local` têm o project ref
> `wjtifcpxxxotsbmvbgoq`. Não há sandbox nenhum. Nada de `DELETE`, nada de testes destrutivos
> "porque é dev" — é a mesma base que os clientes usam. Foi por isto que o log local do radar
> mostrou o erro de produção.

> **`service_role` não tem `auth.uid()`.**
> Qualquer verificação de autorização que dependa só de `is_super_admin()`,
> `check_super_admin_role()` ou `can_manage_school()` devolve `false` no caminho service role —
> *sem erro*. O sintoma não é "deixou de funcionar", é "deixou de bloquear". Usa
> `is_internal_service_role()` e testa com `SET LOCAL role service_role`, não só com um JWT
> de utilizador.

> **Um push a uma branch é sempre Preview.**
> O `productionBranch` é `main` e o `main` está parado, portanto nada chega à produção sem
> promoção manual. O `main` continuar parado é estrutural — decisão do utilizador, não um bug.

---

## 4. O que sei do KLASSE

Monorepo *pnpm workspaces*, quatro aplicações:

| Pasta | Serve | Âmbito |
|---|---|---|
| `apps/web` | app.klasse.ao | O produto: secretaria, financeiro, professor, aluno |
| `apps/landing` | klasse.ao | Site comercial, App Router |
| `apps/auth` | auth.klasse.ao | Login |
| `apps/formacao` | — | **Fora de âmbito. Não tocar.** |

O contrato de engenharia está em `AGENTS.md` — versão 2.0.0, com autoridade sobre qualquer
opinião de agente ou de dev. Define formato obrigatório de evidência para findings, contrato
de PASS, regras numeradas (SEC-001…005, PERF-001…004, CACHE-001/002), tabela de excepções de
cache, matriz de MVs obrigatórias, e as regras do Agent 3 (executor, que nunca corre SQL
destrutivo sem aprovação). **Não há `CLAUDE.md`** — é só o `AGENTS.md`.

### Modelo de dados e segurança

- **Multi-tenant por escola.** Praticamente tudo tem `escola_id`.
- **RLS** em quase todas as tabelas. Views com `security_invoker = true` executam como
  *caller*; as restantes como *owner*. Isto muda tudo ao diagnosticar permissões.
- Helpers de autorização em `public`: `can_manage_school(p_escola_id)`,
  `user_has_role_in_school(escola, roles[])`, `is_internal_service_role()`, `safe_auth_uid()`,
  `current_user_role()`.
  **Expansão não óbvia** do `user_has_role_in_school`: pedir `'admin'` também casa com
  `admin_financeiro`; pedir `'secretaria'` casa com `secretaria_financeiro`. Vale a pena
  conhecê-la antes de raciocinar sobre guardas de rota.
- **Papéis** em `apps/web/src/lib/roles.ts`, agrupados em constantes como
  `K12_SECRETARIA_OPERACIONAL_ROLE_GROUP`.
- **MVs** para os dashboards, com matriz obrigatória no `AGENTS.md` (MV + UNIQUE INDEX +
  refresh fn + wrapper + cron).

### Assistente de IA

Existe e já responde a perguntas como "quantos alunos estão em dívida?". O código vive em
`apps/web/src/lib/assistant/` — inclui uma knowledge base (`knowledge-base-data.json`) e
documentos por área (`manual-secretaria.md`, `regras-negocio-secretaria.md`). É o alvo da
próxima sessão, e **ainda não foi estudado em profundidade: a primeira tarefa lá é mapear
como funciona, não assumir.**

---

## 5. Pendências conhecidas

| Item | Estado | Nota |
|---|---|---|
| Formulário de ebook do landing | **testar** | `/api/ebook-leads` apontava para uma tabela inexistente. Foi criada nesta sessão — falta submeter o formulário a sério. |
| `klasse.ao/login` | 404 | O CTA "Entrar" das 6 páginas SEO aponta para uma rota que não existe. O utilizador disse para deixar. |
| 7 rotas do landing sem links | aberto | Existem e respondem, mas nada no site aponta para elas. |
| `Província de Cubango` | aberto | O rodapé diz *de*, as páginas legais dizem *do*. |
| `main` parado desde 2026-08-18 | estrutural | Todo o trabalho novo vai para Preview e precisa de promoção manual. |

> **Ficheiros no working tree que NÃO são desta sessão.** Ficaram por commitar em
> `apps/landing` (HeroSection, globals.css, package.json, `pnpm-lock.yaml`, e os novos
> `LaptopPreview`/`LaptopScene` com o `.glb` e o `draco/`), mais `docs/audits/` e
> `docs/sprints/` por rastrear. Não foram varridos para nenhum commit e **não devem ser
> varridos sem intenção explícita.**

---

## 6. Âmbito da próxima sessão

Validação end-to-end do fluxo de uma **demonstração comercial**, usando **exclusivamente** a
escola de teste "Escola KLASSE", mais a expansão do **assistente de IA** para perguntas
operacionais de direcção (financeiro, académico, estrutura escolar).

Regras que delimitam esse trabalho, para uma sessão nova as respeitar sem precisar do prompt inteiro:

- Nenhum dado de outras escolas. Nada de alterar dados de produção de clientes.
- Nunca contornar RLS ou permissões só para um teste passar. Nunca desactivar RLS.
- Nunca usar service role no cliente.
- Se for preciso criar dados de teste, só na Escola KLASSE, e identificar claramente o que foi criado.
- Não simular sucesso — executar os fluxos a sério. Identificar a causa real antes de mexer em código.
- Nada de alterar preços, planos ou regras comerciais. Nada de refactorizar fora de âmbito.
- Para perguntas da IA: determinar o resultado esperado na base **à mão** primeiro, executar
  pelo fluxo real, comparar. Duas variações naturais de cada pergunta.
- Nenhuma consulta aceita `escola_id` vindo da mensagem do utilizador — o contexto autenticado
  é que o determina.

E a entrega que interessa mais do que o "sim, funciona": **a lista concreta de registos a usar
na demonstração** — que aluno pesquisar, que turma abrir, que professor mostrar, que documento
emitir, que período tem os dados mais completos. O objectivo é eliminar improviso na reunião.
