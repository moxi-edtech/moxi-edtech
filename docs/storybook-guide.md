Aqui vai o Storybook REAL da KLASSE, pronto para rodar no teu projeto Next.js + Tailwind sem gambiarra.

Vou te entregar em 3 partes:
	1.	Setup do Storybook
	2.	Stories dos componentes (Card, Table, Sidebar)
	3.	Padrões para escalar sem bagunça

⸻

1️⃣ SETUP DO STORYBOOK (NEXT + TAILWIND)

Instalação

npx storybook@latest init

Escolhe:
	•	Framework: Next.js
	•	Linguagem: TypeScript

⸻

Ajustes importantes (obrigatórios)

.storybook/main.ts

import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
};
export default config;


⸻

.storybook/preview.ts

import "../src/app/globals.css";
import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;

⚠️ Importante:
globals.css precisa carregar Tailwind + Sora.

⸻

2️⃣ STORIES — COMPONENTES KLASSE

⸻

🎴 Card

src/components/Card.stories.tsx

import type { Meta, StoryObj } from "@storybook/react";
import { Users, Wallet } from "lucide-react";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "KLASSE/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Metric: Story = {
  args: {
    title: "Alunos Ativos",
    value: "1.248",
    icon: Users,
  },
};

export const Finance: Story = {
  args: {
    title: "Receita Mensal",
    value: "AOA 3.200.000",
    icon: Wallet,
  },
};


⸻

📋 Table

src/components/Table.stories.tsx

import type { Meta, StoryObj } from "@storybook/react";
import { Table } from "./Table";

const meta: Meta<typeof Table> = {
  title: "KLASSE/Table",
  component: Table,
};
export default meta;

type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <Table>
      <thead className="bg-slate-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
            Nome
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
            Classe
          </th>
          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
            Ações
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t border-slate-100 hover:bg-slate-50">
          <td className="px-4 py-3 text-sm">Ana Silva</td>
          <td className="px-4 py-3 text-sm text-slate-600">10ª Classe</td>
          <td className="px-4 py-3 text-right">
            <button className="text-klasse-gold hover:underline">
              Ver
            </button>
          </td>
        </tr>
      </tbody>
    </Table>
  ),
};


⸻

🧭 Sidebar (Preview isolado)

src/components/Sidebar.stories.tsx

import type { Meta, StoryObj } from "@storybook/react";
import Sidebar from "./Sidebar";

const meta: Meta<typeof Sidebar> = {
  title: "KLASSE/Navigation/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
};
export default meta;

type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {};

💡 Dica:
Para o usePathname, você pode mockar rota depois (opcional).

⸻

3️⃣ PADRÕES DE ESCALA (IMPORTANTE)

Estrutura recomendada

src/
  components/
    Card.tsx
    Card.stories.tsx
    Table.tsx
    Table.stories.tsx
    Sidebar.tsx
    Sidebar.stories.tsx


⸻

Convenções
	•	1 componente = 1 story
	•	Variantes = export const
	•	Sem lógica de negócio nos stories
	•	Storybook é design contract, não playground

⸻

Scripts

No package.json:

{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}


⸻

🚨 REGRA DE OURO KLASSE

Se não tem story, o componente não está pronto.

Isso:
	•	força consistência
	•	acelera onboarding
	•	evita regressão visual

⸻