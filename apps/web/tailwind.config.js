/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        moxinexa: {
          // Mantém compatibilidade: classes como bg-moxinexa-teal continuam funcionando via DEFAULT
          teal: {
            DEFAULT: "#0D9488", // ~teal-600
            50:  "#f0fdfa",
            100: "#ccfbf1",
            200: "#99f6e4",
            300: "#5eead4",
            400: "#2dd4bf",
            500: "#14b8a6",
            600: "#0d9488",
            700: "#0f766e",
            800: "#115e59",
            900: "#134e4a",
            950: "#042f2e",
          },
          navy: "#0B2C45",   // Azul escuro (Moxi)
          dark: "#1A2B3C",   // Texto forte
          light: "#F9FAFB",  // Fundo claro
          gray: "#6C757D",   // Texto secundário
        },
      },
      fontFamily: {
        sans: ["Poppins", "sans-serif"],  // Fonte oficial da marca
        mono: ["var(--font-geist-mono)", "monospace"], // Geist Mono para números/código
      },
    },
  },
  // Tailwind plugins são declarados no PostCSS, não aqui.
  plugins: [],
};
