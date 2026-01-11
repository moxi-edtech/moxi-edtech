import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export async function POST(req: Request) {
  try {
    const s = await supabaseServerTyped<Database>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const alunoIds = Array.isArray(body?.alunoIds) ? (body.alunoIds.filter(Boolean) as string[]) : [];
    const canal = (body?.canal || body?.metodoEnvio || "whatsapp") as string;
    const escolaIdRequest = (body?.escolaId || body?.escola_id || null) as string | null;

    if (alunoIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Informe alunos para liberar" }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(s as any, user.id, escolaIdRequest);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, []);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    const { data: rpcRes, error: rpcErr } = await (s as any).rpc("liberar_acesso_alunos_v2", {
      p_escola_id: escolaId,
      p_aluno_ids: alunoIds,
      p_canal: canal || "whatsapp",
    });

    if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 400 });

    const rows = Array.isArray(rpcRes) ? rpcRes : [];
    const detalhes: Array<{ id: string; status: string; request_id?: string | null }> = [];

    await Promise.all(
      rows.map(async (row: any) => {
        await (s as any).rpc("enqueue_outbox_event", {
          p_escola_id: escolaId,
          p_topic: "auth_provision_student",
          p_request_id: row.request_id,
          p_payload: { aluno_id: row.aluno_id, canal },
        });
        detalhes.push({ id: row.aluno_id, status: "queued", request_id: row.request_id });
      })
    );

    return NextResponse.json({ ok: true, liberados: rows.length, detalhes });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
