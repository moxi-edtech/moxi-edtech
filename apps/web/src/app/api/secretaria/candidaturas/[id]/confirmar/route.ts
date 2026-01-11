import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

const BodySchema = z.object({
  turma_id: z.string().uuid(),
});

const ALUNO_SELECT_FIELDS =
  "id, nome, nome_completo, email, telefone_responsavel, encarregado_email, profile_id, responsavel_nome, responsavel_contato, escola_id";

const findAlunoExistente = async (
  client: SupabaseClient<Database>,
  escolaId: string,
  payload: { bi_numero?: string | null; nif?: string | null; numero_processo?: string | null },
  extraNumeroProcesso?: string | null
) => {
  const matchFilters: string[] = [];
  if (payload.bi_numero) matchFilters.push(`bi_numero.eq.${payload.bi_numero}`);
  if (payload.nif) matchFilters.push(`nif.eq.${payload.nif}`);
  if (payload.numero_processo) matchFilters.push(`numero_processo.eq.${payload.numero_processo}`);
  if (extraNumeroProcesso) matchFilters.push(`numero_processo.eq.${extraNumeroProcesso}`);

  if (matchFilters.length === 0) return null;

  const matchExpr = matchFilters.join(",");

  const { data: sameSchool } = await client
    .from("alunos")
    .select(ALUNO_SELECT_FIELDS)
    .eq("escola_id", escolaId)
    .or(matchExpr)
    .limit(1)
    .maybeSingle();

  if (sameSchool) return sameSchool as any;

  return null;
};

const extractNumeroProcessoFromError = (message?: string | null) => {
  if (!message) return null;
  const match = message.match(/numero_processo\)=\([^,]+,\s*([^\)]+)\)/i) || message.match(/numero_processo\)=\(([^\)]+)\)/i);
  return match?.[1]?.trim() || null;
};

const extractSequencial = (numero?: string | null) => {
  if (!numero) return null;
  const match = `${numero}`.match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : null;
};

