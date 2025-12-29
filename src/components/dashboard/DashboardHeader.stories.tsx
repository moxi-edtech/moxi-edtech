import type { Meta, StoryObj } from "@storybook/react";
import { DashboardHeader } from "./DashboardHeader";
import Link from "next/link";

const meta: Meta<typeof DashboardHeader> = {
  title: "KLASSE/Dashboard/DashboardHeader",
  component: DashboardHeader,
};
export default meta;

type Story = StoryObj<typeof DashboardHeader>;

export const Default: Story = {
  args: {
    title: "Secretaria",
    description: "Resumo operacional do dia",
    breadcrumbs: [
      { label: "Início", href: "/" },
      { label: "Secretaria" },
    ],
  },
};

export const WithActions: Story = {
  args: {
    title: "Secretaria",
    description: "Resumo operacional do dia",
    breadcrumbs: [{ label: "Secretaria" }],
    actions: (
      <Link
        href="#"
        className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white"
      >
        Nova Matrícula
      </Link>
    ),
  },
};
