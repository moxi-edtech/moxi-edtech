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
          navy: "#0B2C45",   // Azul escuro (Moxi)
          teal: "#0D9488",   // Verde (alinhado ao teal-600 do login)
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
  plugins: [],
};
