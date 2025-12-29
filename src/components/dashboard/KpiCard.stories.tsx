import type { Meta, StoryObj } from "@storybook/react";
import { Users, AlertCircle, UserPlus } from "lucide-react";
import { KpiCard } from "./KpiCard";

const meta: Meta<typeof KpiCard> = {
  title: "KLASSE/Dashboard/KpiCard",
  component: KpiCard,
};
export default meta;

type Story = StoryObj<typeof KpiCard>;

export const Default: Story = {
  args: {
    label: "Total Alunos",
    value: 1248,
    icon: Users,
  },
};

export const Success: Story = {
  args: {
    label: "Matrículas Hoje",
    value: 37,
    icon: UserPlus,
    variant: "success",
  },
};

export const Warning: Story = {
  args: {
    label: "Pendências",
    value: 12,
    icon: AlertCircle,
    variant: "warning",
  },
};
