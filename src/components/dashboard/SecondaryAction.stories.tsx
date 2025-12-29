import type { Meta, StoryObj } from "@storybook/react";
import { Users, Upload } from "lucide-react";
import { SecondaryAction } from "./SecondaryAction";

const meta: Meta<typeof SecondaryAction> = {
  title: "KLASSE/Dashboard/SecondaryAction",
  component: SecondaryAction,
};
export default meta;

type Story = StoryObj<typeof SecondaryAction>;

export const Default: Story = {
  args: {
    icon: Users,
    label: "Alunos",
    href: "#",
  },
};

export const Highlight: Story = {
  args: {
    icon: Upload,
    label: "Migração",
    href: "#",
    highlight: true,
  },
};