const syncAlunoProcessoCounter = async (client: SupabaseClient<Database>, escolaId: string) => {
  const { data, error } = await client
    .from("alunos")
    .select("numero_processo")
    .eq("escola_id", escolaId)
    .order("numero_processo", { ascending: false })
    .limit(20);

  if (error || !data?.length) return null;

  const maxSeq = data.reduce((max, row) => {
    const seq = extractSequencial((row as any).numero_processo);
    return seq !== null && seq > max ? seq : max;
  }, 0);

  if (maxSeq === 0) return null;

  await client
    .from("aluno_processo_counters")
    .upsert({ escola_id: escolaId, last_value: maxSeq, updated_at: new Date().toISOString() });

  return maxSeq;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { turma_id } = parsed.data;
    const supabase = await supabaseServerTyped();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    // 1) Buscar candidatura + aluno (RLS filtra pela escola do usuário)
    const { data: candidatura, error: candErr } = await supabase
      .from("candidaturas")
      .select(
        `id, escola_id, aluno_id, curso_id, ano_letivo, status, dados_candidato, nome_candidato,
         alunos:aluno_id (id, nome, nome_completo, email, telefone_responsavel, encarregado_email, profile_id, responsavel_nome, responsavel_contato)`
      )
      .eq("id", id)
      .maybeSingle();

    if (candErr) {
      return NextResponse.json({ ok: false, error: candErr.message }, { status: 400 });
    }
    if (!candidatura) {
      return NextResponse.json({ ok: false, error: "Candidatura não encontrada" }, { status: 404 });
    }
    if ((candidatura as any).status === "matriculado") {
      return NextResponse.json(
        { ok: false, error: "Candidatura já convertida" },
        { status: 409 }
      );
    }

    // 2) Validar turma
    const { data: turma, error: turmaErr } = await supabase
      .from("turmas")
      .select("id, escola_id")
      .eq("id", turma_id)
      .maybeSingle();

    if (turmaErr) {
      return NextResponse.json({ ok: false, error: turmaErr.message }, { status: 400 });
    }
    if (!turma || turma.escola_id !== (candidatura as any).escola_id) {
      return NextResponse.json(
        { ok: false, error: "Turma não pertence à escola" },
        { status: 400 }
      );
    }

    const escolaId = (candidatura as any).escola_id as string;

    // 2.5) Criar aluno real se ainda não existir (fluxo antigo gerava aluno antes)
    let alunoPerfil = (candidatura as any).alunos || {};
    let alunoId = (candidatura as any).aluno_id as string | null;

    if (!alunoId) {
      const payload = ((candidatura as any).dados_candidato as any) || {};
      const nomeCompleto =
        alunoPerfil.nome_completo ||
        alunoPerfil.nome ||
        payload.nome_completo ||
        payload.nome ||
        (candidatura as any).nome_candidato ||
        "Candidato";

      const basePayload = {
        escola_id: escolaId,
        nome: nomeCompleto,
        nome_completo: nomeCompleto,
        email: payload.email ?? null,
        telefone_responsavel: payload.telefone ?? null,
        responsavel_nome: payload.responsavel_nome ?? null,
        responsavel_contato: payload.responsavel_contato ?? null,
        encarregado_email: payload.encarregado_email ?? null,
        bi_numero: payload.bi_numero ?? null,
        nif: payload.nif ?? payload.bi_numero ?? null,
        numero_processo: payload.numero_processo ?? null,
        data_nascimento: payload.data_nascimento ?? null,
        sexo: payload.sexo ?? null,
        status: "pendente",
      };

      const alunoExistente = await findAlunoExistente(supabase, escolaId, basePayload);

      if (alunoExistente) {
        alunoId = alunoExistente.id as string;
        alunoPerfil = alunoExistente;
      } else {
        const { data, error } = await supabase
          .from("alunos")
          .insert(basePayload)
          .select(ALUNO_SELECT_FIELDS)
          .single();

        if (error) {
          const numeroConflito = extractNumeroProcessoFromError(error.details || error.message);
          if (
            error.message?.includes("idx_alunos_escola_processo") ||
            error.message?.includes("alunos_bi_key")
          ) {
            const existente = await findAlunoExistente(
              admin,
              escolaId,
              basePayload,
              numeroConflito
            );
            if (existente) {
              alunoId = (existente as any).id as string;
              alunoPerfil = existente;
            } else if (error.message?.includes("idx_alunos_escola_processo")) {
              // Se a numeração de processo estiver desatualizada, sincroniza o contador e tenta novamente
              await syncAlunoProcessoCounter(supabase, escolaId);

              const retryPayload = { ...basePayload, numero_processo: null };

              const { data: retryData, error: retryErr } = await supabase
                .from("alunos")
                .insert(retryPayload)
                .select(ALUNO_SELECT_FIELDS)
                .single();

              if (retryErr) {
                const retryNumero = extractNumeroProcessoFromError(retryErr.details || retryErr.message);
                if (retryNumero) {
                    const retryExisting = await findAlunoExistente(
                    supabase,
                    escolaId,
                    retryPayload,
                    retryNumero
                  );
                  if (retryExisting) {
                    alunoId = (retryExisting as any).id as string;
                    alunoPerfil = retryExisting;
                  } else {
                    return NextResponse.json({ ok: false, error: retryErr.message }, { status: 400 });
                  }
                } else {
                  return NextResponse.json({ ok: false, error: retryErr.message }, { status: 400 });
                }
              }

              if (retryData) {
                alunoId = retryData?.id || null;
                alunoPerfil = retryData || {};
              }
            } else {
              return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
            }
          } else {
            return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
          }
        } else {
          alunoId = data?.id || null;
          alunoPerfil = data || {};
        }
      }

      if (alunoId) {
        await supabase
          .from("candidaturas")
          .update({ aluno_id: alunoId, nome_candidato: nomeCompleto })
          .eq("id", id);
      }
    }

    if (!alunoId) {
      return NextResponse.json(
        { ok: false, error: "Falha ao criar/obter aluno" },
        { status: 400 }
      );
    }

    // 2.6) Garantir que não há matrícula prévia no mesmo ano (inclusive pendentes)
    const { data: existingMatricula, error: existingErr } = await supabase
      .from("matriculas")
      .select("id, numero_matricula")
      .eq("escola_id", escolaId)
      .eq("aluno_id", alunoId)
      .eq("ano_letivo", (candidatura as any).ano_letivo)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ ok: false, error: existingErr.message }, { status: 400 });
    }
    if (existingMatricula) {
      return NextResponse.json(
        { ok: false, error: "Aluno já possui matrícula neste ano letivo" },
        { status: 409 }
      );
    }

    // 3) Criar matrícula oficial (ativa e numerada)
    const { data: matricula, error: matErr } = await supabase
      .from("matriculas")
      .insert({
        escola_id: (candidatura as any).escola_id,
        aluno_id: alunoId,
        turma_id,
        ano_letivo: (candidatura as any).ano_letivo,
        status: "pendente",
        ativo: true,
        data_matricula: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (matErr || !matricula) {
      return NextResponse.json({ ok: false, error: matErr?.message || "Erro ao criar matrícula" }, { status: 400 });
    }

    const { error: confirmErr } = await (supabase as any).rpc('confirmar_matricula', {
      p_matricula_id: matricula.id,
    });

    if (confirmErr) {
      await supabase.from("matriculas").delete().eq("id", matricula.id);
      return NextResponse.json({ ok: false, error: confirmErr?.message || "Falha ao confirmar matrícula" }, { status: 400 });
    }

    const { data: matriculaAtualizada, error: fetchErr } = await supabase
      .from('matriculas')
      .select('id, numero_matricula, status')
      .eq('id', matricula.id)
      .maybeSingle();

    if (fetchErr || !matriculaAtualizada?.numero_matricula) {
      await supabase.from('matriculas').delete().eq('id', matricula.id);
      return NextResponse.json({ ok: false, error: fetchErr?.message || 'Número de matrícula não gerado' }, { status: 400 });
    }

    const numeroMatricula = matriculaAtualizada.numero_matricula as string;

    const emailForLogin = alunoPerfil.email || alunoPerfil.encarregado_email || ((candidatura as any).dados_candidato as any)?.encarregado_email;

    if (!emailForLogin) {
      return NextResponse.json(
        { ok: false, error: "Aluno sem email para criar login" },
        { status: 400 }
      );
    }

    const numeroLogin = numeroMatricula ? String(numeroMatricula) : null;

    await (supabase as any).rpc("enqueue_outbox_event", {
      p_escola_id: escolaId,
      p_topic: "auth_provision_student",
      p_request_id: matricula.id,
      p_idempotency_key: `AUTH_PROVISION_USER:${escolaId}:${alunoId}`,
      p_payload: {
        aluno_id: alunoId,
        email: emailForLogin,
        numero_login: numeroLogin,
        canal: "whatsapp",
        actor_user_id: user.id,
      },
    });

    // 5) Atualizar status da candidatura
    await supabase
      .from("candidaturas")
      .update({ status: "matriculado" })
      .eq("id", id);

    return NextResponse.json(
      {
        ok: true,
        matricula_id: matricula?.id,
        numero_matricula: numeroLogin,
        profile_id: alunoPerfil.profile_id ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
