import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { isEscolaUuid } from "./escolaSlug";

type Client = SupabaseClient<Database>;

export type EscolaParamResolution = {
  escolaId: string | null;
  slug: string | null;
  paramType: "uuid" | "slug" | "unknown";
};

export async function resolveEscolaParam(
  client: Client,
  param: string
): Promise<EscolaParamResolution> {
  const trimmed = param.trim();
  if (!trimmed) {
    return { escolaId: null, slug: null, paramType: "unknown" };
  }

  const paramType = isEscolaUuid(trimmed) ? "uuid" : "slug";
  const column = paramType === "uuid" ? "id" : "slug";

  const { data, error } = await client
    .from("escolas")
    .select("id, slug")
    .eq(column, trimmed)
    .maybeSingle();

  if (error || !data?.id) {
    return { escolaId: null, slug: null, paramType };
  }

  return {
    escolaId: data.id,
    slug: data.slug ?? null,
    paramType,
  };
}
