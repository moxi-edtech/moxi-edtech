import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";

const meta: Meta<typeof Card> = {
  title: "KLASSE/Card",
  component: Card,
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Metric: Story = {
  render: () => (
    <Card>
      <CardHeader><CardTitle className="flex items-center justify-between text-sm">Alunos Ativos <Users className="h-5 w-5 text-muted-foreground" /></CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-semibold tabular-nums text-foreground">1.248</p></CardContent>
    </Card>
  ),
};

export const Finance: Story = {
  render: () => (
    <Card>
      <CardHeader><CardTitle className="flex items-center justify-between text-sm">Receita Mensal <Wallet className="h-5 w-5 text-muted-foreground" /></CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-semibold tabular-nums text-foreground">AOA 3.200.000</p></CardContent>
    </Card>
  ),
};
