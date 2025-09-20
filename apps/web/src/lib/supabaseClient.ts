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
          try {
            const cookie = document.cookie
              .split('; ')
              .find(row => row.startsWith(`${name}=`))
            
            if (!cookie) return null
            
            const value = cookie.split('=')[1]
            
            // 🔥 CORREÇÃO: NÃO DECODIFICAR valores base64-
            if (value && value.startsWith('base64-')) {
              return value; // Retorna o valor ORIGINAL
            }
            
            // Para outros cookies, decode normalmente
            return decodeURIComponent(value)
          } catch (error) {
            console.error('Error getting cookie:', error)
            return null
          }
        },
        set(name: string, value: string, options: any) {
          try {
            // Para valores base64-, não encode URI component
            const cookieValue = value.startsWith('base64-') 
              ? value 
              : encodeURIComponent(value);
              
            document.cookie = `${name}=${cookieValue}; ${
              options?.maxAge ? `max-age=${options.maxAge};` : ''
            } ${options?.path ? `path=${options.path};` : ''} ${
              options?.secure ? 'secure;' : ''
            } ${options?.sameSite ? `sameSite=${options.sameSite};` : ''}`
          } catch (error) {
            console.error('Error setting cookie:', error)
          }
        },
        remove(name: string, options: any) {
          try {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${
              options?.path ? `path=${options.path};` : ''
            }`
          } catch (error) {
            console.error('Error removing cookie:', error)
          }
        }
      }
    }
  )