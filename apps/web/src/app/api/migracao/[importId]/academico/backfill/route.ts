import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { importBelongsToEscola, userHasAccessToEscola } from "../../auth-helpers";

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
  sessions: Array<{ nome: string; status: "planejada" | "ativa"; data_inicio: string; data_fim: string }>;
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
    // Adicionamos curso_codigo aqui para poder vincular a turma ao curso se necessário
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
      // Normalização
      const curso = normalizeCode(r.curso_codigo);
      const turno = mapTurnoCodigoToLabel(r.turno_codigo);
      const letra = normalizeCode(r.turma_letra);
      const ano = Number(r.ano_letivo);
      const classeNum = Number(r.classe_numero);

      if (curso) cursosSet.add(curso);
      if (Number.isFinite(classeNum)) classesSet.add(classeNum);
      if (Number.isFinite(ano)) sessionsSet.add(ano);

      // Identificar Turmas Únicas
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

    // 4. Buscar Dados Existentes na Escola (Para calcular o delta)
    // Buscamos tudo para evitar N+1 queries, assumindo que uma escola não tem dados infinitos.

    const [cursosRes, classesRes, sessRes, turmasRes] = await Promise.all([
      (admin as any).from("cursos").select("id, codigo").eq("escola_id", escolaId),
      (admin as any).from("classes").select("id, numero").eq("escola_id", escolaId),
      (admin as any).from("school_sessions").select("id, nome").eq("escola_id", escolaId),
      (admin as any).from("turmas").select("id, nome, ano_letivo, session_id, classe_id, turno, curso_id").eq("escola_id", escolaId)
    ]);

    const existingCursos = new Map<string, string>(); // Codigo -> ID
    (cursosRes.data || []).forEach((c: any) => existingCursos.set(normalizeCode(c.codigo), c.id));

    const existingClasses = new Map<number, string>(); // Numero -> ID
    (classesRes.data || []).forEach((c: any) => {
        if (Number.isFinite(Number(c.numero))) existingClasses.set(Number(c.numero), c.id);
    });

    const existingSessions = new Map<string, string>(); // Nome (Ano) -> ID
    (sessRes.data || []).forEach((s: any) => existingSessions.set(String(s.nome).trim(), s.id));

    // Turmas existentes: Chave composta para comparação
    // Nota: Comparamos por Nome + Sessão (Ano) para simplificar, ou podemos ser mais estritos.
    // Aqui usamos uma lógica fuzzy para encontrar "10ª A" no ano "2025".
    const existingTurmas = (turmasRes.data || []) as any[];

    // 5. Montar o Preview (O que falta criar?)
    
    const preview: BackfillPreview = {
      cursos: [],
      classes: [],
      sessions: [],
      turmas: []
    };

    // Cursos Faltantes
    cursosSet.forEach(codigo => {
      if (!existingCursos.has(codigo)) {
        preview.cursos.push({ codigo, nome: codigo }); // Usa código como nome provisório
      }
    });

    // Classes Faltantes
    classesSet.forEach(num => {
      if (!existingClasses.has(num)) {
        preview.classes.push({ numero: num, nome: `${num}ª Classe` });
      }
    });

    // Sessões Faltantes
    sessionsSet.forEach(ano => {
      const anoStr = String(ano);
      if (!existingSessions.has(anoStr)) {
        preview.sessions.push({
          nome: anoStr,
          status: "planejada",
          data_inicio: `${ano}-02-01`, // Data padrão Angola (Fev)
          data_fim: `${ano}-12-20`     // Data padrão Angola (Dez)
        });
      }
    });

    // Turmas Faltantes
    for (const t of turmasDesired) {
      const sessId = existingSessions.get(t.ano_letivo); // Pode ser undefined se a sessão tbm for nova
      
      // Verifica se já existe uma turma com este nome nesta sessão (se a sessão existir)
      const exists = sessId && existingTurmas.some(et => 
        et.session_id === sessId && 
        normalizeCode(et.nome) === normalizeCode(t.nome)
      );

      // Se não existe (ou se a sessão é nova), adiciona ao preview
      if (!exists) {
        preview.turmas.push(t);
      }
    }

    // --- RETORNO PREVIEW ---
    if (!apply) {
      return NextResponse.json({
        ok: true,
        preview,
        create: {
          cursos: preview.cursos.length,
          classes: preview.classes.length,
          sessions: preview.sessions.length,
          turmas: preview.turmas.length
        }
      });
    }

    // --- EXECUÇÃO (APPLY) ---
    // Ordem crítica: Sessões -> Classes -> Cursos -> Turmas (dependentes)

    // 1. Criar Sessões
    for (const s of preview.sessions) {
      const { data, error } = await (admin as any)
        .from("school_sessions")
        .insert({ escola_id: escolaId, nome: s.nome, data_inicio: s.data_inicio, data_fim: s.data_fim, status: s.status })
        .select("id")
        .single();
      
      if (error) throw new Error(`Erro ao criar sessão ${s.nome}: ${error.message}`);
      existingSessions.set(s.nome, data.id); // Atualiza mapa para uso nas turmas
    }

    // 2. Criar Classes
    for (const c of preview.classes) {
      const { data, error } = await (admin as any)
        .from("classes")
        .insert({ escola_id: escolaId, nome: c.nome, numero: c.numero })
        .select("id")
        .single();

      if (error) throw new Error(`Erro ao criar classe ${c.nome}: ${error.message}`);
      existingClasses.set(c.numero, data.id);
    }

    // 3. Criar Cursos
    for (const c of preview.cursos) {
      const { data, error } = await (admin as any)
        .from("cursos")
        .insert({ escola_id: escolaId, codigo: c.codigo, nome: c.nome }) // Nome = Código por padrão
        .select("id")
        .single();

      if (error) throw new Error(`Erro ao criar curso ${c.codigo}: ${error.message}`);
      existingCursos.set(c.codigo, data.id);
    }

    // 4. Criar Turmas
    for (const t of preview.turmas) {
      const sessionId = existingSessions.get(t.ano_letivo);
      const classeId = existingClasses.get(t.classe_numero);
      const cursoId = t.curso_codigo ? existingCursos.get(t.curso_codigo) : null;

      if (!sessionId) {
        console.warn(`Ignorando turma ${t.nome}: Sessão ${t.ano_letivo} não resolvida.`);
        continue;
      }

      // Prepara objeto de inserção
      const payload: any = {
        escola_id: escolaId,
        nome: t.nome,
        ano_letivo: t.ano_letivo,
        turno: t.turno,
        session_id: sessionId,
        classe_id: classeId || null, // Pode ser null se não conseguimos mapear a classe
        curso_id: cursoId || null,   // Vincula ao curso se houver
        capacidade_maxima: 35        // Padrão seguro
      };

      const { error } = await (admin as any).from("turmas").insert(payload);
      if (error) {
        // Não aborta tudo por uma turma, mas loga
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