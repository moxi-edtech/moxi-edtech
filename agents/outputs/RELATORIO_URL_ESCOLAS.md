# Relatório — URLs de Escola (UUID vs Slug/Subdomínio)

Data: 2026-03-06

## Situação actual
- URL pública inclui UUID de escola:
  - Exemplo: `https://klasse.ao/escola/<uuid>/admin/dashboard`

## Riscos / impactos
- UX fraca (URL longa e pouco memorizável).
- Exposição de identificadores internos (UUIDs).
- Facilita tentativa de enumeração/força bruta em rotas públicas.
- Reduz qualidade de SEO (quando aplicável).

## Alternativas recomendadas
1) **Subdomínio por escola**
   - `https://{slug}.klasse.ao/admin/dashboard`
   - Melhor isolamento por portal e mais profissional.

2) **Slug em path**
   - `https://klasse.ao/escola/{slug}/admin/dashboard`
   - Menos mudança infra, ainda evita UUID exposto.

## Recomendação principal
- **Subdomínio por escola** (ideal para multi‑tenant).

## Plano de migração sugerido (alto nível)
1) Criar coluna `slug` em `escolas` (único, normalizado, obrigatório).
2) Criar resolução `slug → escola_id` no backend.
3) Ajustar rotas para aceitar `{slug}` e redirecionar `{uuid}` antigo.
4) Atualizar links internos e emails.
5) Configurar wildcard DNS (`*.klasse.ao`) para Vercel.

## Notas
- Se houver documentos públicos ou QR codes, manter compatibilidade por 6–12 meses com redirect.
- Expor UUID apenas em APIs privadas/authenticated quando necessário.
