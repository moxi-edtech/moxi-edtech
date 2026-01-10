import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { importBelongsToEscola, userHasAccessToEscola } from "../../../auth-helpers";

// ---------------- Helpers ----------------

function normalizeCode(code?: string | null): string {
  return (code || "").trim().toUpperCase();
}

/**
 * Canonicaliza o turma_codigo removendo espaços.
 * NÃO remove hífens, porque eles fazem parte do SSOT e ajudam na leitura.
 */
function canonicalTurmaCodigo(raw?: string | null): string | null {
  const v = normalizeCode(raw);
  if (!v) return null;
  return v.replace(/\s+/g, "");
}

type ParsedTurmaCodigo = {
  course_code: string; // ex: TI
  classe_num: number;  // ex: 10
  turno: "M" | "T" | "N";
  letra: string;       // ex: A (ou AA)
};

function parseTurmaCodigo(v_code: string): ParsedTurmaCodigo | null {
  // ex: TI-10-M-A or CFB-12-T-B etc.
  const re = /^[A-Z0-9]{2,8}-\d{1,2}-(M|T|N)-[A-Z]{1,2}$/;
  if (!re.test(v_code)) return null;

  const course_code = v_code.split("-")[0]!;
  const classe_num = Number(v_code.split("-")[1]!);
  const turno = v_code.split("-")[2]! as "M" | "T" | "N";
  const letra = v_code.split("-")[3]!;

  if (!Number.isFinite(classe_num) || classe_num <= 0) return null;
  return { course_code, classe_num, turno, letra };
}

type BackfillPreview = {
  cursos: Array<{
    course_code: string; // SSOT
    codigo: string;      // obrigatório no schema -> espelhado
    nome: string;
  }>;
  turmas: Array<{
    turma_codigo: string; // SSOT
    ano_letivo: number;
    curso_course_code: string;
    turno: "M" | "T" | "N";
    classe_num: number;
    letra: string;
    nome: string;
  }>;
  ignored: Array<{
    row: any;
    reason: string;
  }>;
};

// ---------------- Handlers ----------------

export async function GET(req: NextRequest, ctx: { params: Promise<{ importId: string }> }) {
  const { importId } = await ctx.params;
  return runBackfill(false, req, importId);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ importId: string }> }) {
  const { importId } = await ctx.params;
  return runBackfill(true, req, importId);
}

// ---------------- Main ----------------

