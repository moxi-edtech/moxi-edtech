const { klasseTailwindTheme } = require("../../packages/design-tokens/tailwind.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ===============================
      // 🎨 CORES OFICIAIS — KLASSE
      // ===============================
      colors: klasseTailwindTheme.colors,

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
  plugins: [require("tailwindcss-animate")],
};
