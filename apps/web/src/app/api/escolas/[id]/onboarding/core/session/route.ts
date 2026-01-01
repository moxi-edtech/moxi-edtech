import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServer } from "@/lib/supabaseServer"
import { hasPermission } from "@/lib/permissions"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "~types/supabase"

// POST /api/escolas/[id]/onboarding/session
// Alinha com o novo modelo acadêmico (anos_letivos + periodos_letivos)
// e substitui o uso de school_sessions/semestres legacy.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params

  try {
    const raw = await req.json();

    // 🔹 Campos novos opcionais (não validamos aqui com Zod, só usamos se vierem)
    const rawAnoLetivo = (raw as any)?.anoLetivo;
    const rawEsquema = (raw as any)?.esquemaPeriodos as
      | "semestral"
      | "trimestral"
      | "bimestral"
      | undefined;

    // 🔹 Se vier no formato novo (anoLetivo + esquemaPeriodos), convertemos para o formato antigo
    let body = raw as any;

    if (rawAnoLetivo && rawEsquema) {
      const ano = Number(rawAnoLetivo);
      if (!Number.isFinite(ano)) {
        return NextResponse.json(
          { ok: false, error: "anoLetivo inválido" },
          { status: 400 }
        );
      }

      const startYear = String(ano);
      const endYear = String(ano + 1);

      const nomeGerado =
        typeof raw?.nome === "string" && raw.nome.trim().length > 0
          ? raw.nome.trim()
          : `${startYear}/${endYear}`;

      body = {
        nome: nomeGerado,
        startYear,
        endYear,
      };
    }

    // Aceita dois modos: por ano (compat) ou por datas exatas
    const byYearSchema = z.object({
      nome: z.string().trim().min(1),
      startYear: z.string().regex(/^\d{4}$/),
      endYear: z.string().regex(/^\d{4}$/),
    })
    const byDateSchema = z.object({
      nome: z.string().trim().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })

    let nome: string
    let data_inicio: string
    let data_fim: string
    
    const tryYear = byYearSchema.safeParse(body)
    const tryDate = byDateSchema.safeParse(body)
    if (tryDate.success) {
      nome = tryDate.data.nome
      data_inicio = tryDate.data.startDate
      data_fim = tryDate.data.endDate
      // Valida duração: exatamente 1 ano - 1 dia
      const sd = new Date(data_inicio)
      const ed = new Date(data_fim)
      if (!(sd instanceof Date) || isNaN(sd.getTime()) || !(ed instanceof Date) || isNaN(ed.getTime())) {
        return NextResponse.json({ ok: false, error: 'Datas inválidas' }, { status: 400 })
      }
      if (ed <= sd) {
        return NextResponse.json({ ok: false, error: 'A data final deve ser posterior à data inicial' }, { status: 400 })
      }
      const expected = new Date(sd)
      expected.setFullYear(expected.getFullYear() + 1)
      expected.setDate(expected.getDate() - 1)
      const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (toISO(expected) !== toISO(ed)) {
        return NextResponse.json({ ok: false, error: 'A sessão deve durar 1 ano (fim = início + 1 ano - 1 dia)' }, { status: 400 })
      }
    } else if (tryYear.success) {
      nome = tryYear.data.nome
      const { startYear, endYear } = tryYear.data
      if (Number(startYear) >= Number(endYear)) {
        return NextResponse.json({ ok: false, error: 'Ano final deve ser maior que ano inicial' }, { status: 400 })
      }
      if (Number(endYear) - Number(startYear) !== 1) {
        return NextResponse.json({ ok: false, error: 'A sessão deve ter exatamente 1 ano de duração' }, { status: 400 })
      }
      data_inicio = `${startYear}-01-01`
      // Fim deve ser exatamente 1 ano - 1 dia após o início: 31/12 do ano inicial
      data_fim = `${startYear}-12-31`
    } else {
      return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 })
    }

    // Mapeia esquemaPeriodos (novo) para periodo_tipo (tabela configuracoes_escola)
    let periodoTipoToSave: "semestre" | "trimestre" | "bimestre" | null = null;
    if (rawEsquema === "semestral") periodoTipoToSave = "semestre";
    if (rawEsquema === "trimestral") periodoTipoToSave = "trimestre";
    if (rawEsquema === "bimestral") periodoTipoToSave = "bimestre";

    const s = await supabaseServer()
    const { data: auth } = await s.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Authorization: allow ONLY escola admins or users with configurar_escola vínculo (super_admin visualiza, mas não altera)
    let allowed = false
    try {
      const { data: vinc } = await s
        .from('escola_users')
        .select('papel')
        .eq('escola_id', escolaId)
        .eq('user_id', user.id)
        .maybeSingle()
      const papel = (vinc as any)?.papel as string | undefined
      if (!allowed) allowed = !!papel && hasPermission(papel as any, 'configurar_escola')
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1)
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0)
      } catch {}
    }
    if (!allowed) {
      // Fallback similar to /onboarding route: check profiles role linked to this escola
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1)
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin')
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: 'Configuração Supabase ausente' },
        { status: 500 }
      )
    }

    const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey) as any

    // Se recebemos esquemaPeriodos no payload novo, gravamos em configuracoes_escola
    if (periodoTipoToSave) {
      try {
        await (admin as any)
          .from("configuracoes_escola")
          .upsert(
            {
              escola_id: escolaId,
              periodo_tipo: periodoTipoToSave,
              autogerar_periodos: true,
            },
            { onConflict: "escola_id" }
          );
      } catch {
        // se a tabela/coluna não existir, não é fatal
      }
    }

    // Upsert ano letivo ativo
    const anoLetivo = Number(String(data_inicio).slice(0, 4))
    const { data: existingAno } = await admin
      .from('anos_letivos')
      .select('id, ativo, ano')
      .eq('escola_id', escolaId)
      .eq('ano', anoLetivo)
      .maybeSingle()

    let anoLetivoId: string | null = null
    if (existingAno?.id) {
      const { error: updErr } = await admin
        .from('anos_letivos')
        .update({
          data_inicio,
          data_fim,
          ativo: true,
        } as any)
        .eq('id', existingAno.id)
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })
      anoLetivoId = existingAno.id
    } else {
      const { data: ins, error: insErr } = await admin
        .from('anos_letivos')
        .insert({
          escola_id: escolaId,
          ano: anoLetivo,
          data_inicio,
          data_fim,
          ativo: true,
        } as any)
        .select('id')
        .single()
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
      anoLetivoId = (ins as any)?.id ?? null
    }

    // Desativa outros anos letivos da escola
    try {
      await (admin as any)
        .from('anos_letivos')
        .update({ ativo: false } as any)
        .eq('escola_id', escolaId)
        .neq('id', anoLetivoId)
    } catch (_) {}

    // Autogerar períodos_letivos para o ano ativo
    const tipoUpper = rawEsquema === 'semestral' ? 'SEMESTRE' : rawEsquema === 'bimestral' ? 'BIMESTRE' : 'TRIMESTRE'
    const parts = tipoUpper === 'SEMESTRE' ? 2 : tipoUpper === 'BIMESTRE' ? 4 : 3

    const splitRanges = (startISO: string, endISO: string, parts: number): Array<{ start: string; end: string }> => {
      const toDate = (s: string) => new Date(`${s}T00:00:00Z`)
      const toISO = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      const start = toDate(String(startISO).slice(0, 10))
      const end = toDate(String(endISO).slice(0, 10))
      const totalDays = Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1
      const chunk = Math.floor(totalDays / parts)
      const remainder = totalDays % parts
      const ranges: Array<{ start: string; end: string }> = []
      let cursor = new Date(start)
      for (let i = 0; i < parts; i++) {
        const len = chunk + (i < remainder ? 1 : 0)
        const segStart = new Date(cursor)
        const segEnd = new Date(cursor)
        segEnd.setUTCDate(segEnd.getUTCDate() + (len - 1))
        ranges.push({ start: toISO(segStart), end: toISO(segEnd) })
        cursor.setUTCDate(cursor.getUTCDate() + len)
      }
      return ranges
    }

    if (anoLetivoId) {
      try {
        await (admin as any)
          .from('periodos_letivos')
          .delete()
          .eq('ano_letivo_id', anoLetivoId)

        const ranges = splitRanges(data_inicio, data_fim, parts)
        const rows = ranges.map((r, idx) => ({
          escola_id: escolaId,
          ano_letivo_id: anoLetivoId,
          tipo: tipoUpper,
          numero: idx + 1,
          data_inicio: r.start,
          data_fim: r.end,
        }))
        await (admin as any)
          .from('periodos_letivos')
          .insert(rows)
      } catch (_) {
        // Não bloqueia a criação do ano letivo
      }
    }

    // Reset drafts para este ano/escola; mantém conclusão do onboarding
    try {
      await (admin as any)
        .from('onboarding_drafts')
        .delete()
        .eq('escola_id', escolaId)
    } catch (_) {}

    // Monta resposta compatível com o wizard atual
    let active: any = null
    let all: any[] = []
    let periodos: any[] = []
    try {
      const { data: anos } = await (admin as any)
        .from('anos_letivos')
        .select('id, ano, data_inicio, data_fim, ativo')
        .eq('escola_id', escolaId)
        .order('ano', { ascending: false })
      all = (anos || []).map((row: any) => ({
        id: row.id,
        nome: `${row.ano}/${row.ano + 1}`,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        status: row.ativo ? 'ativa' : 'arquivada',
        ano_letivo: String(row.ano),
      }))
      active = (all || []).find((s: any) => s.status === 'ativa') || null
    } catch {}

    if (anoLetivoId) {
      try {
        const { data: per } = await (admin as any)
          .from('periodos_letivos')
          .select('id, tipo, numero, data_inicio, data_fim')
          .eq('ano_letivo_id', anoLetivoId)
          .order('numero', { ascending: true })
        periodos = (per || []).map((p: any) => ({
          id: p.id,
          tipo: p.tipo,
          numero: p.numero,
          nome: `${p.numero}º ${p.tipo === 'SEMESTRE' ? 'Semestre' : p.tipo === 'BIMESTRE' ? 'Bimestre' : 'Trimestre'}`,
          data_inicio: p.data_inicio,
          data_fim: p.data_fim,
          sessao_id: anoLetivoId,
        }))
      } catch {}
    }

    return NextResponse.json({ ok: true, data: active, sessoes: all, periodos })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// GET /api/escolas/[id]/onboarding/session
