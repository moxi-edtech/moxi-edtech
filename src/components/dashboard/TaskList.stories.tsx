import type { Meta, StoryObj } from "@storybook/react";
import { TaskList } from "./TaskList";

const meta: Meta<typeof TaskList> = {
  title: "KLASSE/Dashboard/TaskList",
  component: TaskList,
};
export default meta;

type Story = StoryObj<typeof TaskList>;

export const WithTasks: Story = {
  args: {
    items: [
      {
        id: "1",
        created_at: new Date().toISOString(),
        aluno: { nome: "Ana Silva" },
        turma: { nome: "10ª Classe A" },
      },
      {
        id: "2",
        created_at: new Date().toISOString(),
        aluno: { nome: "João Manuel" },
        turma: { nome: "11ª Classe B" },
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};
