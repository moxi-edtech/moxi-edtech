// apps/web/src/components/harmonia/types.ts

export type Passo = {
  id: string;
  label: string;
  desc: string;
  icone: string;
  destaque: boolean;
};

export type ContextoAcao = Record<string, any>;

export type ProximoPassoConfig = {
  titulo: string;
  subtitulo: (ctx: ContextoAcao) => string;
  passos: Passo[];
};

export type EstadoVazioConfig = {
  icone: string;
  titulo: string;
  desc: string;
  cor: string;
  bg: string;
  border: string;
  acao?: {
    label: string;
    id: string;
  };
};
