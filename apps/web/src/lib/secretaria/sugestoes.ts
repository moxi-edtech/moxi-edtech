import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export type Turno = "manha" | "tarde" | "noite" | "";

export type SugestoesMatricula = {
  session_id: string | null;
  turno: Turno | null;
  classe_id: string | null;
  curso_id: string | null;
  turma_id: string | null;
};

type AlunoRow = Database["public"]["Tables"]["alunos"]["Row"];
type StagingAlunoRow = Database["public"]["Tables"]["staging_alunos"]["Row"];
type AnoLetivoRow = Database["public"]["Tables"]["anos_letivos"]["Row"];
type ClasseRow = Database["public"]["Tables"]["classes"]["Row"];
type CursoRow = Database["public"]["Tables"]["cursos"]["Row"];
type TurmaRow = Database["public"]["Tables"]["turmas"]["Row"];
type StagingAlunoSugestaoRow = Pick<
  StagingAlunoRow,
  "id" | "curso_codigo" | "classe_numero" | "turno_codigo" | "turma_letra" | "ano_letivo" | "numero_matricula"
>;

function mapTurnoCodigoToLabel(codigo?: string | null): Turno {
  if (!codigo) return "";
  const c = codigo.trim().toUpperCase();
  if (c.startsWith("M")) return "manha";
  if (c.startsWith("T")) return "tarde";
  if (c.startsWith("N")) return "noite";
  return "";
}

/**
 * Centraliza a resolução de sugestões de matrícula a partir do staging.
 * Retorna IDs já prontos para preencher o formulário.
 */
export async function getSugestoesMatricula(
  alunoId: string
): Promise<{
  ok: boolean;
  defaults: SugestoesMatricula;
  escolaId: string | null;
  source: { staging_id: number } | null;
}> {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, defaults: { session_id: null, turno: null, classe_id: null, curso_id: null, turma_id: null }, escolaId: null, source: null };

  const { data: aluno } = await supabase
    .from('alunos')
    .select('id, escola_id, profile_id, email, bi_numero, nome')
    .eq('id', alunoId)
    .maybeSingle();
  const escolaId = (aluno as AlunoRow | null)?.escola_id ?? undefined;
  if (!aluno || !escolaId) return { ok: false, defaults: { session_id: null, turno: null, classe_id: null, curso_id: null, turma_id: null }, escolaId: escolaId ?? null, source: null };

  // check vínculo
  const { data: vinc } = await supabase
    .from('escola_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('escola_id', escolaId)
    .limit(1);
  if (!vinc || vinc.length === 0) {
    return { ok: false, defaults: { session_id: null, turno: null, classe_id: null, curso_id: null, turma_id: null }, escolaId, source: null };
  }

  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin: SupabaseClient<Database> | null =
    adminUrl && serviceKey ? createAdminClient<Database>(adminUrl, serviceKey) : null;

  let staging: StagingAlunoSugestaoRow | null = null;
  if (admin) {
    const tryQueries: Array<{ col: "profile_id" | "email" | "bi"; val?: string | null }> = [
      { col: 'profile_id', val: aluno?.profile_id ?? null },
      { col: 'email', val: aluno?.email ?? null },
      { col: 'bi', val: aluno?.bi_numero ?? null },
    ];
    for (const t of tryQueries) {
      if (!t.val) continue;
      const { data } = await admin
        .from('staging_alunos')
        .select('id, curso_codigo, classe_numero, turno_codigo, turma_letra, ano_letivo, numero_matricula')
        .eq('escola_id', escolaId)
        .eq(t.col, t.val)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data[0]) { staging = data[0]; break; }
    }
  }

  let suggestedAnoLetivoId: string | null = null;
  let suggestedClasseId: string | null = null;
  let suggestedCursoId: string | null = null;
  let suggestedTurno: Turno = "";
  let suggestedTurmaId: string | null = null;

  if (admin) {
    if (staging?.ano_letivo) {
      const yr = Number(staging.ano_letivo);
      const { data: anosByEq } = await admin
        .from('anos_letivos')
        .select('id, ano')
        .eq('escola_id', escolaId)
        .eq('ano', yr)
        .limit(1);
      if (anosByEq && anosByEq[0]) {
        suggestedAnoLetivoId = (anosByEq[0] as AnoLetivoRow).id;
      } else {
        const { data: anosByRecent } = await admin
          .from('anos_letivos')
          .select('id, ano')
          .eq('escola_id', escolaId)
          .order('data_inicio', { ascending: false })
          .limit(1);
        if (anosByRecent && anosByRecent[0]) {
          suggestedAnoLetivoId = (anosByRecent[0] as AnoLetivoRow).id;
        }
      }
    }
    if (!suggestedAnoLetivoId) {
      const { data: active } = await admin
        .from('anos_letivos')
        .select('id, ano')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .limit(1);
      if (active && active[0]) suggestedAnoLetivoId = (active[0] as AnoLetivoRow).id;
    }
  }

  if (admin && staging?.classe_numero) {
    const { data: cls } = await admin
      .from('classes')
      .select('id, numero, nome')
      .eq('escola_id', escolaId)
      .eq('numero', Number(staging.classe_numero))
      .limit(1);
    if (cls && cls[0]) suggestedClasseId = (cls[0] as ClasseRow).id;
  }

  if (admin && staging?.curso_codigo) {
    const code = String(staging.curso_codigo).toUpperCase();
    const { data: crs } = await admin
      .from('cursos')
      .select('id, codigo, nome')
      .eq('escola_id', escolaId)
      .eq('codigo', code)
      .limit(1);
    if (crs && crs[0]) suggestedCursoId = (crs[0] as CursoRow).id;
  }

  suggestedTurno = mapTurnoCodigoToLabel(staging?.turno_codigo);

  if (admin && suggestedAnoLetivoId) {
    let anoLetivoNumero: number | null = null;
    try {
      const { data: sess } = await admin
        .from('anos_letivos')
        .select('id, ano')
        .eq('id', suggestedAnoLetivoId)
        .single();
      anoLetivoNumero = (sess as AnoLetivoRow | null)?.ano ?? null;
    } catch {}
    if (anoLetivoNumero !== null) {
      const { data: turmas } = await admin
        .from('turmas')
        .select('id, nome, turno, ano_letivo')
        .eq('escola_id', escolaId)
        .eq('ano_letivo', anoLetivoNumero)
        .order('nome');
      if (turmas && turmas.length) {
        const letra = (staging?.turma_letra || '').toString().trim().toUpperCase();
        const turno = suggestedTurno;
        const byLetter = (turmas as TurmaRow[]).filter((t) =>
          letra && (t.nome || '').toUpperCase().trim().endsWith(` ${letra}`)
        );
        const allTurmas = (turmas as TurmaRow[]);
        const scoped = byLetter.length ? byLetter : allTurmas;
        const byTurno = turno ? scoped.filter((t) => (t.turno || '') === turno) : scoped;
        if (byTurno[0]) suggestedTurmaId = byTurno[0].id;
      }
    }
  }

  return {
    ok: true,
    escolaId: escolaId ?? null,
    defaults: {
      session_id: suggestedAnoLetivoId,
      turno: suggestedTurno || null,
      classe_id: suggestedClasseId,
      curso_id: suggestedCursoId,
      turma_id: suggestedTurmaId,
    },
    source: staging ? { staging_id: staging.id } : null,
  };
}
