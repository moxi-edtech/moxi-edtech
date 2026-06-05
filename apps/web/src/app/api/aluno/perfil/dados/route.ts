import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAlunoContext } from "@/lib/alunoContext";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  email: z.string().trim().email("Email inválido.").max(254).or(z.literal("")),
  telefone: z.string().trim().max(32, "Telefone excede 32 caracteres."),
  endereco: z.string().trim().max(500, "Endereço excede 500 caracteres."),
});

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId, alunoId, userId } = ctx;

    if (!escolaId || !alunoId) {
      return NextResponse.json({ ok: false, error: "Contexto incompleto" }, { status: 400 });
    }

    const [alunoRes, profileRes] = await Promise.all([
      supabase
        .from("alunos")
        .select("nome, email, telefone, responsavel_contato, telefone_responsavel, encarregado_telefone, endereco")
        .eq("id", alunoId)
        .eq("escola_id", escolaId)
        .single(),
      supabase
        .from("profiles")
        .select("email_auth, numero_processo_login")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (alunoRes.error || !alunoRes.data) throw alunoRes.error || new Error("Aluno não encontrado");

    const profile = profileRes.data as { email_auth?: string | null; numero_processo_login?: string | null } | null;

    return NextResponse.json({
      ok: true,
      dados: {
        ...alunoRes.data,
        email_contato: alunoRes.data.email ?? null,
        login_portal: profile?.numero_processo_login ?? null,
        email_auth: profile?.email_auth ?? null,
        auth_email_mutavel_pelo_aluno: false,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId, alunoId } = ctx;

    if (!escolaId || !alunoId) {
      return NextResponse.json({ ok: false, error: "Contexto incompleto" }, { status: 400 });
    }

    const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const rpcClient = supabase as unknown as SupabaseClient<DBWithRPC>;
    const { data, error } = await rpcClient.rpc("aluno_atualizar_contatos_proprios", {
      p_escola_id: escolaId,
      p_aluno_id: alunoId,
      p_email: parsed.data.email,
      p_telefone: parsed.data.telefone,
      p_endereco: parsed.data.endereco,
    });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      dados: data?.[0] ?? null,
      authEmailUpdated: false,
      message: "Email de contato atualizado. O login do portal não foi alterado.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
