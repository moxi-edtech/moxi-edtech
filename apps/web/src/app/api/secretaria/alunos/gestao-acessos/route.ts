import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { assertPortalAccess } from "@/lib/portalAccess";

export async function GET(req: Request) {
  try {
    const s = await supabaseServerTyped<Database>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const portalCheck = await assertPortalAccess(s as any, user.id, "secretaria");
    if (!portalCheck.ok) {
      return NextResponse.json({ ok: false, error: portalCheck.error }, { status: portalCheck.status });
    }

    const url = new URL(req.url);
    const escolaIdParam = url.searchParams.get("escolaId") || null;
    const tab = url.searchParams.get("tab") || "pendentes";
    const search = url.searchParams.get("search") || "";
    const turmaId = url.searchParams.get("turmaId") || null;

    const escolaId = await resolveEscolaIdForUser(s as any, user.id, escolaIdParam);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, []);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    let selectFields = `
      id, 
      nome, 
      numero_processo, 
      acesso_liberado, 
      acesso_bloqueado, 
      status, 
      codigo_ativacao, 
      created_at, 
      data_ativacao,
      ultimo_reset_senha,
      motivo_bloqueio,
      bloqueado_em,
      bloqueado_por,
      profile:profiles!alunos_profile_id_fkey (
        updated_at
      ),
      actor:profiles!alunos_bloqueado_por_fkey (
        nome
      )
    `;

    if (turmaId) {
      selectFields += `, matriculas!inner(turma_id)`;
    }

    let query = s
      .from("alunos")
      .select(selectFields)
      .eq("escola_id", escolaId)
      .is("deleted_at", null);

    if (turmaId) {
      query = query.eq("matriculas.turma_id", turmaId);
    }

    // Filtros de Tab
    if (tab === "pendentes") {
      query = query.eq("acesso_liberado", false).not("status", "eq", "inativo");
    } else if (tab === "ativos") {
      query = query.eq("acesso_liberado", true).eq("acesso_bloqueado", false).not("status", "eq", "suspenso");
    } else if (tab === "bloqueados") {
      query = query.or("acesso_bloqueado.eq.true,status.eq.suspenso");
    }

    // Filtro de Busca
    if (search) {
      query = query.or(`nome.ilike.%${search}%,numero_processo.ilike.%${search}%`);
    }

    query = applyKf2ListInvariants(query, { defaultLimit: 50 });

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let items = (data || []).map((row: any) => ({
      ...row,
      last_login: row.profile?.updated_at || null,
      bloqueado_por_nome: row.actor?.nome || null,
      profile: undefined,
      actor: undefined
    }));

    // Enriquecer com inadimplência se necessário
    const { data: configFin } = await s
      .from("configuracoes_financeiro")
      .select("bloquear_inadimplentes")
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (configFin?.bloquear_inadimplentes) {
      const { data: inadimplentes } = await s
        .from("internal.mv_radar_inadimplencia" as any)
        .select("aluno_id, dias_em_atraso")
        .eq("escola_id", escolaId)
        .gt("dias_em_atraso", 30) as any;
      
      const inadMap = new Map((inadimplentes as any[])?.map(i => [i.aluno_id, i.dias_em_atraso]) || []);
      
      items = items.map((item: any) => ({
        ...item,
        inadimplente: inadMap.has(item.id),
        dias_atraso: inadMap.get(item.id) || 0
      }));

      // Se estamos na aba de bloqueados, e queremos mostrar quem está bloqueado por inadimplência mas não está na query original
      if (tab === "bloqueados") {
        // Alunos inadimplentes que não foram pegos pelo filtro de manual/suspenso
        const inadIdsMissing = Array.from(inadMap.keys()).filter(id => !items.find(i => i.id === id));
        
        if (inadIdsMissing.length > 0) {
           const { data: extraAlunos } = await s
             .from("alunos")
             .select(selectFields)
             .in("id", inadIdsMissing)
             .is("deleted_at", null);
           
           if (extraAlunos) {
             const extraItems = extraAlunos.map((row: any) => ({
               ...row,
               last_login: row.profile?.updated_at || null,
               profile: undefined,
               inadimplente: true,
               dias_atraso: inadMap.get(row.id) || 0
             }));
             items = [...items, ...extraItems];
           }
        }
      }
    }

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
