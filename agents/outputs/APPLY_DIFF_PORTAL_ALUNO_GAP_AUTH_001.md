# Apply Diff — GAP-AUTH-001

data: 2026-06-04
finding: GAP-AUTH-001

## Ação

Fortalecer a alteração de senha no perfil do aluno.

## Diff proposto

```diff
- aceitar apenas nova senha com mínimo de 6 caracteres
- alterar senha usando somente a sessão existente
+ exigir senha atual
+ reautenticar o utilizador antes da alteração
+ exigir mínimo de 8 caracteres, maiúscula, minúscula, número e símbolo
+ registrar auditoria sem armazenar senhas
+ atualizar a UI com campo de senha atual e regras visíveis
```

## Risco

Utilizadores que não saibam a senha atual deverão usar o fluxo de recuperação de senha.

## Reversão

Reverter as alterações nos ficheiros da API e da aba Perfil.
