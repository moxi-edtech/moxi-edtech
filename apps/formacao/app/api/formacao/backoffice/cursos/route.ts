import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_cursos")
    .select("id, codigo, nome, area, modalidade, carga_horaria, status, created_at")
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    codigo?: string;
    nome?: string;
    area?: string;
    modalidade?: "presencial" | "online" | "hibrido";
    carga_horaria?: number;
  } | null;

  const codigo = String(body?.codigo ?? "").trim().toUpperCase();
  const nome = String(body?.nome ?? "").trim();
  const area = String(body?.area ?? "").trim() || null;
  const modalidadeRaw = String(body?.modalidade ?? "presencial").trim().toLowerCase();
  const modalidade = (["presencial", "online", "hibrido"].includes(modalidadeRaw)
    ? modalidadeRaw
    : "presencial") as "presencial" | "online" | "hibrido";
  const cargaHoraria =
    body?.carga_horaria && Number(body.carga_horaria) > 0 ? Number(body.carga_horaria) : null;

  if (!codigo || !nome) {
    return NextResponse.json({ ok: false, error: "codigo e nome são obrigatórios" }, { status: 400 });
  }

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_cursos")
    .insert({
      escola_id: auth.escolaId,
      codigo,
      nome,
      area,
      modalidade,
      carga_horaria: cargaHoraria,
      status: "ativo",
    })
    .select("id, codigo, nome, area, modalidade, carga_horaria, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    codigo?: string;
    nome?: string;
    area?: string | null;
    modalidade?: "presencial" | "online" | "hibrido";
    carga_horaria?: number | null;
    status?: "ativo" | "inativo";
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.codigo === "string") patch.codigo = body.codigo.trim().toUpperCase();
  if (typeof body?.nome === "string") patch.nome = body.nome.trim();
  if (body?.area !== undefined) patch.area = body.area ? String(body.area).trim() : null;
  if (body?.modalidade && ["presencial", "online", "hibrido"].includes(body.modalidade)) {
    patch.modalidade = body.modalidade;
  }
  if (body?.carga_horaria !== undefined) {
    const carga = body.carga_horaria === null ? null : Number(body.carga_horaria);
    if (carga !== null && carga <= 0) {
      return NextResponse.json({ ok: false, error: "carga_horaria deve ser maior que zero" }, { status: 400 });
    }
    patch.carga_horaria = carga;
  }
  if (body?.status && ["ativo", "inativo"].includes(body.status)) {
    patch.status = body.status;
  }

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_cursos")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id)
    .select("id, codigo, nome, area, modalidade, carga_horaria, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const s = auth.supabase as any;
  const { error } = await s
    .from("formacao_cursos")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
