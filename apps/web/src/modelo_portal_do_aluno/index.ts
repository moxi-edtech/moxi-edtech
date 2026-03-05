// src/components/aluno/index.ts
// Exportações centralizadas — importa só o que precisas

// Layout
export { AlunoHeader }    from "./layout/AlunoHeader";
export { AlunoBottomNav } from "./layout/AlunoBottomNav";

// Tabs
export { TabHome }         from "./tabs/TabHome";
export { TabNotas }        from "./tabs/TabNotas";
export { TabFinanceiro }   from "./tabs/TabFinanceiro";
export { TabDocumentos }   from "./tabs/TabDocumentos";
export { TabNotificacoes } from "./tabs/TabNotificacoes";

// Shared
export { AlunoCard }    from "./shared/AlunoCard";
export { AlunoAvatar }  from "./shared/AlunoAvatar";
export { NotaBar }      from "./shared/NotaBar";
export { Pill }         from "./shared/Pill";
export { SectionTitle } from "./shared/SectionTitle";

// Utils + Types
export * from "./utils";
export type * from "./types";
