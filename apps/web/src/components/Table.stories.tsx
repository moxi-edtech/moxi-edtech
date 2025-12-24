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