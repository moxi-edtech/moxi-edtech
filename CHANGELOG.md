# Changelog

Todas as mudanças notáveis neste repositório serão documentadas aqui.

## 2025-11-23

Principais alterações já mescladas no branch `main`:

- API/Backend (Next.js routes):
  - Escola Admin: alunos (listar, detalhes, arquivar/restaurar), professores, turmas, notas.
  - Secretaria: alunos (CRUD e restore/hard-delete), turmas (atribuir professor, disciplinas), rematrícula (confirmar/sugestões).
  - Professor: presenças, notas, atribuições.
  - Financeiro: dashboards e aberto por mês.

- Frontend (páginas):
  - Painéis de Escola Admin (alunos, professores, turmas, notas).
  - Portal do Professor (layout, frequências, notas).
  - Portal da Secretaria (detalhe/edição de aluno, matrículas melhorias).

- Banco (Supabase):
  - Várias migrações para relacionamentos, RLS, gatilhos de sincronização e normalização de status (alunos/matrículas), índices e views financeiras/acadêmicas.

- Infra/Dev:
  - Adição de `docker-compose.yml`, `Dockerfile` do app web e scripts utilitários (dump/restore/pull do banco).
  - Documentação: sincronização de alunos e instruções de `supabase remote pull`.
  - `.gitignore`: ignorado `.pnpm-store/` para evitar arquivos grandes no repositório.
  - Removido `package-lock.json` em favor de `pnpm`.

Observação: as mudanças acima já foram aplicadas diretamente em `main`. Se desejarmos revisão via PR para documentação/ajustes futuros, podemos abrir PRs incrementais.

