import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServer } from "@/lib/supabaseServer"
import { hasPermission } from "@/lib/permissions"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "~types/supabase"

// POST /api/escolas/[id]/onboarding/session
// Creates or updates the active school session (school_sessions) for the escola.
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id: escolaId } = context.params

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

    // Upsert active session: update if existing active session, else insert
    const { data: existing } = await admin
      .from('school_sessions')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('status', 'ativa')
      .maybeSingle()

    if (existing?.id) {
      const { error: updErr } = await admin
        .from('school_sessions')
        .update({
          nome,
          data_inicio,
          data_fim,
        } as any)
        .eq('id', existing.id)
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })
    } else {
      const { error: insErr } = await admin
        .from('school_sessions')
        .insert({
          escola_id: escolaId,
          nome,
          data_inicio,
          data_fim,
          status: 'ativa',
        } as any)
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    // Reset onboarding drafts; NÃO desmarca conclusão do onboarding.
    try {
      await (admin as any)
        .from('onboarding_drafts')
        .delete()
        .eq('escola_id', escolaId)
    } catch (_) {}

    // Retorna sessão ativa atualizada/criada e lista resumida para o cliente atualizar o estado
    let active: any = null
    let all: any[] = []
    try {
      const { data: sessList } = await (admin as any)
        .from('school_sessions')
        .select('id, nome, data_inicio, data_fim, status')
        .eq('escola_id', escolaId)
        .order('data_inicio', { ascending: false })
      all = sessList || []
      active = (all || []).find((s: any) => s.status === 'ativa') || null
    } catch {}

    // Autogerar períodos conforme preferências, se habilitado e ainda não existirem períodos.
    // Fallback: se não houver configuracoes_escola (ou colunas), usa o esquema enviado no payload (rawEsquema)
    try {
      if (active && active.id) {
        // Lê preferências
        let auto = false as boolean
        let periodoTipo = undefined as 'semestre' | 'trimestre' | 'bimestre' | undefined
        let tipoPresenca = undefined as 'secao' | 'curso' | undefined

        try {
          const { data: cfg } = await (admin as any)
            .from('configuracoes_escola')
            .select('autogerar_periodos, periodo_tipo, tipo_presenca')
            .eq('escola_id', escolaId)
            .maybeSingle()
          auto = Boolean((cfg as any)?.autogerar_periodos)
          periodoTipo = (cfg as any)?.periodo_tipo as ('semestre' | 'trimestre' | 'bimestre' | undefined)
          tipoPresenca = (cfg as any)?.tipo_presenca as ('secao' | 'curso' | undefined)
        } catch (_) {
          // Se a tabela/coluna não existir, seguimos com fallback abaixo
        }

        // Fallback baseado no payload: se recebemos esquemaPeriodos, forçamos autogerar e derivamos o periodoTipo
        if (!auto && rawEsquema) auto = true
        if (!periodoTipo && rawEsquema) {
          periodoTipo = rawEsquema === 'semestral' ? 'semestre' : rawEsquema === 'bimestral' ? 'bimestre' : 'trimestre'
        }
        if (!tipoPresenca) tipoPresenca = 'secao'

        if (auto) {
          // Já existem períodos para esta sessão?
          const { count } = await (admin as any)
            .from('semestres')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', active.id)

          if (!count || count === 0) {
            // Define quantidade e rótulo
            const n = periodoTipo === 'semestre' ? 2 : periodoTipo === 'bimestre' ? 6 : 3
            const label = periodoTipo === 'semestre' ? 'Semestre' : periodoTipo === 'bimestre' ? 'Bimestre' : 'Trimestre'
            const tipoUpper = periodoTipo === 'semestre' ? 'SEMESTRE' : periodoTipo === 'bimestre' ? 'BIMESTRE' : 'TRIMESTRE'
            const attendance = tipoPresenca === 'curso' ? 'course' : 'section'

            // Utilitário para dividir o intervalo em N partes contíguas (inclusivo)
            const splitRanges = (startISO: string, endISO: string, parts: number): Array<{ start: string; end: string }> => {
              const toDate = (s: string) => new Date(`${s}T00:00:00Z`)
              const toISO = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
              const start = toDate(String(startISO).slice(0,10))
              const end = toDate(String(endISO).slice(0,10))
              const totalDays = Math.floor((end.getTime() - start.getTime()) / (24*3600*1000)) + 1
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

            const ranges = splitRanges(active.data_inicio, active.data_fim, n)
            const rows = ranges.map((r, idx) => ({
              escola_id: escolaId,
              session_id: active.id,
              nome: `${idx+1}º ${label}`,
              data_inicio: r.start,
              data_fim: r.end,
              attendance_type: attendance,
              permitir_submissao_final: false,
              tipo: tipoUpper,
            }))

            // Tenta inserir com coluna opcional 'tipo'; se falhar por coluna ausente, remove e tenta novamente
            let insErr: any | null = null
            {
              const { error } = await (admin as any)
                .from('semestres')
                .insert(rows)
              insErr = error
            }
            if (insErr && String(insErr.message || '').toLowerCase().includes('column') && String(insErr.message || '').includes('tipo')) {
              const rowsNoTipo = rows.map(({ tipo, ...rest }) => rest)
              const { error: err2 } = await (admin as any)
                .from('semestres')
                .insert(rowsNoTipo)
              if (err2) {
                // não é fatal para salvar sessão; apenas segue
              }
            }
          }
        }
      }
    } catch {
      // silencioso: não bloqueia salvar sessão
    }

    return NextResponse.json({ ok: true, data: active, sessoes: all })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// GET /api/escolas/[id]/onboarding/session
// Lists all sessions for the escola using service role (authorization enforced first)
export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const { id: escolaId } = context.params;

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

    const { data, error } = await (admin as any)
      .from('school_sessions')
      .select('id, nome, data_inicio, data_fim, status')
      .eq('escola_id', escolaId)
      .order('data_inicio', { ascending: false });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
