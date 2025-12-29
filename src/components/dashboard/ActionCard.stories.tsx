import type { Meta, StoryObj } from "@storybook/react";
import { UserPlus, FileText } from "lucide-react";
import { ActionCard } from "./ActionCard";

const meta: Meta<typeof ActionCard> = {
  title: "KLASSE/Dashboard/ActionCard",
  component: ActionCard,
};
export default meta;

type Story = StoryObj<typeof ActionCard>;

export const Default: Story = {
  args: {
    title: "Matricular",
    sub: "Novo ou confirmação",
    icon: UserPlus,
    href: "#",
  },
};

export const Secondary: Story = {
  args: {
    title: "Emitir Declaração",
    sub: "Com ou sem notas",
    icon: FileText,
    href: "#",
  },
};
