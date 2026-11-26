import type { Meta, StoryObj } from "@storybook/react";
import { EstadoVitalBanner } from "./EstadoVitalBanner";

const meta = {
  title: "KLASSE/Dashboards/Contexto académico",
  component: EstadoVitalBanner,
  args: {
    compact: true,
    calendarHref: "/secretaria/calendario",
    showSignature: false,
    estado: {
      escola_id: "escola-exemplo",
      session_id: "ano-exemplo",
      ano_ativo: 2026,
      periodo_id: "periodo-exemplo",
      periodo_tipo: "TRIMESTRE",
      periodo_numero: 1,
      hoje_bloqueado_pedagogico: false,
      evento_hoje_nome: null,
      fase_operacional: "REGULAR",
    },
  },
} satisfies Meta<typeof EstadoVitalBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secretaria: Story = {};
export const Operacoes: Story = {
  args: { showSignature: true, calendarHref: "/operacoes/calendario" },
};
export const Interrupcao: Story = {
  args: {
    estado: {
      ...meta.args.estado,
      hoje_bloqueado_pedagogico: true,
      evento_hoje_nome: "Interrupção lectiva",
    },
  },
};
export const EventoDoDia: Story = {
  args: {
    estado: {
      ...meta.args.estado,
      evento_hoje_nome: "Reunião de encarregados",
    },
  },
};
