import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { docPrintUrl, TIPOS_DOCUMENTO_EMITIVEL } from "@/lib/documentos/printUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP] });
    if (authz.error) return authz.error;
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return NextResponse.json({ ok: false, error: "Página inválida" }, { status: 400 });
    const tipo = params.get("tipo");
    if (tipo && !(TIPOS_DOCUMENTO_EMITIVEL as readonly string[]).includes(tipo)) return NextResponse.json({ ok: false, error: "Tipo inválido" }, { status: 400 });
    let query = supabase.from("documentos_emitidos").select("id, aluno_id, tipo, public_id, created_at, dados_snapshot->>ano_letivo", { count: "exact" })
      .eq("escola_id", escolaId).in("tipo", [...TIPOS_DOCUMENTO_EMITIVEL]);
    if (tipo) query = query.eq("tipo", tipo);
    const search = (params.get("q") ?? "").trim().slice(0, 100);
    if (search) {
      const safeSearch = search.replace(/[%_\\]/g, " ").trim();
      if (!safeSearch) return NextResponse.json({ ok: true, items: [], total: 0 });
      const { data: alunos, error: alunoError } = await supabase.from("alunos").select("id").eq("escola_id", escolaId).ilike("nome_completo", `%${safeSearch}%`).limit(201);
      if (alunoError) throw alunoError;
      if ((alunos ?? []).length > 200) return NextResponse.json({ ok: false, error: "Refine a pesquisa do aluno." }, { status: 400 });
      const ids = (alunos ?? []).map((aluno: { id: string }) => aluno.id);
      if (!ids.length) return NextResponse.json({ ok: true, items: [], total: 0 });
      query = query.in("aluno_id", ids);
    }
    const { data, count, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;
    const ids = [...new Set((data ?? []).map((doc: any) => doc.aluno_id).filter(Boolean))];
    const { data: alunos, error: alunoError } = ids.length ? await supabase.from("alunos").select("id,nome,nome_completo").eq("escola_id", escolaId).in("id", ids) : { data: [], error: null };
    if (alunoError) throw alunoError;
    const names = new Map<string, string>((alunos ?? []).map((aluno: any) => [aluno.id, aluno.nome_completo || aluno.nome]));
    return NextResponse.json({ ok: true, total: count ?? 0, items: (data ?? []).map((doc: any) => ({
      id: doc.id, tipo: doc.tipo, aluno: names.get(doc.aluno_id) ?? "Aluno", publicId: doc.public_id,
      ano: doc.ano_letivo, criadoEm: doc.created_at, printUrl: docPrintUrl(doc.id, doc.tipo),
    })) });
  } catch (error) {
    console.error("[SECRETARIA_DOCUMENTOS_EMITIDOS]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível carregar os documentos emitidos." }, { status: 500 });
  }
}
