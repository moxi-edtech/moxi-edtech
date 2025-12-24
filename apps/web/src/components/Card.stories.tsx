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