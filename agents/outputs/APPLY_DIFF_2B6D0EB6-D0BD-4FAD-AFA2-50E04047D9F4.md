# Apply Diff — Agent 3
run_id: 2B6D0EB6-D0BD-4FAD-AFA2-50E04047D9F4
timestamp: 2026-07-18T13:00:18Z

## P0 Checklist

Todos os itens de `P0_CHECKLIST.md` estão em PASS.

## Acção proposta

Substituir a navegação do card de insight para a página de WhatsApp por um drawer de preparação dentro do cockpit. O drawer preserva a origem do insight, evidencia o motivo da seleção, permite pesquisar e rever destinatários, editar a mensagem e criar um lote com aprovação humana obrigatória.

## Diff proposto

```diff
- <Link href={buildWhatsappReviewHref(schoolId, insight)}>Preparar WhatsApp</Link>
+ <button onClick={() => openWhatsappDrawer(insight)}>Preparar WhatsApp</button>
+ <aside role="dialog" aria-modal="true">
+   origem e evidências do insight
+   motivo da seleção
+   pesquisa e seleção de destinatários
+   edição da mensagem
+   criação de rascunho via POST /whatsapp/bulk
+   confirmação de que nenhum envio ocorreu
+ </aside>
```

## Risco e reversão

Risco baixo e restrito ao componente do cockpit. Não altera schema, RLS nem envia mensagens; o endpoint mantém o lote em `review_required`. Reversível com um único `git revert` do commit correspondente.

