# Plano de Refatoração — Login por número (alunos)

## Objetivo
Padronizar o `numero_login` dos alunos com prefixo baseado no **nome da escola**, mantendo e-mail como login principal para staff e evitando regressões no contador de matrícula.

## Escopo
- Backend (Supabase functions/migrations)
- Fluxo de criação de aluno/matrícula
- UI/UX para exibir credenciais
- Migração de dados legados

## Estratégia de Identificador
- Prefixo derivado do **nome da escola**.
- Formato: `SIGLA-YY-NNNN…` com **padding dinâmico** (4–6 dígitos conforme volume).
- `numero_login` apenas para **alunos**; staff usa e-mail.

## Etapas
1. **Definir gerador de sigla**
   - Regras: remover stopwords (de/da/do/dos/das/e/a/o), remover acentos, uppercase.
   - Ex.: “Colégio São João” → `CSJ`, “Escola Classe” → `ESC`.

2. **Atualizar função `generate_unique_numero_login`**
   - Substituir `LPAD(..., 4)` por padding dinâmico:
     - `<= 9.999` → 4 dígitos
     - `<= 99.999` → 5 dígitos
     - acima → 6 dígitos
   - Manter faixas por role, mas aplicar apenas para alunos.

3. **Novo helper de prefixo por escola**
   - RPC ou função SQL `get_escola_sigla(escola_id)`.
   - Usado na criação de `numero_login`.

4. **Fluxo de criação de aluno/matrícula**
   - Garantir que apenas alunos recebam `numero_login`.
   - Não preencher `numero_login` para staff.

5. **Migração de dados legados**
   - Limpar `numero_login` inválido (texto/e-mail) — já iniciado.
   - Opcional: backfill de alunos sem `numero_login` com novo padrão.

6. **UI/Comunicação**
   - Exibir `numero_login` e senha temporária na criação.
   - Email/SMS com credenciais apenas para alunos.

7. **Testes/Validação**
   - Testar criação de aluno, matrícula e login com `numero_login`.
   - Validar rollover para 10k+ alunos.

## Entregáveis
- Migration com função `get_escola_sigla`.
- Update em `generate_unique_numero_login`.
- Ajustes no fluxo de criação de aluno.
- Backfill opcional para alunos sem `numero_login`.

