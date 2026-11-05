# KLASSE — tema de produto

> **Escopo deste documento:** identidade visual do KLASSE.
> As fundações, a anatomia dos componentes e os patterns partilhados entre produtos
> são definidos em `docs/design-system/MOXI_UI_SYSTEM_V1.md`. O pacote
> `@moxi/design-tokens` é a SSOT executável.
>
> Este ficheiro **não** deve criar regras próprias de radius, elevação, spacing ou
> hierarquia que contradigam o Moxi UI.

## 1. Brand core

### Verde — marca

- `--klasse-green-500: #1F6B3B`
- `--klasse-green-700: #124329`
- `--klasse-green-900: #061B15`

Uso:
- marca;
- headings de identidade quando necessário;
- elementos institucionais;
- navegação de marca.

Verde de marca não substitui automaticamente o estado semântico `success`.

### Dourado — ação

- `--klasse-gold-400: #E3B23C`
- `--klasse-gold-500: #C79A2F`
- `--klasse-gold-700: #755819`

Uso:
- CTA primário;
- item ativo;
- foco;
- seleção.

Dourado não é fundo de página nem decoração genérica.

### Neutros

O KLASSE usa a escala Slate partilhada pela camada Moxi para texto, superfície,
bordas e navegação escura.

- `slate-50: #f8fafc`
- `slate-200: #e2e8f0`
- `slate-500: #64748b`
- `slate-800: #1e293b`
- `slate-900: #0f172a`
- `slate-950: #020617`

## 2. Tipografia

- Sans: **Sora**
- Mono: **Geist Mono** ou fallback monospace

A escala de UI segue os papéis do Moxi UI:

- caption: 12px;
- body-sm: 14px;
- body: 16px;
- title-sm: 18px;
- title: 24px;
- display: 32px quando realmente necessário.

Pesos preferidos:
- corpo: 400;
- apoio/subhead: 500;
- títulos: 600;
- 700 apenas para ênfase real.

`font-black` não deve ser usado como mecanismo normal de hierarquia.

## 3. Navegação

Sidebar expandida: 256px.
Sidebar recolhida: 80px.

Tema:
- fundo: slate-950;
- hover: slate-900/70;
- ativo: slate-900 + ring dourado;
- ícone normal: slate-400;
- ícone ativo: dourado.

A anatomia e comportamento da navegação seguem o pattern Moxi; estes valores apenas
definem o tema KLASSE.

## 4. Botão primário KLASSE

O botão `primary` do Moxi UI mapeia para:

- background: klasse-gold-400;
- texto: branco;
- hover: klasse-gold-500 / brightness equivalente;
- focus: dourado com halo acessível.

Só deve existir uma ação primária por região/tarefa.

## 5. Focus

O foco KLASSE usa a cor de ação, mas segue o contrato de acessibilidade Moxi:

- sempre visível para navegação por teclado;
- não depender apenas de mudança de cor;
- não ser removido por feature code.

## 6. Iconografia

Biblioteca do produto: **Lucide React**.

Tamanhos recomendados:
- navegação: 20px;
- botão: 16px;
- cards/áreas de apoio: 16–20px conforme densidade.

No desktop, ações importantes não usam ícone isolado sem label acessível.

## 7. Branding angolano

Elementos culturais/padrões podem aparecer em branding, campanhas, login, capas,
hero e materiais de comunicação.

Não usar padrões decorativos em:
- tabelas;
- formulários;
- cards operacionais;
- dashboards;
- fluxos financeiros/académicos.

## 8. Radius, cards e sombras

Estas decisões **não são mais específicas do KLASSE**.

Usar os papéis Moxi:
- compact;
- control;
- surface;
- surface-large;
- overlay;
- pill.

Card estático é flat por padrão. Hover com elevação só existe em superfície
interativa.

Os antigos recipes `klasseSurface.*` continuam exportados apenas para
compatibilidade durante a migração. Código novo deve preferir `moxiSurface.*`.

## 9. Motion

Motion de produto deve ser curto, funcional e respeitar
`prefers-reduced-motion`.

Usar a escala Moxi:
- fast: 120ms;
- standard: 180ms;
- slow: 260ms.

Animações de marketing podem ter regras próprias fora da UI operacional.

## 10. Regras de produto

### Fazer

- preservar alto contraste e leitura rápida;
- usar dourado para ação/seleção;
- usar verde para identidade;
- usar estados semânticos para sucesso, aviso e erro;
- reutilizar patterns Moxi antes de criar composição local.

### Não fazer

- introduzir uma nova cor apenas para um componente;
- criar radius arbitrário em feature code;
- criar sombra decorativa;
- usar várias ações primárias na mesma tarefa;
- misturar Inter/Poppins/Sora dentro da UI operacional;
- transformar cada grupo de conteúdo num card.

## 11. Referências canónicas

- `docs/design-system/MOXI_UI_SYSTEM_V1.md`
- `docs/design-system/MOXI_UI_INVENTORY_2026-10-06.md`
- `docs/design-system/MOXI_UI_MIGRATION_PLAN.md`
- `packages/design-tokens/src/index.ts`
