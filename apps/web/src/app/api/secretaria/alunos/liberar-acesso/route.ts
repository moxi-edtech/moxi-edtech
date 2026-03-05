import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
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
    const gerarCredenciais = body?.gerarCredenciais !== false;

    if (alunoIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Informe alunos para liberar" }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(s as any, user.id, escolaIdRequest);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const { data: escolaCfg, error: escolaCfgErr } = await s
      .from("escolas")
      .select("aluno_portal_enabled")
      .eq("id", escolaId)
      .maybeSingle();
    if (escolaCfgErr) return NextResponse.json({ ok: false, error: escolaCfgErr.message }, { status: 400 });
    if (!escolaCfg?.aluno_portal_enabled) {
      return NextResponse.json(
        { ok: false, error: "Portal do aluno não concedido para esta escola" },
        { status: 409 }
      );
    }

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, []);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    const { data: rpcRes, error: rpcErr } = await (s as any).rpc("request_liberar_acesso", {
      p_escola_id: escolaId,
      p_aluno_ids: alunoIds,
      p_canal: canal || "whatsapp",
    });

    if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 400 });

    const rows = Array.isArray(rpcRes) ? rpcRes : [];
    const alunoIdsLiberados = rows.map((row: any) => row.aluno_id).filter(Boolean);
    let alunosMap = new Map<
      string,
      { nome: string | null; codigo_ativacao: string | null; bi_numero: string | null }
    >();

    if (alunoIdsLiberados.length > 0) {
      const { data: alunosData, error: alunosErr } = await s
        .from("alunos")
        .select("id, nome, codigo_ativacao, bi_numero")
        .eq("escola_id", escolaId)
        .in("id", alunoIdsLiberados);

      if (!alunosErr && alunosData) {
        alunosMap = new Map(
          alunosData.map((row: any) => [
            row.id,
            {
              nome: row.nome ?? null,
              codigo_ativacao: row.codigo_ativacao ?? null,
              bi_numero: row.bi_numero ?? null,
            },
          ])
        );
      }
    }

    const detalhes: Array<{
      id: string;
      status: string;
      request_id?: string | null;
      nome?: string | null;
      codigo_ativacao?: string | null;
      login?: string | null;
      senha?: string | null;
    }> = [];

    for (const row of rows as any[]) {
      const extra = alunosMap.get(row.aluno_id) || { nome: null, codigo_ativacao: null, bi_numero: null };
      const codigo = extra.codigo_ativacao || row.codigo_ativacao || null;
      let login: string | null = null;
      let senha: string | null = null;
      let status = "queued";

      if (gerarCredenciais) {
        if (!extra.bi_numero) {
          status = "bi_missing";
        } else if (codigo) {
          try {
            const result = await callAuthAdminJob(req, "activateStudentAccess", {
              codigo,
              bi: extra.bi_numero,
            });
            login = (result as any)?.login ?? null;
            senha = (result as any)?.senha ?? null;
            status = "activated";
          } catch (error) {
            status = "activation_failed";
          }
        }
      }

      detalhes.push({
        id: row.aluno_id,
        status,
        request_id: row.request_id,
        nome: extra.nome,
        codigo_ativacao: codigo,
        login,
        senha,
      });
    }

    return NextResponse.json({ ok: true, liberados: rows.length, detalhes });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
