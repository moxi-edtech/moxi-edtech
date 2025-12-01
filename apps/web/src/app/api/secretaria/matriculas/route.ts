import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const days = Number(searchParams.get("days")) || 30;
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 20;
  const turmaId = (searchParams.get("turma_id") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const statusIn = (searchParams.get("status_in") || "")
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const supabase = await supabaseServerTyped();
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    const user = userRes.user;

    // Determinar escola do usuário (similar ao POST abaixo)
    let escolaId: string | undefined = undefined;
    if (user) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("current_escola_id, escola_id, user_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as
          | string
          | undefined;
      } catch {}
    }

    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Escola não encontrada para o usuário" },
        { status: 400 }
      );
    }

    // Consulta a partir da tabela base com joins, respeitando RLS e escola
    let query = supabase
      .from("matriculas")
      .select(
        `id, numero_matricula, aluno_id, turma_id, status, created_at,
         alunos ( id, profiles!alunos_profile_id_fkey ( nome ) ),
         turmas ( nome )`,
        { count: "exact" }
      )
      .eq("escola_id", escolaId);

    if (turmaId) query = query.eq("turma_id", turmaId);
    if (statusIn.length > 0) {
      query = query.in('status', statusIn);
    } else if (status) {
      query = query.eq('status', status);
    }

    // Filtro por texto: numero_matricula, status, id, nome do aluno, nome da turma
    if (q) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(q);
      // Buscar IDs de alunos pelo nome (via profiles) e IDs de turmas pelo nome
      const [profilesRes, turmasRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id')
          .eq('escola_id', escolaId)
          .ilike('nome', `%${q}%`),
        supabase
          .from('turmas')
          .select('id')
          .eq('escola_id', escolaId)
          .ilike('nome', `%${q}%`),
      ]);

      let alunoIds: string[] = [];
      const profileIds = (profilesRes.data || []).map((p: any) => p.user_id).filter(Boolean);
      if (profileIds.length) {
        const { data: alunosViaPerfil } = await supabase
          .from('alunos')
          .select('id')
          .eq('escola_id', escolaId)
          .in('profile_id', profileIds);
        alunoIds = (alunosViaPerfil || []).map((a: any) => a.id).filter(Boolean);
      }

      const turmaIds: string[] = (turmasRes.data || []).map((t: any) => t.id).filter(Boolean);

      const conditions: string[] = [
        `numero_matricula.ilike.%${q}%`,
        `status.ilike.%${q}%`,
      ];
      if (isUuid) conditions.push(`id.eq.${q}`);
      if (alunoIds.length) conditions.push(`aluno_id.in.(${alunoIds.join(',')})`);
      if (turmaIds.length) conditions.push(`turma_id.in.(${turmaIds.join(',')})`);

      query = query.or(conditions.join(','));
    }

    if (days) {
      const date = new Date();
      date.setDate(date.getDate() - days);
      query = query.gte("created_at", date.toISOString());
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end).order("created_at", { ascending: false });

    const { data, error, count } = await query;
    if (error) {
      console.error("Error fetching matriculas:", error);
      return NextResponse.json(
        { ok: false, error: "Erro ao buscar matrículas." },
        { status: 500 }
      );
    }

    const items = (data || []).map((row: any) => {
      const alunoProfile = row.alunos?.profiles?.[0] ?? row.alunos?.profiles;
      return {
        id: row.id,
        numero_matricula: row.numero_matricula ?? null,
        aluno_id: row.aluno_id,
        turma_id: row.turma_id,
        aluno_nome: alunoProfile?.nome ?? null,
        turma_nome: row.turmas?.nome ?? null,
        status: row.status,
        created_at: row.created_at,
      } as any;
    });

    return NextResponse.json({ ok: true, items, total: count ?? 0 });
  } catch (error: any) {
    console.error("An unexpected error occurred:", error);
    return NextResponse.json(
      { ok: false, error: "Ocorreu um erro inesperado." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { aluno_id, session_id, turma_id, numero_matricula, data_matricula } = body;
    const body_classe_id: string | undefined = body?.classe_id || undefined;
    const body_curso_id: string | undefined = body?.curso_id || undefined;
    const gerar_todas: boolean = body?.gerar_mensalidades_todas ?? true;

    // Resolve escola a partir do aluno, com fallback ao perfil do usuário
    let escolaId: string | undefined = undefined;

    if (aluno_id) {
      try {
        const { data: aluno } = await supabase
          .from("alunos")
          .select("escola_id")
          .eq("id", aluno_id)
          .maybeSingle();
        escolaId = (aluno as any)?.escola_id as string | undefined;
      } catch {}
    }

    if (!escolaId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("current_escola_id, escola_id, user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      escolaId = ((prof?.[0] as any)?.current_escola_id ||
        (prof?.[0] as any)?.escola_id) as string | undefined;

      if (!escolaId) {
        try {
          const { data: vinc } = await supabase
            .from("escola_usuarios")
            .select("escola_id")
            .eq("user_id", user.id)
            .limit(1);
          escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
        } catch {}
      }
    }

    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Escola não encontrada" },
        { status: 400 }
      );
    }

    if (!aluno_id || !session_id || !turma_id) {
      return NextResponse.json(
        { ok: false, error: "Campos obrigatórios em falta" },
        { status: 400 }
      );
    }

    // Validar turma pertence à escola e sessão compatível
    let anoLetivoTurma: number | undefined;
    try {
      const { data: turma } = await supabase
        .from('turmas')
        .select('id, escola_id, session_id, ano_letivo')
        .eq('id', turma_id)
        .maybeSingle();
      if (!turma) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 400 });
      if ((turma as any).escola_id && String((turma as any).escola_id) !== String(escolaId)) {
        return NextResponse.json({ ok: false, error: 'Turma não pertence à escola selecionada' }, { status: 403 });
      }
      if ((turma as any).session_id && String((turma as any).session_id) !== String(session_id)) {
        return NextResponse.json({ ok: false, error: 'Ano letivo selecionado não corresponde à turma' }, { status: 400 });
      }
      anoLetivoTurma = (turma as any).ano_letivo ? Number((turma as any).ano_letivo) : undefined;
    } catch {}

    // ------------------------------------------------------------------
    // 0) VALIDA DUPLICIDADE: aluno já matriculado nesta sessão?
    // ------------------------------------------------------------------
    try {
      const { count: dupCount, error: dupErr } = await supabase
        .from('matriculas')
        .select('id', { count: 'exact', head: true })
        .eq('escola_id', escolaId)
        .eq('aluno_id', aluno_id)
        .eq('session_id', session_id)
        .in('status', ['ativo','ativa','active']);
      if (!dupErr && (dupCount ?? 0) > 0) {
        return NextResponse.json(
          { ok: false, error: 'Aluno já possui matrícula ativa neste ano letivo.' },
          { status: 409 }
        );
      }
    } catch {}

    // ------------------------------------------------------------------
    // 0.1) RESOLVER TABELA DE PREÇOS (cascata em financeiro_tabelas)
    // ------------------------------------------------------------------

    let cursoResolvedId: string | undefined = body_curso_id;
    let classeResolvedId: string | undefined = body_classe_id;

    try {
      if (!cursoResolvedId || !classeResolvedId) {
        const { data: oferta } = await supabase
          .from('cursos_oferta')
          .select('curso_id, classe_id')
          .eq('turma_id', turma_id)
          .limit(1);
        if (!cursoResolvedId) {
          cursoResolvedId = (oferta?.[0] as any)?.curso_id as string | undefined;
        }
        if (!classeResolvedId) {
          classeResolvedId = (oferta?.[0] as any)?.classe_id as string | undefined;
        }
      }
    } catch {}

    const anoLetivo = anoLetivoTurma ?? new Date().getFullYear();

    const { tabela: tabelaPreco } = await resolveTabelaPreco(supabase as any, {
      escolaId,
      anoLetivo,
      cursoId: cursoResolvedId,
      classeId: classeResolvedId,
    });

    if (!tabelaPreco) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Bloqueio Financeiro: Este curso não tem preço definido.',
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // 1) GARANTIR NUMERO_LOGIN DO ALUNO NA MATRÍCULA
    // ------------------------------------------------------------------

    let numeroLoginAluno: string | null = null;

    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!adminUrl || !serviceRole) {
      console.warn(
        "[matriculas.create] Service role não configurado, não será possível garantir numero_login na matrícula."
      );
    } else {
      const admin = createAdminClient<Database>(adminUrl, serviceRole);

      // Busca aluno + profile para ver se já tem numero_login
      const { data: alunoFull, error: alunoErr } = await admin
        .from("alunos")
        .select(
          "id, escola_id, profile_id, profiles!alunos_profile_id_fkey ( user_id, email, numero_login )"
        )
        .eq("id", aluno_id)
        .maybeSingle();

      if (alunoErr) {
        return NextResponse.json(
          { ok: false, error: alunoErr.message },
          { status: 400 }
        );
      }

      if (!alunoFull) {
        return NextResponse.json(
          { ok: false, error: "Aluno não encontrado" },
          { status: 404 }
        );
      }

      // Segurança extra: garantir que aluno pertence à mesma escola
      if (
        (alunoFull as any).escola_id &&
        String((alunoFull as any).escola_id) !== String(escolaId)
      ) {
        return NextResponse.json(
          { ok: false, error: "Aluno não pertence à escola ativa" },
          { status: 403 }
        );
      }

      const profJoin = (alunoFull as any).profiles;
      const profileUserId = Array.isArray(profJoin)
        ? profJoin[0]?.user_id
        : profJoin?.user_id;
      const existingNumeroLogin = Array.isArray(profJoin)
        ? profJoin[0]?.numero_login
        : profJoin?.numero_login;
      const alunoEmail = Array.isArray(profJoin)
        ? profJoin[0]?.email
        : profJoin?.email;

      if (!profileUserId) {
        console.warn(
          "[matriculas.create] Aluno sem profile_id vinculado, não será possível gerar numero_login."
        );
      } else {
        if (existingNumeroLogin) {
          // Já tem numero_login – só reaproveita
          numeroLoginAluno = existingNumeroLogin;
        } else {
          // Gera numero_login agora (primeira matrícula do aluno)
          try {
            const novoNumero = await generateNumeroLogin(
              escolaId,
              "aluno" as any,
              admin as any
            );

            // Atualiza profile
            await admin
              .from("profiles")
              .update({ numero_login: novoNumero })
              .eq("user_id", profileUserId);

            // Reflete em auth (best-effort)
            try {
              await (admin as any).auth.admin.updateUserById(profileUserId, {
                app_metadata: {
                  role: "aluno",
                  escola_id: escolaId,
                  numero_usuario: novoNumero,
                },
                user_metadata: { must_change_password: true },
              });
            } catch (e) {
              console.warn(
                "[matriculas.create] Falha ao atualizar app_metadata do aluno:",
                e
              );
            }

            numeroLoginAluno = novoNumero;

            // Se no futuro quiser disparar e-mail de credenciais,
            // aqui você já tem alunoEmail + numeroLoginAluno.
          } catch (e) {
            console.warn(
              "[matriculas.create] Falha ao gerar numero_login do aluno na matrícula:",
              e
            );
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 2) CRIAR MATRÍCULA (USANDO NUMERO_LOGIN COMO BASE, SE QUISER)
    // ------------------------------------------------------------------

    const numeroMatriculaFinal: string | null =
      numero_matricula || numeroLoginAluno || null;

    const { data: newMatricula, error } = await supabase
      .from("matriculas")
      .insert({
        aluno_id,
        session_id,
        turma_id,
        numero_matricula: numeroMatriculaFinal,
        data_matricula: data_matricula || null,
        escola_id: escolaId,
        status: "ativo",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // 3) FINANCEIRO – gera mensalidades usando tabela de preços oficial
    // ------------------------------------------------------------------

    let efetivoValor: number | undefined =
      typeof tabelaPreco.valor_mensalidade === "number"
        ? Number(tabelaPreco.valor_mensalidade)
        : undefined;
    let efetivoDia: number | undefined =
      tabelaPreco.dia_vencimento != null ? Number(tabelaPreco.dia_vencimento) : undefined;

    if (
      efetivoValor &&
      efetivoDia &&
      Number.isFinite(efetivoValor) &&
      Number.isFinite(efetivoDia)
    ) {
      try {
        const { data: sess } = await supabase
          .from("school_sessions")
          .select("data_inicio, data_fim, nome")
          .eq("id", session_id)
          .maybeSingle();

        const dataInicioSess = (sess as any)?.data_inicio
          ? new Date((sess as any).data_inicio)
          : new Date();
        const dataFimSess = (sess as any)?.data_fim
          ? new Date((sess as any).data_fim)
          : new Date(dataInicioSess.getFullYear(), 11, 31);
        const dataMat = data_matricula
          ? new Date(data_matricula)
          : new Date();

        let anoLetivoMensal = String(anoLetivoTurma ?? dataInicioSess.getFullYear());
        const nomeSess = String(((sess as any)?.nome ?? "")).trim();
        const anoNome = (nomeSess.match(/\b(20\d{2}|19\d{2})\b/) || [])[0];
        if (anoNome) anoLetivoMensal = anoNome;

        const dia = Math.min(Math.max(1, Math.trunc(efetivoDia as number)), 31);

        const startYear = Math.max(
          dataInicioSess.getFullYear(),
          dataMat.getFullYear()
        );
        const startMonthIndex = (() => {
          const s =
            new Date(
              dataInicioSess.getFullYear(),
              dataInicioSess.getMonth(),
              1
            ) <
            new Date(dataMat.getFullYear(), dataMat.getMonth(), 1)
              ? dataMat.getMonth()
              : dataInicioSess.getMonth();
          return s;
        })();

        const cursor = new Date(startYear, startMonthIndex, 1);
        const limite = gerar_todas
          ? new Date(dataFimSess.getFullYear(), dataFimSess.getMonth(), 1)
          : new Date(dataMat.getFullYear(), dataMat.getMonth(), 1);

        const rows: any[] = [];
        let firstRow = true;

        while (cursor <= limite) {
          const ano = cursor.getFullYear();
          const mesIndex = cursor.getMonth();
          const mes = mesIndex + 1;
          const lastDay = new Date(ano, mesIndex + 1, 0).getDate();
          const dd = Math.min(dia, lastDay);
          const venc = new Date(ano, mesIndex, dd);

          let valor = Number(Number(efetivoValor as number).toFixed(2));
          if (
            firstRow &&
            ano === dataMat.getFullYear() &&
            mesIndex === dataMat.getMonth() &&
            dataMat.getDate() > dia
          ) {
            const daysInMonth = new Date(ano, mesIndex + 1, 0).getDate();
            const remainingDays = Math.max(
              0,
              daysInMonth - dataMat.getDate() + 1
            );
            const prorata = (valor * remainingDays) / daysInMonth;
            valor = Math.max(0, Math.round(prorata * 100) / 100);
          }

          rows.push({
            escola_id: escolaId,
            aluno_id,
            turma_id,
            ano_letivo: anoLetivoMensal,
            mes_referencia: mes,
            ano_referencia: ano,
            valor_previsto: valor,
            data_vencimento: venc.toISOString().slice(0, 10),
            status: "pendente",
          });

          firstRow = false;
          cursor.setMonth(cursor.getMonth() + 1);
        }

        if (rows.length > 0) {
          const client: any =
            adminUrl && serviceRole
              ? createAdminClient<Database>(adminUrl, serviceRole)
              : supabase;

          await client.from("mensalidades").insert(rows as any);
        }
      } catch (mErr) {
        console.warn(
          "[matriculas.create] Falha ao gerar mensalidades:",
          mErr instanceof Error ? mErr.message : mErr
        );
      }
    }

    return NextResponse.json({ ok: true, data: newMatricula });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
