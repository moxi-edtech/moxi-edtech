import { fileURLToPath } from "node:url";
import path from "node:path";
const dir = path.dirname(fileURLToPath(import.meta.url));
export default {
  root: dir,
  resolve: {
    alias: [
      { find: "next/navigation", replacement: path.resolve(dir, "next-navigation.ts") },
      { find: "next/dynamic", replacement: path.resolve(dir, "next-dynamic.tsx") },
      { find: "next/link", replacement: path.resolve(dir, "next-link.tsx") },
      { find: "@", replacement: path.resolve(dir, "../src") },
      { find: "~", replacement: path.resolve(dir, "../src") },
    ],
  },
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  css: { postcss: path.resolve(dir, "..") },
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify("https://fixture.invalid"),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify("fixture-only-not-real"),
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
};
