import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export type Turno = "manha" | "tarde" | "noite" | "";

export type SugestoesMatricula = {
  session_id: string | null;
  turno: Turno | null;
  classe_id: string | null;
  curso_id: string | null;
  turma_id: string | null;
};

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
export async function getSugestoesMatricula(alunoId: string): Promise<{ ok: boolean; defaults: SugestoesMatricula; escolaId: string | null; source: any }>{
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, defaults: { session_id: null, turno: null, classe_id: null, curso_id: null, turma_id: null }, escolaId: null, source: null };

  const { data: aluno } = await supabase
    .from('alunos')
    .select('id, escola_id, profile_id, email, bi_numero, nome')
    .eq('id', alunoId)
    .maybeSingle();
  const escolaId = (aluno as any)?.escola_id as string | undefined;
  if (!aluno || !escolaId) return { ok: false, defaults: { session_id: null, turno: null, classe_id: null, curso_id: null, turma_id: null }, escolaId: escolaId ?? null, source: null };

  // check vínculo
  const { data: vinc } = await supabase
    .from('escola_usuarios')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('escola_id', escolaId)
    .limit(1);
  if (!vinc || vinc.length === 0) {
    return { ok: false, defaults: { session_id: null, turno: null, classe_id: null, curso_id: null, turma_id: null }, escolaId, source: null };
  }

  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = adminUrl && serviceKey ? createAdminClient<Database>(adminUrl, serviceKey) : null;

  let staging: any | null = null;
  if (admin) {
    const tryQueries: Array<{ col: string; val?: string | null }> = [
      { col: 'profile_id', val: (aluno as any)?.profile_id },
      { col: 'email', val: (aluno as any)?.email },
      { col: 'bi', val: (aluno as any)?.bi_numero },
    ];
    for (const t of tryQueries) {
      if (!t.val) continue;
      const { data } = await (admin as any)
        .from('staging_alunos')
        .select('id, curso_codigo, classe_numero, turno_codigo, turma_letra, ano_letivo, numero_matricula')
        .eq('escola_id', escolaId)
        .eq(t.col as any, t.val)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data[0]) { staging = data[0]; break; }
    }
  }

  let suggestedSessionId: string | null = null;
  let suggestedClasseId: string | null = null;
  let suggestedCursoId: string | null = null;
  let suggestedTurno: Turno = "";
  let suggestedTurmaId: string | null = null;

  if (admin) {
    if (staging?.ano_letivo) {
      const yr = String(staging.ano_letivo);
      const { data: sessionsByEq } = await (admin as any)
        .from('school_sessions')
        .select('id, nome')
        .eq('escola_id', escolaId)
        .eq('nome', yr)
        .limit(1);
      if (sessionsByEq && sessionsByEq[0]) {
        suggestedSessionId = sessionsByEq[0].id as string;
      } else {
        const { data: sessionsByLike } = await (admin as any)
          .from('school_sessions')
          .select('id, nome')
          .eq('escola_id', escolaId)
          .ilike('nome', `%${yr}%`)
          .order('data_inicio', { ascending: false })
          .limit(1);
        if (sessionsByLike && sessionsByLike[0]) {
          suggestedSessionId = sessionsByLike[0].id as string;
        }
      }
    }
    if (!suggestedSessionId) {
      const { data: active } = await (admin as any)
        .from('school_sessions')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('status', 'ativa')
        .limit(1);
      if (active && active[0]) suggestedSessionId = active[0].id as string;
    }
  }

  if (admin && staging?.classe_numero) {
    const { data: cls } = await (admin as any)
      .from('classes')
      .select('id, numero, nome')
      .eq('escola_id', escolaId)
      .eq('numero', Number(staging.classe_numero))
      .limit(1);
    if (cls && cls[0]) suggestedClasseId = cls[0].id as string;
  }

  if (admin && staging?.curso_codigo) {
    const code = String(staging.curso_codigo).toUpperCase();
    const { data: crs } = await (admin as any)
      .from('cursos')
      .select('id, codigo, nome')
      .eq('escola_id', escolaId)
      .eq('codigo', code)
      .limit(1);
    if (crs && crs[0]) suggestedCursoId = crs[0].id as string;
  }

  suggestedTurno = mapTurnoCodigoToLabel(staging?.turno_codigo);

  if (admin && suggestedSessionId) {
    let anoLetivoNome: string | null = null;
    try {
      const { data: sess } = await (admin as any)
        .from('school_sessions')
        .select('id, nome')
        .eq('id', suggestedSessionId)
        .single();
      anoLetivoNome = (sess as any)?.nome ?? null;
    } catch {}
    if (anoLetivoNome) {
      const { data: turmas } = await (admin as any)
        .from('turmas')
        .select('id, nome, turno, ano_letivo')
        .eq('escola_id', escolaId)
        .eq('ano_letivo', anoLetivoNome)
        .order('nome');
      if (turmas && turmas.length) {
        const letra = (staging?.turma_letra || '').toString().trim().toUpperCase();
        const turno = suggestedTurno;
        const byLetter = turmas.filter((t: any) =>
          letra && (t.nome || '').toUpperCase().trim().endsWith(` ${letra}`)
        );
        const byTurno = (turno ? (byLetter.length ? byLetter : turmas).filter((t: any) => (t.turno || '') === turno) : (byLetter.length ? byLetter : turmas));
        if (byTurno[0]) suggestedTurmaId = byTurno[0].id as string;
      }
    }
  }

  return {
    ok: true,
    escolaId: escolaId ?? null,
    defaults: {
      session_id: suggestedSessionId,
      turno: suggestedTurno || null,
      classe_id: suggestedClasseId,
      curso_id: suggestedCursoId,
      turma_id: suggestedTurmaId,
    },
    source: staging ? { staging_id: staging.id } : null,
  };
}

