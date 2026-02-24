import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

type ProfileResumo = { email: string | null; numero_login: string | null };
type AlunoRow = {
  id: string;
  nome: string | null;
  numero_processo: string | null;
  status: string | null;
  created_at: string | null;
  profile_id: string | null;
  escola_id: string;
  profiles?: ProfileResumo | ProfileResumo[] | null;
};

type MatriculaResumo = {
  id: string;
  aluno_id: string;
  status: string | null;
  turma_id: string | null;
  created_at: string | null;
  turmas?:
    | {
        nome?: string | null;
        turma_codigo?: string | null;
        ano_letivo?: number | null;
        cursos?: { nome?: string | null } | { nome?: string | null }[] | null;
      }
    | {
        nome?: string | null;
        turma_codigo?: string | null;
        ano_letivo?: number | null;
        cursos?: { nome?: string | null } | { nome?: string | null }[] | null;
      }[]
    | null;
};

type MensalidadeResumo = {
  aluno_id: string;
  status: string | null;
  data_vencimento: string | null;
  valor_previsto: number | null;
  valor: number | null;
  valor_pago_total: number | null;
};

type CandidaturaRow = {
  id: string;
  aluno_id: string | null;
  status: string | null;
  created_at: string | null;
  nome_candidato: string | null;
  dados_candidato: { [key: string]: unknown } | null;
  alunos?: {
    id?: string | null;
    nome?: string | null;
    nome_completo?: string | null;
    numero_processo?: string | null;
    bi_numero?: string | null;
    email?: string | null;
  } | Array<{
    id?: string | null;
    nome?: string | null;
    nome_completo?: string | null;
    numero_processo?: string | null;
    bi_numero?: string | null;
    email?: string | null;
  }> | null;
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;
  try {
    const s = await supabaseServerTyped<Database>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const resolvedEscolaId = await resolveEscolaIdForUser(s, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "active").toLowerCase();
    const q = (url.searchParams.get("q") || "").trim();
    const limitParam = Number(url.searchParams.get("limit") || 30);
    const limit = Number.isFinite(limitParam) ? Math.min(limitParam, 50) : 30;
    const cursor = url.searchParams.get("cursor");

    let query = s
      .from("alunos")
      .select(
        "id, nome, numero_processo, status, created_at, profile_id, escola_id, profiles!alunos_profile_id_fkey ( email, numero_login )"
      )
      .eq("escola_id", escolaId);

    if (status === "archived") {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/;
      if (uuidRe.test(q)) {
        query = query.or(`id.eq.${q}`);
      } else {
        const normalized = q.toLowerCase();
        const orParts = [
          `nome_busca.like.${normalized}%`,
          `responsavel.ilike.${normalized}%`,
          `profiles.numero_login.ilike.${normalized}%`,
        ];
        query = query.or(orParts.join(","));
      }
    }

    if (cursor) {
      const [cursorCreatedAt, cursorId] = cursor.split(",");
      if (cursorCreatedAt && cursorId) {
        query = query.or(
          `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
        );
      }
    }

    query = applyKf2ListInvariants(query, {
      limit,
      order: [
        { column: "created_at", ascending: false },
        { column: "id", ascending: false },
      ],
    });

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const alunoItems = (data ?? []).map((row: AlunoRow) => {
      const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        nome: row.nome,
        email: prof?.email ?? null,
        numero_login: prof?.numero_login ?? null,
        numero_processo: row.numero_processo ?? null,
        created_at: row.created_at,
        status: row.status ?? null,
        origem: 'aluno',
      };
    });

    const alunoIds = alunoItems.map((item) => item.id);
    const matriculaMap = new Map<
      string,
      {
        status: string | null;
        turma_id: string | null;
        turma_nome: string | null;
        turma_codigo: string | null;
        turma_ano: number | null;
        turma_curso: string | null;
      }
    >();

    if (alunoIds.length > 0) {
      const { data: matriculas } = await s
        .from("matriculas")
        .select(
          "id, aluno_id, status, turma_id, created_at, turmas ( nome, turma_codigo, ano_letivo, cursos ( nome ) )"
        )
        .eq("escola_id", escolaId)
        .in("aluno_id", alunoIds)
        .order("created_at", { ascending: false });

      (matriculas as MatriculaResumo[] | null)?.forEach((row) => {
        if (!row?.aluno_id || matriculaMap.has(row.aluno_id)) return;
        const turma = Array.isArray(row.turmas) ? row.turmas[0] : row.turmas;
        const curso = Array.isArray(turma?.cursos) ? turma?.cursos[0] : turma?.cursos;
        matriculaMap.set(row.aluno_id, {
          status: row.status ?? null,
          turma_id: row.turma_id ?? null,
          turma_nome: turma?.nome ?? null,
          turma_codigo: turma?.turma_codigo ?? null,
          turma_ano: turma?.ano_letivo ?? null,
          turma_curso: curso?.nome ?? null,
        });
      });
    }

    const mensalidadeMap = new Map<
      string,
      { situacao: "em_dia" | "em_atraso" | "sem_registo"; meses: number; valor: number }
    >();
    if (alunoIds.length > 0) {
      const { data: mensalidades } = await s
        .from("mensalidades")
        .select("aluno_id, status, data_vencimento, valor_previsto, valor, valor_pago_total")
        .eq("escola_id", escolaId)
        .in("aluno_id", alunoIds);

      const today = new Date();
      (mensalidades as MensalidadeResumo[] | null)?.forEach((row) => {
        if (!row?.aluno_id) return;
        const entry = mensalidadeMap.get(row.aluno_id) ?? {
          situacao: "sem_registo" as const,
          meses: 0,
          valor: 0,
        };

        const dueDate = row.data_vencimento ? new Date(row.data_vencimento) : null;
        const status = (row.status ?? "").toLowerCase();
        const isPago = status === "pago" || status === "isento" || status === "cancelado";
        const isOverdue = !isPago && !!dueDate && dueDate < today;

        entry.situacao = entry.situacao === "sem_registo" ? "em_dia" : entry.situacao;
        if (isOverdue) {
          entry.situacao = "em_atraso";
          entry.meses += 1;
          const valorPrevisto = Number(row.valor_previsto ?? row.valor ?? 0);
          const valorPago = Number(row.valor_pago_total ?? 0);
          entry.valor += Math.max(valorPrevisto - valorPago, 0);
        }

        mensalidadeMap.set(row.aluno_id, entry);
      });
    }

    let candidaturaItems: Array<{ id: string; nome: string; email: string | null; numero_login: null; created_at: string | null; status: string | null; origem: 'candidatura'; aluno_id: string | null; }> = [];
    if (status !== "archived") {
      let candQuery = s
        .from("candidaturas")
        .select(
          `id, aluno_id, status, created_at, nome_candidato, dados_candidato,
          alunos:aluno_id ( id, nome, nome_completo, numero_processo, bi_numero, email )`
        )
        .eq("escola_id", escolaId)
        .not("status", "in", "(matriculado,rejeitada,cancelada)")
        .order("created_at", { ascending: false });

      candQuery = applyKf2ListInvariants(candQuery, { defaultLimit: 50 });

      if (q) {
        const uuidRe = /^[0-9a-fA-F-]{36}$/;
        if (uuidRe.test(q)) {
          candQuery = candQuery.or(`id.eq.${q}`);
        } else {
          const orParts = [
            `nome_candidato.ilike.%${q}%`,
            `alunos.nome.ilike.%${q}%`,
            `alunos.nome_completo.ilike.%${q}%`,
            `alunos.numero_processo.ilike.%${q}%`,
          ];
          candQuery = candQuery.or(orParts.join(","));
        }
      }

      const { data: candData, error: candError } = await candQuery;
      if (candError) {
        return NextResponse.json({ ok: false, error: candError.message }, { status: 400 });
      }

      candidaturaItems = (candData ?? []).map((row) => {
        const alunoRaw = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
        const payload = (row.dados_candidato || {}) as Record<string, unknown>;
        const nome =
          alunoRaw?.nome_completo ||
          alunoRaw?.nome ||
          (payload.nome_completo as string | undefined) ||
          (payload.nome as string | undefined) ||
          row.nome_candidato ||
          "";
        const email = alunoRaw?.email || (payload.email as string | undefined) || (payload.encarregado_email as string | undefined) || null;
        return {
          id: row.id,
          nome,
          email,
          numero_login: null,
          numero_processo: alunoRaw?.numero_processo ?? (payload.numero_processo as string | undefined) ?? null,
          created_at: row.created_at,
          status: row.status ?? null,
          origem: 'candidatura',
          aluno_id: row.aluno_id ?? null,
        };
      });
    }

    const items = [...candidaturaItems, ...alunoItems].map((item) => {
      if (item.origem !== "aluno") {
        return {
          ...item,
          turma_nome: null,
          turma_id: null,
          turma_codigo: null,
          turma_ano: null,
          turma_curso: null,
          situacao_financeira: "sem_registo" as const,
          meses_atraso: 0,
          valor_em_divida: 0,
          status_matricula: "sem_matricula" as const,
        };
      }

      const matricula = matriculaMap.get(item.id);
      const statusRaw = (matricula?.status ?? "").toLowerCase();
      const statusMatricula = ["ativa", "ativo", "active", "matriculado"].includes(statusRaw)
        ? "matriculado"
        : ["pendente", "rascunho"].includes(statusRaw)
          ? "pendente"
          : "sem_matricula";

      const financeiro = mensalidadeMap.get(item.id) ?? {
        situacao: "sem_registo" as const,
        meses: 0,
        valor: 0,
      };

      return {
        ...item,
        turma_nome: matricula?.turma_nome ?? null,
        turma_id: matricula?.turma_id ?? null,
        turma_codigo: matricula?.turma_codigo ?? null,
        turma_ano: matricula?.turma_ano ?? null,
        turma_curso: matricula?.turma_curso ?? null,
        situacao_financeira: financeiro.situacao,
        meses_atraso: financeiro.meses,
        valor_em_divida: financeiro.valor,
        status_matricula: statusMatricula,
      };
    });
    const last = alunoItems[alunoItems.length - 1];
    const nextCursor =
      alunoItems.length === limit && last
        ? `${last.created_at},${last.id}`
        : null;

    return NextResponse.json({ ok: true, items, next_cursor: nextCursor });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
