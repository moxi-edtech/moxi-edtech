export const klasseColors = {
  green: {
    DEFAULT: "#1F6B3B",
    50: "#ECF5EF",
    100: "#D1E7DA",
    200: "#A3CFB5",
    300: "#75B791",
    400: "#479F6C",
    500: "#1F6B3B",
    600: "#185732",
    700: "#124329",
    800: "#0B2F1F",
    900: "#061B15",
  },
  gold: {
    DEFAULT: "#E3B23C",
    50: "#FFF7E0",
    100: "#FDECC1",
    200: "#FAD883",
    300: "#F7C445",
    400: "#E3B23C",
    500: "#C79A2F",
    600: "#9E7924",
    700: "#755819",
    800: "#4D370E",
    900: "#261C05",
  },
} as const;

export const klasseSurface = {
  card: "rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md",
  cardInteractive: "rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md",
  cardCompact: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md",
  cardMuted: "rounded-xl border border-slate-100 bg-slate-50/50",
} as const;

export const klasseUiExceptions = [
  "modal",
  "drawer",
  "sheet",
  "dialog",
  "slideover",
  "mobile-app-like",
  "landing",
] as const;
