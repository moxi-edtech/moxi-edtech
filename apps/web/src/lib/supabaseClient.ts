"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";

// Lê as envs uma vez
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

// Log bem explícito no cliente se faltar algo (só em runtime do browser)
if (!url || !anonKey) {
   
  console.error(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não definidos. " +
      "Verifique as variáveis de ambiente na Vercel (Production)."
  );
}

export const createClient = () => {
  if (!url || !anonKey) {
    // Falta de env tem que falhar cedo e claro
    throw new Error(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no ambiente."
    );
  }

  return createBrowserClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        if (typeof document === "undefined") return null;
        const cookie = document.cookie
          .split("; ")
          .find((row) => row.startsWith(`${name}=`));
        if (!cookie) return null;

        const value = cookie.split("=")[1];

        if (value && value.startsWith("base64-")) {
          return value;
        }

        return decodeURIComponent(value);
      },
      set(name: string, value: string, options: any) {
        if (typeof document === "undefined") return;
        const cookieValue = value.startsWith("base64-")
          ? value
          : encodeURIComponent(value);

        document.cookie = `${name}=${cookieValue}; ${
          options?.maxAge ? `max-age=${options.maxAge};` : ""
        } ${options?.path ? `path=${options.path};` : ""} ${
          options?.secure ? "secure;" : ""
        } ${options?.sameSite ? `sameSite=${options.sameSite};` : ""}`;
      },
      remove(name: string, options: any) {
        if (typeof document === "undefined") return;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${
          options?.path ? `path=${options.path};` : ""
        }`;
      },
    },
  });
};
