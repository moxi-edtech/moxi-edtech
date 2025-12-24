/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ===============================
      // 🎨 CORES OFICIAIS — KLASSE
      // ===============================
      colors: {
        klasse: {
          green: {
            DEFAULT: "#1F6B3B", // Verde bandeira (principal)
            50:  "#ECF5EF",
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
            DEFAULT: "#E3B23C", // Dourado institucional
            50:  "#FFF7E0",
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

        // ===============================
        // ⚙️ BASE NEUTRA (UI / DASHBOARD)
        // ===============================
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
          950: '#020617',
        },
      },

      // ===============================
      // ✍🏽 TIPOGRAFIA
      // ===============================
      fontFamily: {
        sans: ["Sora", "sans-serif"], // fonte oficial KLASSE
        mono: ["var(--font-geist-mono)", "monospace"],
      },

      // ===============================
      // 🎬 ANIMAÇÕES (ENTERPRISE)
      // ===============================
      animation: {
        'klasse-fade-up': 'klasseFadeUp 520ms cubic-bezier(.2,.8,.2,1)',
        'klasse-fade-in': 'klasseFadeIn 420ms ease-out',
        'sidebar-collapse': 'sidebarCollapse 200ms ease-out',
        'sidebar-expand': 'sidebarExpand 200ms ease-out',
      },

      keyframes: {
        klasseFadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        klasseFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
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

      // ===============================
      // 🧱 LAYOUT TOKENS
      // ===============================
      spacing: {
        'sidebar': 'var(--sidebar-w, 256px)',
        'sidebar-collapsed': 'var(--sidebar-collapsed, 80px)',
        'sidebar-expanded': 'var(--sidebar-expanded, 256px)',
      },

      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

