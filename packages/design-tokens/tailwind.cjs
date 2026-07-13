const klasseColors = {
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
};

const slate = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
  950: "#020617",
};

module.exports = {
  klasseColors,
  klasseTailwindTheme: {
    colors: {
      klasse: klasseColors,
      emerald: klasseColors.green,
      amber: klasseColors.gold,
      slate,
      blue: slate,
      purple: slate,
    },
  },
};
