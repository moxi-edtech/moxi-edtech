# Apply Diff — Entrada única de Cobranças no menu

run_id: D9D786D3-8DB3-4ABA-9FC3-0B3F594354E0  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/lib/sidebarNav.ts`

## Objetivo

Apontar Cobranças para a carteira consolidada e remover a entrada operacional redundante “Alunos e turmas”.

## Diff proposto

```diff
- /financeiro/radar → Cobranças
- /financeiro/turmas-alunos → Alunos e turmas (operacional)
+ /financeiro/cobrancas → Cobranças
```

O menu financeiro administrativo também passa a abrir a rota canónica em Cobranças. A gestão por turma permanece disponível dentro da nova tela.

## Risco

Baixo. As rotas legadas permanecem activas e acessíveis pela tela canónica.

## Reversão

Restaurar os dois destinos anteriores no menu.
