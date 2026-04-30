import { NextResponse } from "next/server";
import { z } from "zod";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const readRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "formacao_financeiro",
  "formador",
  "super_admin",
  "global_admin",
];

const writeRoles = ["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"];
const deleteRoles = ["formacao_admin", "super_admin", "global_admin"];

const tipos = ["sala", "laboratorio", "auditorio", "online"] as const;
const statuses = ["ativa", "manutencao", "inativa"] as const;

const SalaPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  tipo: z.enum(tipos).default("sala"),
  capacidade: z.coerce.number().int().min(1).max(10000),
  localizacao: z.string().trim().max(160).optional().nullable(),
  recursos: z.array(z.string().trim().min(1).max(60)).max(30).optional().default([]),
  status: z.enum(statuses).default("ativa"),
  observacoes: z.string().trim().max(600).optional().nullable(),
});

function normalizeText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueRecursos(recursos: string[]) {
  return Array.from(new Set(recursos.map((item) => item.trim()).filter(Boolean)));
}

export async function GET() {
  const auth = await requireFormacaoRoles(readRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_salas_infraestrutura")
    .select("id, nome, tipo, capacidade, localizacao, recursos, status, observacoes, created_at, updated_at")
    .eq("escola_id", auth.escolaId)
    .order("status", { ascending: true })
    .order("nome", { ascending: true })
    .limit(300);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(writeRoles);
  if (!auth.ok) return auth.response;

  const parsed = SalaPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_salas_infraestrutura")
    .insert({
      escola_id: auth.escolaId,
      nome: payload.nome,
      tipo: payload.tipo,
      capacidade: payload.capacidade,
      localizacao: normalizeText(payload.localizacao),
      recursos: uniqueRecursos(payload.recursos),
      status: payload.status,
      observacoes: normalizeText(payload.observacoes),
    })
    .select("id, nome, tipo, capacidade, localizacao, recursos, status, observacoes, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(writeRoles);
  if (!auth.ok) return auth.response;

  const parsed = SalaPayloadSchema.required({ id: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_salas_infraestrutura")
    .update({
      nome: payload.nome,
      tipo: payload.tipo,
      capacidade: payload.capacidade,
      localizacao: normalizeText(payload.localizacao),
      recursos: uniqueRecursos(payload.recursos),
      status: payload.status,
      observacoes: normalizeText(payload.observacoes),
      updated_at: new Date().toISOString(),
    })
    .eq("escola_id", auth.escolaId)
    .eq("id", payload.id)
    .select("id, nome, tipo, capacidade, localizacao, recursos, status, observacoes, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(deleteRoles);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const s = auth.supabase as FormacaoSupabaseClient;
  const { error } = await s
    .from("formacao_salas_infraestrutura")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
