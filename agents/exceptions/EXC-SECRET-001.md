# Excepção EXC-SECRET-001

regra:        check-no-secrets.sh — alternativa do SECRET_REGEX que procura a chave de service role
ficheiro:     scripts/check-no-secrets.sh
motivo:       `service_role` é simultaneamente o nome de uma role do Postgres e o nome de uma chave do
              Supabase. A regra do scanner procura a chave: procura o nome da role seguido de oito ou
              mais caracteres não-espaço. Mas o nome da role também aparece nos dumps de ACL e de
              permissões, cujas linhas são `schema|objecto|tipo|role|privilégios` — por exemplo
              `public|curso_professor_responsavel|r|service_role|DELETE,INSERT,REFERENCES,...` — e na
              forma de catálogo `{postgres=X/postgres,service_role=X/postgres}`. Um dump de permissões
              passa a ser lido como credencial e o push é rejeitado.

              A alternativa acrescentada ao ALLOWLIST_REGEX cobre exclusivamente essas duas formas de
              dump: o nome da role seguido de barra vertical e maiúsculas ou vírgulas, ou seguido de
              igual e alfanuméricos ou barras. Uma chave a sério vem em base64/JWT e nunca traz barra
              vertical nem igual a seguir ao nome, pelo que o controlo se mantém intacto para chaves
              reais.

              Âmbito medido, no range por pushar: 97 linhas em 3 ficheiros, todos em `agents/outputs/`
              (`security_inspection_2026-04-23/object_grants.txt`,
              `security_inspection_2026-04-24/preflight_live.txt`,
              `APPLY_RESULT_0E959564-CEF4-4AB7-8A00-E617BEE19269.md`). Os três já estavam publicados no
              remoto, adicionados pelo commit `1a2f8881b`, que já tinha sido pushado. Verificados 0
              segredos reais nos três: sem JWT, sem chave privada, sem URL de base de dados com palavra
              passe. A alternativa foi testada contra as 97 linhas reais e deixou 0 remanescentes.

              Contexto do bloqueio: estes ficheiros só entraram no conjunto analisado porque o commit
              `78e8ae467` os apagou. Um apagamento põe o path no conjunto de ficheiros a analisar, e o
              hook passa a fazer pesquisa desse path nos commits mais antigos do range, onde o ficheiro
              ainda existia.
aprovado_por: moxi-edtech (utilizador) — autorização explícita dada em sessão a 2026-09-23,
              nomeando o ficheiro, o controlo de pré-push e as duas alterações concretas.
              Não é auto-aprovação do agente.
data:         2026-09-23
expira_em:    permanente
