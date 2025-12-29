import type { Meta, StoryObj } from "@storybook/react";
import { NoticePanel } from "./NoticePanel";

const meta: Meta<typeof NoticePanel> = {
  title: "KLASSE/Dashboard/NoticePanel",
  component: NoticePanel,
};
export default meta;

type Story = StoryObj<typeof NoticePanel>;

export const WithNotices: Story = {
  args: {
    items: [
      {
        id: "1",
        titulo: "Atualização de Calendário",
        resumo: "O calendário escolar foi atualizado para o 3º trimestre.",
        data: new Date().toISOString(),
      },
      {
        id: "2",
        titulo: "Fecho de Pautas",
        resumo: "O prazo para lançamento de notas termina em 5 dias.",
        data: new Date().toISOString(),
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};
