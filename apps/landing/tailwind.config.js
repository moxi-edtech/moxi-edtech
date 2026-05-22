/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        klasse: {
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
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