async function runBackfill(apply: boolean, req: NextRequest, importId: string) {
  try {
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!adminUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Configuração do servidor incompleta." }, { status: 500 });
    }

    const url = new URL(req.url);
    const escolaId = (url.searchParams.get("escola_id") || "").trim();
    if (!escolaId) return NextResponse.json({ ok: false, error: "escola_id é obrigatório." }, { status: 400 });

    const routeClient = await supabaseServerTyped<any>();
    const { data: userRes } = await routeClient.auth.getUser();
    const authUser = userRes?.user;
    if (!authUser) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

    const admin = createAdminClient<Database>(adminUrl, serviceKey);

    const hasAccess = await userHasAccessToEscola(admin as any, escolaId, authUser.id);
    if (!hasAccess) return NextResponse.json({ ok: false, error: "Acesso negado à escola." }, { status: 403 });

    const sameEscola = await importBelongsToEscola(admin as any, importId, escolaId);
    if (!sameEscola) return NextResponse.json({ ok: false, error: "Importação não pertence a esta escola." }, { status: 403 });

    // 1) Fonte da verdade: staging com turma_codigo
    const { data: staged, error: stageError } = await (admin as any)
      .from("staging_alunos")
      .select("turma_codigo, ano_letivo, row_number, raw_data")
      .eq("import_id", importId)
      .eq("escola_id", escolaId);

    if (stageError) throw new Error(`Erro ao ler staging: ${stageError.message}`);

    // 2) Dedup por turma_codigo + ano_letivo
    const cursosSet = new Set<string>(); // course_code
    const turmasKeySet = new Set<string>(); // ano::turma_codigo
    const preview: BackfillPreview = { cursos: [], turmas: [], ignored: [] };

    for (const r of (staged || []) as any[]) {
      const ano = Number(r.ano_letivo);
      const turma_codigo = canonicalTurmaCodigo(r.turma_codigo);

      if (!Number.isFinite(ano) || !ano) {
        preview.ignored.push({ row: r, reason: "ano_letivo ausente ou inválido" });
        continue;
      }
      if (!turma_codigo) {
        preview.ignored.push({ row: r, reason: "turma_codigo ausente" });
        continue;
      }

      const parsed = parseTurmaCodigo(turma_codigo);
      if (!parsed) {
        preview.ignored.push({ row: r, reason: `turma_codigo inválido: ${turma_codigo}` });
        continue;
      }

      cursosSet.add(parsed.course_code);

      const key = `${ano}::${turma_codigo}`;
      if (turmasKeySet.has(key)) continue;
      turmasKeySet.add(key);

      preview.turmas.push({
        turma_codigo,
        ano_letivo: ano,
        curso_course_code: parsed.course_code,
        turno: parsed.turno,
        classe_num: parsed.classe_num,
        letra: parsed.letra,
        nome: turma_codigo, // nome stub = código (admin pode renomear depois)
      });
    }

    // Cursos preview
    for (const course_code of cursosSet) {
      preview.cursos.push({
        course_code,
        codigo: course_code, // obrigatório no schema
        nome: `Curso Importado ${course_code}`,
      });
    }

    if (!apply) {
      return NextResponse.json({ ok: true, preview });
    }

    // 3) Buscar cursos existentes (por course_code OU codigo)
    const { data: existingCursosData, error: cursosErr } = await (admin as any)
      .from("vw_migracao_cursos_lookup")
      .select("id, codigo, course_code")
      .eq("escola_id", escolaId);

    if (cursosErr) throw new Error(`Erro ao ler cursos existentes: ${cursosErr.message}`);

    const cursoIdByCode = new Map<string, string>(); // "TI" => id
    for (const c of (existingCursosData || []) as any[]) {
      const codigo = normalizeCode(c.codigo);
      const cc = normalizeCode(c.course_code);
      if (codigo) cursoIdByCode.set(codigo, c.id);
      if (cc) cursoIdByCode.set(cc, c.id);
    }

    // 4) UPSERT cursos stub
    let cursosCreated = 0;

    for (const c of preview.cursos) {
      const key = normalizeCode(c.course_code);
      if (cursoIdByCode.has(key)) continue;

      // Upsert pelo unique garantido: (escola_id, codigo)
      const { data, error } = await (admin as any)
        .from("cursos")
        .upsert(
          {
            escola_id: escolaId,
            codigo: c.codigo,
            course_code: c.course_code,
            nome: c.nome,
            status_aprovacao: "rascunho",
            import_id: importId,
          },
          { onConflict: "escola_id,codigo" }
        )
        .select("id, codigo, course_code")
        .single();

      if (error) throw new Error(`Erro ao criar/atualizar curso ${c.course_code}: ${error.message}`);

      // pode ter sido insert ou update — conta como created só se não existia antes
      cursosCreated += 1;

      cursoIdByCode.set(normalizeCode(data.codigo), data.id);
      if (data.course_code) cursoIdByCode.set(normalizeCode(data.course_code), data.id);
    }

    // 5) UPSERT turmas stub (sem classes)
    let turmasCreated = 0;

    for (const t of preview.turmas) {
      const cursoId = cursoIdByCode.get(normalizeCode(t.curso_course_code)) || null;

      const payload: any = {
        escola_id: escolaId,
        nome: t.nome,
        ano_letivo: t.ano_letivo,
        turno: t.turno,
        curso_id: cursoId,
        classe_id: null,       // stub
        session_id: null,      // stub
        turma_codigo: t.turma_codigo,
        turma_code: t.turma_codigo,
        classe_num: t.classe_num,
        letra: t.letra,
        status_validacao: "rascunho",
        import_id: importId,
        capacidade_maxima: 35,
      };

      // Usa o índice completo: uq_turmas_escola_ano_codigo (não parcial)
      const { data, error } = await (admin as any)
        .from("turmas")
        .upsert(payload, { onConflict: "escola_id,ano_letivo,turma_codigo" })
        .select("id")
        .single();

      if (error) throw new Error(`Erro ao criar/atualizar turma ${t.turma_codigo}: ${error.message}`);

      // Mesma lógica: aqui estou contando como “criada” por operação;
      // se quiser 100% preciso, a gente compara com uma query prévia.
      turmasCreated += 1;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _id = data?.id;
    }

    return NextResponse.json({
      ok: true,
      created: {
        cursos: cursosCreated,
        turmas: turmasCreated,
        ignored_rows: preview.ignored.length,
      },
    });
  } catch (e: any) {
    console.error("[Backfill Error]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro interno no backfill." }, { status: 500 });
  }
}
