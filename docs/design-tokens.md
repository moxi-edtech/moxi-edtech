Aqui vai o Design Tokens Doc (Markdown) da KLASSE, pronto pra virar docs/design-tokens.md no repo.

⸻

KLASSE Design Tokens

Objetivo: consistência visual e velocidade de desenvolvimento.
Regra: UI enterprise (limpa), com identidade local (verde + dourado) sem poluição.

1) Brand Core

Cores oficiais

Primary (Verde Bandeira)
	•	--klasse-green-500: #1F6B3B
	•	--klasse-green-700: #124329
	•	--klasse-green-900: #061B15

Accent (Dourado Institucional)
	•	--klasse-gold-400: #E3B23C
	•	--klasse-gold-500: #C79A2F
	•	--klasse-gold-700: #755819

Neutros (UI)
	•	--slate-50: #f8fafc
	•	--slate-200: #e2e8f0
	•	--slate-500: #64748b
	•	--slate-800: #1e293b
	•	--slate-900: #0f172a
	•	--slate-950: #020617

Uso recomendado
	•	Sidebar/Navigation: slate-950 + slate-900 (itens)
	•	CTA primário: klasse-gold-400
	•	Acento/ativo: klasse-gold-400 (ícone, ring, underline)
	•	Marca (títulos/links): klasse-green-500

Regras anti-bagunça
	•	Dourado = ação/destaque, não fundo de tela.
	•	Verde = marca, não cor de alert.
	•	Padrão angolano = branding only (login, capa, hero, impressos), não em tabelas.

⸻

2) Typography

Fonte oficial
	•	Sans: Sora
	•	Mono: Geist Mono (ou fallback monospace)

Escala recomendada (UI)
	•	text-xs (12px): hints, labels fracos
	•	text-sm (14px): corpo, tabelas
	•	text-base (16px): formulários
	•	text-lg (18px): headings pequenos
	•	text-2xl (24px): títulos de página

Peso
	•	Body: 400
	•	Subhead: 500
	•	Títulos: 600
	•	Destaques: 700 (uso raro)

⸻

3) Layout & Spacing

Grid / container
	•	Page padding: p-4 md:p-6
	•	Max content: max-w-[1200px] (quando centralizar)

Sidebar
	•	Expanded: 256px
	•	Collapsed: 80px

Tokens CSS (layout)

:root {
  --sidebar-expanded: 256px;
  --sidebar-collapsed: 80px;
}


⸻

4) Radius / Shapes

Radius padrão
	•	Cards/Inputs: rounded-xl
	•	Botões grandes: rounded-xl
	•	Chips/Badges: rounded-full
	•	Modals: rounded-2xl

Regra: evite rounded-md (parece genérico).

⸻

5) Borders / Rings (Enterprise look)

Borda padrão
	•	Light UI: border-slate-200/70
	•	Dark UI: border-slate-800/80

Focus ring padrão (acessível)
	•	focus:ring-4 focus:ring-klasse-gold/20
	•	Inputs: focus:border-klasse-gold

Ativo (sidebar)
	•	ring-1 ring-klasse-gold/25

⸻

6) Shadows

Use pouco.
	•	Cards: shadow-sm
	•	Modals: shadow-xl (raro)

Evitar sombras fortes em sidebar/table.

⸻

7) Buttons

Primary (CTA)
	•	Background: klasse-gold-400
	•	Text: white
	•	Hover: brightness-95
	•	Focus ring: gold 20%

Exemplo:

className="bg-klasse-gold text-white hover:brightness-95 focus:ring-4 focus:ring-klasse-gold/20"

Secondary
	•	Background: white
	•	Border: slate-200
	•	Text: slate-900

Ghost
	•	Background: transparent
	•	Hover: slate-50 (light) / slate-900/70 (dark)

Destructive
	•	bg-red-600 text-white hover:bg-red-700

⸻

8) Inputs

Padrão:
	•	rounded-xl
	•	border-slate-200
	•	focus:ring-4 focus:ring-klasse-gold/20
	•	focus:border-klasse-gold

⸻

9) Navigation (Sidebar)
	•	Base: bg-slate-950 text-slate-100
	•	Item hover: bg-slate-900/70
	•	Item active: bg-slate-900 ring-1 ring-klasse-gold/25
	•	Icon default: text-slate-400
	•	Icon active/hover: text-klasse-gold

⸻

10) Icons

Biblioteca oficial
	•	Lucide

Tamanhos:
	•	Sidebar: h-5 w-5
	•	Botões: h-4 w-4
	•	Cards: h-6 w-6

Cores:
	•	Default: text-slate-400
	•	Active/hover: text-klasse-gold

⸻

11) Motion (Animação enterprise)

Princípios:
	•	Curta (400–650ms)
	•	Pequeno deslocamento (8–14px)
	•	Respeitar prefers-reduced-motion

Tokens:
	•	klasse-fade-in
	•	klasse-fade-up

⸻

12) Do / Don’t

✅ Fazer
	•	UI limpa, muito espaço, poucos acentos
	•	Dourado só em CTA e ativo
	•	Verde em headings e marca

❌ Não fazer
	•	Padrão africano em tabelas/cards
	•	Dourado como fundo de página
	•	Misturar fontes (Inter/Poppins) no app

⸻

Implementação rápida (Tailwind)
	•	tailwind.config.js: tokens klasse.green, klasse.gold
	•	next/font: carregar Sora e aplicar no body