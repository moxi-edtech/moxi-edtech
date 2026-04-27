import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PartnerTalentPayload = {
  ok: boolean;
  error?: string;
  partner?: {
    escola_id: string;
    nome: string;
    slug: string;
    tenant_type: "formacao" | "solo_creator" | "k12";
    cor_primaria: string | null;
    logo_url: string | null;
  };
  scope?: "local" | "global";
  query?: string | null;
  local_count?: number;
  global_count?: number;
  items?: Array<{
    aluno_id: string;
    escola_id: string;
    escola_nome: string;
    escola_slug: string;
    provincia: string | null;
    municipio: string | null;
    preferencia_trabalho: string | null;
    career_headline: string | null;
    skills_tags: unknown;
    anonymous_slug: string | null;
    highest_media: number | null;
  }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = String(url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const q = String(url.searchParams.get("q") ?? "").trim();
  const scopeRaw = String(url.searchParams.get("scope") ?? "local").trim().toLowerCase();
  const scope = scopeRaw === "global" ? "global" : "local";
  const limitParam = Number(url.searchParams.get("limit") ?? "12");
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 12, 1), 50);
  const minMedia = url.searchParams.get("min_media");

  if (!slug) {
    return NextResponse.json({ ok: false, error: "slug e obrigatorio" }, { status: 400 });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = String(
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ).trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, error: "SUPABASE_MISCONFIGURED" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("get_partner_talent_pool", {
    p_escola_slug: slug,
    p_q: q || null,
    p_scope: scope,
    p_limit: limit,
    p_offset: 0,
    p_min_media: minMedia ? Number(minMedia) : null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const payload = (data ?? { ok: false, error: "EMPTY_PAYLOAD" }) as PartnerTalentPayload;
  if (!payload.ok) {
    const notFound = payload.error === "PARCEIRO_NAO_ENCONTRADO";
    return NextResponse.json(payload, { status: notFound ? 404 : 400 });
  }

  return NextResponse.json(payload);
}
