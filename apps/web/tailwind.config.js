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
        // --- AQUI ESTÁ A MUDANÇA MÁGICA ---
        // Atualizei o 'brand' para o tom escuro (Slate) que você gostou no HTML
        brand: {
          DEFAULT: '#0f172a', // Slate 900
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b', // Slate 800 (usado para bordas escuras)
          900: '#0f172a', // Slate 900 (O Fundo do Sidebar que você gostou)
          950: '#020617', // Mais escuro ainda, para gradientes profundos
        },
        
        // Cores legadas/específicas da MoxiNexa
        moxinexa: {
          teal: {
            DEFAULT: "#0D9488",
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
          // Mantive o navy original caso precise usar em botões secundários
          navy: "#0B2C45", 
          dark: "#1A2B3C",
          light: "#F9FAFB",
          gray: "#6C757D",
        },

        // Redefinindo Slate explicitamente (para garantir compatibilidade)
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ["Poppins", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'sidebar-collapse': 'sidebarCollapse 0.2s ease-out',
        'sidebar-expand': 'sidebarExpand 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sidebarCollapse: {
          '0%': { width: 'var(--sidebar-expanded, 256px)' },
          '100%': { width: 'var(--sidebar-collapsed, 80px)' },
        },
        sidebarExpand: {
          '0%': { width: 'var(--sidebar-collapsed, 80px)' },
          '100%': { width: 'var(--sidebar-expanded, 256px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      spacing: {
        'sidebar': 'var(--sidebar-w, 256px)',
        'sidebar-collapsed': 'var(--sidebar-collapsed, 80px)',
        'sidebar-expanded': 'var(--sidebar-expanded, 256px)',
      },
    },
  },
  plugins: [],
};