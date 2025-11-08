"use client";
// lib/supabaseClient.ts
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "~types/supabase"

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return null;
          const cookie = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`));

          if (!cookie) return null;

          const value = cookie.split('=')[1];

          // Não decodificar valores base64-
          if (value && value.startsWith('base64-')) {
            return value;
          }

          // Para outros cookies, decode normalmente
          return decodeURIComponent(value);
        },
        set(name: string, value: string, options: any) {
          if (typeof document === 'undefined') return;
          // Para valores base64-, não encode URI component
          const cookieValue = value.startsWith('base64-')
            ? value
            : encodeURIComponent(value);

          document.cookie = `${name}=${cookieValue}; ${
            options?.maxAge ? `max-age=${options.maxAge};` : ''
          } ${options?.path ? `path=${options.path};` : ''} ${
            options?.secure ? 'secure;' : ''
          } ${options?.sameSite ? `sameSite=${options.sameSite};` : ''}`;
        },
        remove(name: string, options: any) {
          if (typeof document === 'undefined') return;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${
            options?.path ? `path=${options.path};` : ''
          }`;
        },
      },
    }
  )
