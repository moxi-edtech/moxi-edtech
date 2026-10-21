import { fileURLToPath } from "node:url";
import path from "node:path";
const dir = path.dirname(fileURLToPath(import.meta.url));
export default {
  root: dir,
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: [
      // Auth is simulated only for the chat usability suite. Other stories keep their original module.
      ...(process.env.KLASSE_VISUAL_CHAT_MOCK_AUTH === "1" ? [
        { find: "@/lib/supabaseClient", replacement: path.resolve(dir, "auth-fixture.ts") },
      ] : []),
      { find: "next/navigation", replacement: path.resolve(dir, "next-navigation.ts") },
      { find: "next/link", replacement: path.resolve(dir, "next-link.tsx") },
      { find: "@", replacement: path.resolve(dir, "../src") },
      { find: "~", replacement: path.resolve(dir, "../src") },
    ],
  },
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"] },
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  css: { postcss: path.resolve(dir, "..") },
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify("https://fixture.invalid"),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify("fixture-only-not-real"),
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
};
