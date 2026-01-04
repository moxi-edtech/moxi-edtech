import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { importBelongsToEscola, userHasAccessToEscola } from "../../../auth-helpers";

// --- HELPERS DE NORMALIZAÇÃO ---

function normalizeCode(code?: string | null): string {
  return (code || "").trim().toUpperCase();
}

function mapTurnoCodigoToLabel(codigo?: string | null): "manha" | "tarde" | "noite" | null {
  const c = normalizeCode(codigo);
  if (c.startsWith("M")) return "manha";
  if (c.startsWith("T")) return "tarde";
  if (c.startsWith("N")) return "noite";
  return null; // Default ou null se não mapeado
}

function generateTurmaName(classeNumero: number, letra?: string | null): string {
  const classePart = `${classeNumero}ª Classe`;
  const letraPart = letra ? ` ${letra.toUpperCase()}` : "";
  return `${classePart}${letraPart}`.trim();
}

type BackfillPreview = {
  cursos: Array<{ codigo: string; nome: string }>;
  classes: Array<{ numero: number; nome: string }>;
  sessions: Array<{ ano: number; ativo: boolean; data_inicio: string; data_fim: string }>;
  turmas: Array<{ 
    nome: string; 
    ano_letivo: string; 
    turno: string | null; 
    classe_numero: number; 
    turma_letra: string | null;
    curso_codigo?: string | null; // Importante para vincular turma a curso técnico
  }>;
};

// --- HANDLERS ---

export async function GET(req: NextRequest, ctx: { params: Promise<{ importId: string }> }) {
  const { importId } = await ctx.params;
  return runBackfill(false, req, importId);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ importId: string }> }) {
  const { importId } = await ctx.params;
  return runBackfill(true, req, importId);
}

// --- LÓGICA PRINCIPAL ---

