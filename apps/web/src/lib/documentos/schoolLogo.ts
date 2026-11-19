import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { detectImageFormat, fetchImageBytes } from "@/lib/pdf/documentTemplate";
import { NominalRosterError } from "@/lib/documentos/listaNominalService";

/**
 * A identidade da escola é a única origem de logótipo nos documentos nominais.
 * Extrai apenas objectos que pertençam ao próprio tenant. Não aceitar um caminho
 * arbitrário do browser para ler outra escola no Storage.
 */
export function schoolBrandingObjectPath(
  logoUrl: string | null | undefined,
  escolaId: string,
): string | null {
  if (!logoUrl || !/^[0-9a-f-]{36}$/i.test(escolaId)) return null;
  let pathname: string;
  try {
    const url = new URL(logoUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    pathname = url.pathname;
  } catch {
    return null;
  }
  const prefix = `/storage/v1/object/public/school-branding/escolas/${escolaId}/logo/`;
  if (!pathname.startsWith(prefix)) return null;
  const filename = pathname.slice(prefix.length);
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename) || filename === "." || filename === "..") return null;
  return `escolas/${escolaId}/logo/${filename}`;
}

export class SchoolLogoUnavailableError extends NominalRosterError {
  constructor() {
    super("Não foi possível carregar o logótipo configurado da escola. Tente novamente ou verifique a identidade visual.", 503);
    this.name = "SchoolLogoUnavailableError";
  }
}

/** 
 * Primeiro lê o próprio Storage autenticado; se indisponível, tenta a URL
 * pública existente (sem substituir a marca por uma insígnia de outra entidade).
 * Logo não configurado resulta em documento sem imagem, nunca em outra marca.
 */
export async function loadSchoolLogoBytes({
  supabase, escolaId, logoUrl,
}: {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  logoUrl: string | null | undefined;
}): Promise<Uint8Array | undefined> {
  const value = logoUrl?.trim();
  if (!value || /(?:^|\/)insignia_med\.png(?:\?.*)?$/i.test(value)) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
    if (parsed.protocol !== "https:") throw new Error("Insecure logo URL");
  } catch {
    throw new SchoolLogoUnavailableError();
  }

  const path = schoolBrandingObjectPath(value, escolaId);
  let bytes: Uint8Array | undefined;
  let contentType: string | null = null;
  if (path) {
    try {
      const { data, error } = await supabase.storage.from("school-branding").download(path);
      if (!error && data) {
        bytes = new Uint8Array(await data.arrayBuffer());
        contentType = data.type || null;
      }
    } catch {
      // A URL pública pode continuar acessível mesmo quando o SDK falha.
    }
  }

  if (!bytes) {
    // Nunca consultar endereços internos ou esquemas arbitrários como fonte de marca.
    if (!path && !parsed.hostname.endsWith(".supabase.co")) {
      throw new SchoolLogoUnavailableError();
    }
    try {
      const image = await fetchImageBytes(parsed.toString());
      bytes = image.bytes;
      contentType = image.contentType;
    } catch {
      throw new SchoolLogoUnavailableError();
    }
  }

  try {
    const format = detectImageFormat(bytes, contentType, value);
    if (format !== "png" && format !== "jpg") throw new Error("Unsupported logo");
  } catch {
    throw new SchoolLogoUnavailableError();
  }
  return bytes;
}
