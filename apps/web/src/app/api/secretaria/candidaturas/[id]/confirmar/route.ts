import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

const BodySchema = z.object({
  turma_id: z.string().uuid(),
});

const ALUNO_SELECT_FIELDS =
  "id, nome, nome_completo, email, telefone_responsavel, encarregado_email, profile_id, responsavel_nome, responsavel_contato, escola_id";

const findAlunoExistente = async (
  admin: SupabaseClient<Database>,
  escolaId: string,
  payload: { bi_numero?: string | null; nif?: string | null }
) => {
  const matchFilters: string[] = [];
  if (payload.bi_numero) matchFilters.push(`bi_numero.eq.${payload.bi_numero}`);
  if (payload.nif) matchFilters.push(`nif.eq.${payload.nif}`);

  if (matchFilters.length === 0) return null;

  const matchExpr = matchFilters.join(",");

  const { data: sameSchool } = await admin
    .from("alunos")
    .select(ALUNO_SELECT_FIELDS)
    .eq("escola_id", escolaId)
    .or(matchExpr)
    .limit(1)
    .maybeSingle();

  if (sameSchool) return sameSchool as any;

  return null;
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

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente" }, { status: 500 });
    }

    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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
        data_nascimento: payload.data_nascimento ?? null,
        sexo: payload.sexo ?? null,
        status: "pendente",
      };

      const alunoExistente = await findAlunoExistente(admin, escolaId, basePayload);

      if (alunoExistente) {
        alunoId = alunoExistente.id as string;
        alunoPerfil = alunoExistente;
      } else {
        const { data, error } = await admin
          .from("alunos")
          .insert(basePayload)
          .select(ALUNO_SELECT_FIELDS)
          .single();

        if (error) {
          if (
            error.message?.includes("idx_alunos_escola_processo") ||
            error.message?.includes("alunos_bi_key")
          ) {
            const existente = await findAlunoExistente(admin, escolaId, basePayload);
            if (existente) {
              alunoId = (existente as any).id as string;
              alunoPerfil = existente;
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
        await admin
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
    const { data: existingMatricula, error: existingErr } = await admin
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
    const { data: matricula, error: matErr } = await admin
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

    const { error: confirmErr } = await (admin as any).rpc('confirmar_matricula', {
      p_matricula_id: matricula.id,
    });

    if (confirmErr) {
      await admin.from("matriculas").delete().eq("id", matricula.id);
      return NextResponse.json({ ok: false, error: confirmErr?.message || "Falha ao confirmar matrícula" }, { status: 400 });
    }

    const { data: matriculaAtualizada, error: fetchErr } = await admin
      .from('matriculas')
      .select('id, numero_matricula, status')
      .eq('id', matricula.id)
      .maybeSingle();

    if (fetchErr || !matriculaAtualizada?.numero_matricula) {
      await admin.from('matriculas').delete().eq('id', matricula.id);
      return NextResponse.json({ ok: false, error: fetchErr?.message || 'Número de matrícula não gerado' }, { status: 400 });
    }

    const numeroMatricula = matriculaAtualizada.numero_matricula as string;

    // 4) Garantir login/profile
    let targetUserId: string | null = alunoPerfil.profile_id || null;
    const emailForLogin = alunoPerfil.email || alunoPerfil.encarregado_email || ((candidatura as any).dados_candidato as any)?.encarregado_email;

    if (!targetUserId) {
      if (!emailForLogin) {
        return NextResponse.json(
          { ok: false, error: "Aluno sem email para criar login" },
          { status: 400 }
        );
      }

      const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
      const { data: createdUser, error: authErr } = await admin.auth.admin.createUser({
        email: emailForLogin,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nome: alunoPerfil.nome_completo || alunoPerfil.nome, role: "aluno" },
        app_metadata: { role: "aluno", escola_id: (candidatura as any).escola_id },
      });

      if (authErr) {
        // Tentar reaproveitar usuário existente
        if (authErr.message?.includes("registered") || authErr.status === 422) {
          const { data: list } = await admin.auth.admin.listUsers();
          const existing = list.users.find(
            (u) => u.email?.toLowerCase() === emailForLogin.toLowerCase()
          );
          if (!existing) {
            return NextResponse.json({ ok: false, error: authErr.message }, { status: 400 });
          }
          targetUserId = existing.id;
        } else {
          return NextResponse.json({ ok: false, error: authErr.message }, { status: 400 });
        }
      } else {
        targetUserId = createdUser?.user?.id || null;
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: "Falha ao definir usuário" }, { status: 500 });
    }

    const numeroLogin = numeroMatricula ? String(numeroMatricula) : null;

    const profileData: any = {
      user_id: targetUserId,
      email: emailForLogin,
      nome: alunoPerfil.nome_completo || alunoPerfil.nome,
      role: "aluno",
      escola_id: (candidatura as any).escola_id,
      current_escola_id: (candidatura as any).escola_id,
      numero_login: numeroLogin,
      telefone: alunoPerfil.telefone_responsavel || null,
      encarregado_relacao: alunoPerfil.responsavel_nome ? "encarregado" : null,
    };

    const { error: profErr } = await admin
      .from("profiles")
      .upsert(profileData, { onConflict: "user_id" });
    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });
    }

    const { error: linkErr } = await admin
      .from("escola_users")
      .upsert(
        { escola_id: (candidatura as any).escola_id, user_id: targetUserId, papel: "aluno" },
        { onConflict: "escola_id,user_id" }
      );
    if (linkErr) {
      return NextResponse.json({ ok: false, error: linkErr.message }, { status: 400 });
    }

    await admin
      .from("alunos")
      .update({ profile_id: targetUserId })
      .eq("id", alunoId);

    // 5) Atualizar status da candidatura
    await admin
      .from("candidaturas")
      .update({ status: "matriculado" })
      .eq("id", id);

    return NextResponse.json(
      {
        ok: true,
        matricula_id: matricula?.id,
        numero_matricula: numeroLogin,
        profile_id: targetUserId,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
