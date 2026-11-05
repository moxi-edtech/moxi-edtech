// eslint-disable-next-line storybook/no-renderer-packages -- Storybook 8 Next adapter does not export these types.
import type { Meta, StoryObj } from "@storybook/react";
import { BalcaoAcademicOperations } from "./BalcaoAcademicOperations";
const meta = {
  title: "Secretaria/Balcão/Operações académicas",
  component: BalcaoAcademicOperations,
  args: { matriculaId: "60000000-0000-4000-8000-000000000001", onRecheck: async () => ({ ok: true }), onLancarNota: () => undefined },
} satisfies Meta<typeof BalcaoAcademicOperations>;
export default meta;
type Story = StoryObj<typeof meta>;
/** The initial state does not fetch data until the operator opens the panel. */
export const Recolhido: Story = {};
