import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  nome_empresa: z.string().trim().min(2, "Informe o nome da empresa."),
  nif: z.string().trim().min(9, "NIF deve ter pelo menos 9 caracteres."),
  nome_recrutador: z.string().trim().min(2, "Informe o nome do recrutador."),
  email: z.string().trim().email("Email inválido."),
});

function normalizeNif(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

function isNifDuplicate(errorCode: string | undefined, errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return errorCode === "23505" && normalized.includes("nif");
}

export async function POST(request: Request) {
  const rawSupabase = await supabaseServer();
  const supabase = rawSupabase as unknown as FormacaoSupabaseClient;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return NextResponse.json({ ok: false, error: "Nao autenticado" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ ok: false, error: issue?.message ?? "Payload inválido." }, { status: 400 });
  }

  const authEmail = String(user.email ?? "")
    .trim()
    .toLowerCase();
  if (!authEmail) {
    return NextResponse.json({ ok: false, error: "Email da sessão não encontrado." }, { status: 400 });
  }

  const formEmail = parsed.data.email.trim().toLowerCase();
  if (formEmail !== authEmail) {
    return NextResponse.json(
      {
        ok: false,
        error: "O email validado por OTP não corresponde ao email da sessão atual.",
      },
      { status: 400 }
    );
  }

  const empresasTable = "empresas_parceiras";
  const nif = normalizeNif(parsed.data.nif);
  const upsertPayload = {
    id: user.id,
    nif,
    email: authEmail,
    nome_empresa: parsed.data.nome_empresa.trim(),
    nome_recrutador: parsed.data.nome_recrutador.trim(),
  };

  const { data, error } = await supabase
    .from(empresasTable)
    .upsert(upsertPayload, { onConflict: "id" })
    .select("id, nif, email, nome_empresa, nome_recrutador, dominio_email, is_verified, created_at, updated_at")
    .single();

  if (error) {
    if (isNifDuplicate(error.code, error.message)) {
      return NextResponse.json(
        {
          ok: false,
          code: "NIF_DUPLICADO",
          error: "Este NIF já está registado. Por favor faça login com o e-mail.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, profile: data });
}