// Lists all sessions for the escola using service role (authorization enforced first)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Authorization similar to POST: allow escola admins or users with configurar_escola vínculo; also allow profiles-based admin link
    let allowed = false;
    try {
      const { data: vinc } = await s
        .from('escola_users')
        .select('papel')
        .eq('escola_id', escolaId)
        .eq('user_id', user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as string | undefined;
      if (!allowed) allowed = !!papel && hasPermission(papel as any, 'configurar_escola');
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1);
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin');
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: anos, error } = await (admin as any)
      .from('anos_letivos')
      .select('id, ano, data_inicio, data_fim, ativo')
      .eq('escola_id', escolaId)
      .order('ano', { ascending: false });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const list = (anos || []).map((row: any) => ({
      id: row.id,
      nome: `${row.ano}/${row.ano + 1}`,
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
      status: row.ativo ? 'ativa' : 'arquivada',
      ano_letivo: String(row.ano),
    }))

    let periodos: any[] = []
    const ativo = (anos || []).find((r: any) => r.ativo)
    if (ativo) {
      const { data: per } = await (admin as any)
        .from('periodos_letivos')
        .select('id, tipo, numero, data_inicio, data_fim')
        .eq('ano_letivo_id', ativo.id)
        .order('numero', { ascending: true })
      periodos = (per || []).map((p: any) => ({
        id: p.id,
        tipo: p.tipo,
        numero: p.numero,
        nome: `${p.numero}º ${p.tipo === 'SEMESTRE' ? 'Semestre' : p.tipo === 'BIMESTRE' ? 'Bimestre' : 'Trimestre'}`,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        sessao_id: ativo.id,
      }))
    }

    return NextResponse.json({ ok: true, data: list, periodos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