async function runBackfill(apply: boolean, req: NextRequest, importId: string) {
  try {
    // 1. Configuração e Autenticação
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

    // 2. Verificação de Acesso
    const hasAccess = await userHasAccessToEscola(admin as any, escolaId, authUser.id);
    if (!hasAccess) return NextResponse.json({ ok: false, error: "Acesso negado à escola." }, { status: 403 });

    const sameEscola = await importBelongsToEscola(admin as any, importId, escolaId);
    if (!sameEscola) return NextResponse.json({ ok: false, error: "Importação não pertence a esta escola." }, { status: 403 });

    // 3. Coletar Dados do Staging (Fonte da Verdade)
    const { data: staged, error: stageError } = await (admin as any)
      .from("staging_alunos")
      .select("curso_codigo, classe_numero, turno_codigo, turma_letra, ano_letivo")
      .eq("import_id", importId)
      .eq("escola_id", escolaId);

    if (stageError) throw new Error(`Erro ao ler staging: ${stageError.message}`);

    // Sets para deduplicação
    const cursosSet = new Set<string>();
    const classesSet = new Set<number>();
    const sessionsSet = new Set<number>();
    const turmasKeySet = new Set<string>();
    
    const turmasDesired: BackfillPreview["turmas"] = [];

    // Processar linhas do CSV
    for (const r of (staged || []) as any[]) {
      const curso = normalizeCode(r.curso_codigo);
      const turno = mapTurnoCodigoToLabel(r.turno_codigo);
      const letra = normalizeCode(r.turma_letra);
      const ano = Number(r.ano_letivo);
      const classeNum = Number(r.classe_numero);

      if (curso) cursosSet.add(curso);
      if (Number.isFinite(classeNum)) classesSet.add(classeNum);
      if (Number.isFinite(ano)) sessionsSet.add(ano);

      if (ano && classeNum) {
        const key = `${ano}::${classeNum}::${turno || 'N/A'}::${letra || 'N/A'}::${curso || 'GERAL'}`;
        
        if (!turmasKeySet.has(key)) {
          turmasKeySet.add(key);
          
          const nomeTurma = generateTurmaName(classeNum, letra);
          
          turmasDesired.push({
            nome: nomeTurma,
            ano_letivo: String(ano),
            turno,
            classe_numero: classeNum,
            turma_letra: letra || null,
            curso_codigo: curso || null
          });
        }
      }
    }

    // 4. Buscar Dados Existentes na Escola
    const [cursosRes, classesRes, anosLetivosRes, turmasRes] = await Promise.all([
      (admin as any).from("cursos").select("id, codigo").eq("escola_id", escolaId),
      (admin as any).from("classes").select("id, numero").eq("escola_id", escolaId),
      (admin as any).from("anos_letivos").select("id, ano, ativo").eq("escola_id", escolaId),
      (admin as any).from("turmas").select("id, nome, ano_letivo, classe_id, turno, curso_id").eq("escola_id", escolaId)
    ]);

    const existingCursos = new Map<string, string>(); // Codigo -> ID
    (cursosRes.data || []).forEach((c: any) => existingCursos.set(normalizeCode(c.codigo), c.id));

    const existingClasses = new Map<number, string>(); // Numero -> ID
    (classesRes.data || []).forEach((c: any) => {
        if (Number.isFinite(Number(c.numero))) existingClasses.set(Number(c.numero), c.id);
    });

    const existingAnosLetivos = new Map<string, string>(); // Ano -> ID
    let hasActiveAnoLetivo = false;
    (anosLetivosRes.data || []).forEach((s: any) => {
        const ano = String(s.ano).trim();
        existingAnosLetivos.set(ano, s.id);
        if (s.ativo === true) hasActiveAnoLetivo = true;
    });

    const existingTurmas = (turmasRes.data || []) as any[];

    // 5. Montar o Preview (O que falta criar?)
    const preview: BackfillPreview = {
      cursos: [],
      classes: [],
      sessions: [],
      turmas: []
    };

    cursosSet.forEach(codigo => {
      if (!existingCursos.has(codigo)) {
        preview.cursos.push({ codigo, nome: codigo });
      }
    });

    classesSet.forEach(num => {
      if (!existingClasses.has(num)) {
        preview.classes.push({ numero: num, nome: `${num}ª Classe` });
      }
    });

    const missingAnos = Array.from(sessionsSet).filter(ano => {
      const anoStr = String(ano);
      return !existingAnosLetivos.has(anoStr);
    }).sort((a, b) => Number(a) - Number(b));

    let alreadyHasActive = hasActiveAnoLetivo;
    missingAnos.forEach((ano, idx) => {
      const shouldBeActive = !alreadyHasActive && idx === missingAnos.length - 1;
      
      preview.sessions.push({
        ano: ano,
        ativo: shouldBeActive,
        data_inicio: `${ano}-02-01`,
        data_fim: `${ano}-12-20`
      });

      if (shouldBeActive) alreadyHasActive = true;
    });

    for (const t of turmasDesired) {
      const anoLetivoId = existingAnosLetivos.get(t.ano_letivo);
      
      const exists = anoLetivoId && existingTurmas.some(et => 
        et.ano_letivo === Number(t.ano_letivo) && 
        normalizeCode(et.nome) === normalizeCode(t.nome)
      );

      if (!exists) {
        preview.turmas.push(t);
      }
    }

    if (!apply) {
      return NextResponse.json({ ok: true, preview });
    }

    // --- EXECUÇÃO (APPLY) ---
    for (const s of preview.sessions) {
      const { data, error } = await (admin as any)
        .from("anos_letivos")
        .insert({ escola_id: escolaId, ano: s.ano, data_inicio: s.data_inicio, data_fim: s.data_fim, ativo: s.ativo })
        .select("id")
        .single();
      
      if (error) throw new Error(`Erro ao criar ano letivo ${s.ano}: ${error.message}`);
      existingAnosLetivos.set(String(s.ano), data.id);
    }

    for (const c of preview.classes) {
      const { data, error } = await (admin as any)
        .from("classes")
        .insert({ escola_id: escolaId, nome: c.nome, numero: c.numero })
        .select("id")
        .single();

      if (error) throw new Error(`Erro ao criar classe ${c.nome}: ${error.message}`);
      existingClasses.set(c.numero, data.id);
    }

    for (const c of preview.cursos) {
      const { data, error } = await (admin as any)
        .from("cursos")
        .insert({ escola_id: escolaId, codigo: c.codigo, nome: c.nome })
        .select("id")
        .single();

      if (error) throw new Error(`Erro ao criar curso ${c.codigo}: ${error.message}`);
      existingCursos.set(c.codigo, data.id);
    }

    for (const t of preview.turmas) {
      const classeId = existingClasses.get(t.classe_numero);
      const cursoId = t.curso_codigo ? existingCursos.get(t.curso_codigo) : null;
      
      if (t.curso_codigo && !cursoId) {
        console.warn(`Ignorando turma ${t.nome}: Curso ${t.curso_codigo} não encontrado.`);
        continue;
      }

      const payload: any = {
        escola_id: escolaId,
        nome: t.nome,
        ano_letivo: t.ano_letivo,
        turno: t.turno,
        classe_id: classeId || null,
        curso_id: cursoId || null,
        capacidade_maxima: 35
      };

      const { error } = await (admin as any).from("turmas").insert(payload);
      if (error) {
        console.error(`Falha ao criar turma ${t.nome}: ${error.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      created: {
        cursos: preview.cursos.length,
        classes: preview.classes.length,
        sessions: preview.sessions.length,
        turmas: preview.turmas.length
      }
    });

  } catch (e: any) {
    console.error("[Backfill Error]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro interno no backfill." }, { status: 500 });
  }
}
