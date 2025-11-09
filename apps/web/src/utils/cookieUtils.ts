/**
 * Utilitários para gerenciamento de cookies do Supabase
 */

/**
 * Limpa cookies do Supabase que podem estar corrompidos
 * Remove cookies que não estão no formato base64- mas são JSON válidos
 */
export function clearSupabaseCookies(): void {
  if (typeof document === "undefined") return
  const known = [
    "sb-access-token",
    "sb-refresh-token",
    "sb-access-token-expires",
    "sb-provider",
    "sb-anon-key",
  ]
  const all = getCookiesForDebug()
  for (const c of all) {
    const [name] = c.split("=")
    if (!name) continue
    const n = name.trim()
    if (known.includes(n) || /^sb-/.test(n) || /supabase/i.test(n)) expireCookie(n)
  }
  for (const k of known) expireCookie(k)
}

/**
 * Limpa todos os cookies de autenticação (Supabase e NextAuth)
 */
export function clearAllAuthCookies(): void {
  if (typeof window === 'undefined') return;

  const cookies = document.cookie.split('; ');
  
  cookies.forEach(cookie => {
    const [name] = cookie.split('=');
    if (name.includes('supabase') || name.includes('sb-') || name.includes('next-auth')) {
      document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
    }
  });
  
  console.log('Todos os cookies de autenticação foram limpos');
}

/**
 * Verifica se há cookies corrompidos do Supabase
 */
export function hasCorruptedCookies(): boolean {
  if (typeof window === 'undefined') return false;

  const cookies = document.cookie.split('; ');
  
  return cookies.some(cookie => {
    const [name, value] = cookie.split('=');
    if ((name.includes('supabase') || name.includes('sb-')) && value) {
      try {
        if (!value.startsWith('base64-')) {
          JSON.parse(decodeURIComponent(value));
          return true; // Cookie corrompido encontrado
        }
      } catch (e) {
        // Cookie está no formato correto
      }
    }
    return false;
  });
}

/**
 * Retorna todos os cookies atuais para debug
 */
export function getCookiesForDebug(): string[] {
  if (typeof document === "undefined") return []
  const raw = document.cookie || ""
  if (!raw) return []
  return raw.split(";").map((s) => s.trim()).filter(Boolean)
}

function expireCookie(name: string) {
  if (typeof document === "undefined") return
  try {
    // expire at root and current domain
    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`
    document.cookie = `${name}=; Path=/; Domain=${location.hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`
  } catch {
    // noop
  }
}

/**
 * Limpa todo o storage local e session
 */
export function clearAllStorage(): void {
  if (typeof window === 'undefined') return;

  localStorage.clear();
  sessionStorage.clear();
  console.log('LocalStorage e SessionStorage limpos');
}

/**
 * Limpa completamente todos os dados de autenticação
 */
export function clearAllAuthData(): void {
  try {
    clearSupabaseCookies()
    if (typeof window !== "undefined") {
      const ls = window.localStorage
      const ss = window.sessionStorage
      for (const k of Object.keys(ls || {})) {
        if (/^(supabase|sb-|sb:|moxi_)/i.test(k) || /auth/i.test(k)) {
          try { ls.removeItem(k) } catch {}
        }
      }
      for (const k of Object.keys(ss || {})) {
        if (/^(supabase|sb-|sb:|moxi_)/i.test(k) || /auth/i.test(k)) {
          try { ss.removeItem(k) } catch {}
        }
      }
    }
  } catch {
    // noop
  }
}
