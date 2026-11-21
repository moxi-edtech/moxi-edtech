# #416 — Isolamento do histórico de importações pela escola ativa

## Causa raiz
A antiga `/api/migracao/historico` reunia os IDs de todas as escolas vinculadas ao utilizador e consultava `import_migrations` com `.in("escola_id", escolaIds)`. A UI apresentava o resultado como pertencente à escola atual. Os endpoints por ID de importação também só verificavam vínculo à escola do registo, sem exigir que a operação estivesse no âmbito de escola selecionado.

## Contrato corrigido
- Cliente passa `escola_id` da escola ativa em listagem, detalhe, erros, PATCH e DELETE.
- Servidor valida UUID, resolve e autoriza a escola explicitamente solicitada e exige papel operacional de Secretaria/Admin/Direção; o `escola_id` fornecido nunca é aceite como autorização.
- As consultas e mutações em `import_migrations` aplicam `.eq("escola_id", escolaId)`. As consultas de erros verificam primeiro a importação dentro desse âmbito.
- Sem escola explícita, as rotas de compatibilidade resolvem a escola selecionada no servidor e nunca consultam simultaneamente todas as escolas vinculadas.
- O cliente não mostra linhas do tenant anterior durante a troca; pedidos anteriores são abortados.
- Cursor validado antes de compor filtros PostgREST; preserva microssegundos e busca uma linha extra para determinar `next_cursor` sem criar páginas fantasmas.

## Segurança e compatibilidade
Sem alterações de schema, RLS, migration, tabelas, status de importação ou meios de pagamento. A autorização explícita por papel pode bloquear acessos que antes dependiam apenas de perfil/vínculo sem permissão operacional — comportamento intencional.

## Homologação
Testar utilizador com duas escolas e troca de escola ativa, perfis sem autorização, links antigos sem escola explícita, cursor inválido, exatamente 30/50 registos, renomear/excluir e acesso direto a importação de outra escola. CI deve passar. Confirmar que `main` e Vercel têm o commit após integração antes de declarar produção.
