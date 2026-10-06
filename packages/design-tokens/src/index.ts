export const moxiSpacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  24: "96px",
} as const;

export const moxiTypography = {
  caption: { fontSize: "12px", lineHeight: "16px" },
  bodySm: { fontSize: "14px", lineHeight: "20px" },
  body: { fontSize: "16px", lineHeight: "24px" },
  titleSm: { fontSize: "18px", lineHeight: "24px" },
  title: { fontSize: "24px", lineHeight: "32px" },
  display: { fontSize: "32px", lineHeight: "40px" },
} as const;

export const moxiRadius = {
  compact: "8px",
  control: "12px",
  surface: "12px",
  surfaceLarge: "16px",
  overlay: "20px",
  pill: "9999px",
} as const;

export const moxiElevation = {
  flat: "none",
  raised: "0 1px 2px rgb(15 23 42 / 0.08)",
  floating: "0 8px 24px -12px rgb(15 23 42 / 0.22)",
  overlay: "0 24px 64px -24px rgb(15 23 42 / 0.28)",
} as const;

export const moxiMotion = {
  fast: "120ms",
  standard: "180ms",
  slow: "260ms",
  ease: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export const moxiSemanticRoles = [
  "brand",
  "brandStrong",
  "action",
  "actionHover",
  "focus",
  "surface",
  "surfaceMuted",
  "border",
  "borderStrong",
  "text",
  "textMuted",
  "success",
  "warning",
  "danger",
  "info",
] as const;

export type MoxiSemanticRole = (typeof moxiSemanticRoles)[number];

export const moxiSurface = {
  static: "rounded-xl border border-slate-200/80 bg-white",
  interactive:
    "rounded-xl border border-slate-200/80 bg-white transition-[border-color,box-shadow,transform] duration-150 hover:border-slate-300 hover:shadow-sm",
  selected:
    "rounded-xl border border-slate-300 bg-white ring-1 ring-slate-300",
  muted: "rounded-xl border border-slate-100 bg-slate-50/70",
  large: "rounded-2xl border border-slate-200/80 bg-white",
  overlay: "rounded-[20px] border border-slate-200 bg-white shadow-xl",
} as const;

export const moxiText = {
  caption: "text-xs",
  bodySm: "text-sm",
  body: "text-base",
  titleSm: "text-lg",
  title: "text-2xl",
  display: "text-3xl",
} as const;

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

export const klasseTheme = {
  brand: klasseColors.green.DEFAULT,
  brandStrong: klasseColors.green[700],
  action: klasseColors.gold.DEFAULT,
  actionHover: klasseColors.gold[500],
  focus: klasseColors.gold.DEFAULT,
} as const;

/**
 * Compatibility layer for existing KLASSE screens.
 *
 * New work should prefer moxiSurface and declare interaction intent explicitly.
 * These recipes remain unchanged so adopting the v1 foundations is not a hidden
 * visual migration across every current consumer.
 */
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
