import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser, authorizeEscolaAction } from "@/lib/escola/disciplinas";
import type { Database } from "~types/supabase";
import crypto from "crypto";

function gerarSenhaTemporaria() {
  return crypto.randomBytes(6).toString("base64url").slice(0, 10);
}

function emailLogin(escolaId: string, alunoId: string) {
  return `aluno_${alunoId}@${escolaId}.klasse.ao`.toLowerCase();
}

export async function POST(req: Request) {
  try {
    const s = await supabaseServerTyped<Database>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const alunoIds = Array.isArray(body?.alunoIds) ? body.alunoIds.filter(Boolean) as string[] : [];
    const canal = (body?.canal || body?.metodoEnvio || "whatsapp") as string;
    let escolaId: string | null = body?.escolaId || null;

    if (alunoIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Informe alunos para liberar" }, { status: 400 });
    }

    if (!escolaId) escolaId = await resolveEscolaIdForUser(s as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, []);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "SUPABASE misconfigured" }, { status: 500 });
    }

    const admin = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: alunos, error } = await admin
      .from("alunos")
      .select("id, nome, email, bi_numero, responsavel_contato, telefone_responsavel, encarregado_telefone, escola_id, profile_id, usuario_auth_id, acesso_liberado")
      .in("id", alunoIds)
      .eq("escola_id", escolaId)
      .is("deleted_at", null)
      .not("status", "eq", "inativo");

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const elegiveis = (alunos || []).filter((a: any) => !a.acesso_liberado);
    if (elegiveis.length === 0) return NextResponse.json({ ok: true, liberados: 0, detalhes: [] });

    const resultados: Array<{ id: string; status: string; motivo?: string; login?: string }> = [];
    const processed: Array<{ id: string; nome: string; login: string; senha: string; telefone: string | null }> = [];

    for (const aluno of elegiveis) {
      const login = emailLogin(escolaId, aluno.id);
      const senha = gerarSenhaTemporaria();

      let userId: string | undefined = (aluno as any).usuario_auth_id || undefined;
      if (!userId) {
        const createRes = await admin.auth.admin.createUser({
          email: login,
          password: senha,
          email_confirm: true,
          user_metadata: { nome: aluno.nome, role: 'aluno', escola_id: escolaId, aluno_id: aluno.id, primeiro_acesso: true },
          app_metadata: { role: 'aluno', escola_id: escolaId },
        });

        if (createRes.error) {
          if (createRes.error.message?.toLowerCase().includes('registered')) {
            try {
              const existing = await admin.auth.admin.getUserByEmail(login);
              userId = (existing?.data?.user as any)?.id;
            } catch {
              resultados.push({ id: aluno.id, status: 'erro', motivo: createRes.error.message });
              continue;
            }
          } else {
            resultados.push({ id: aluno.id, status: 'erro', motivo: createRes.error.message });
            continue;
          }
        } else {
          userId = createRes.data.user?.id;
        }
      }

      if (!userId) {
        resultados.push({ id: aluno.id, status: 'erro', motivo: 'Falha ao criar usuário' });
        continue;
      }

      // Upsert profile & vínculo
      await admin.from('profiles').upsert({
        user_id: userId,
        email: login,
        nome: aluno.nome,
        role: 'aluno' as any,
        escola_id: escolaId,
        current_escola_id: escolaId,
        numero_login: login,
      } as any, { onConflict: 'user_id' });

      await admin.from('escola_users').upsert(
        { escola_id: escolaId, user_id: userId, papel: 'aluno' } as any,
        { onConflict: 'escola_id,user_id' }
      );

      await admin
        .from('alunos')
        .update({ profile_id: userId, usuario_auth_id: userId })
        .eq('id', aluno.id)
        .eq('escola_id', escolaId);

      const telefone = aluno.responsavel_contato || aluno.telefone_responsavel || aluno.encarregado_telefone || null;
      const senhaEnviar = (aluno as any).usuario_auth_id ? null : senha;
      processed.push({ id: aluno.id, nome: aluno.nome, login, senha: senhaEnviar, telefone });
      resultados.push({ id: aluno.id, status: 'ok', login });
    }

    const idsLiberados = processed.map((p) => p.id);
    if (idsLiberados.length === 0) {
      return NextResponse.json({ ok: true, liberados: 0, detalhes: resultados });
    }

    // Marca acesso liberado e gera códigos + outbox
    const { data: rpcRes, error: rpcErr } = await (admin as any).rpc('liberar_acesso_alunos_v2', {
      p_escola_id: escolaId,
      p_aluno_ids: idsLiberados,
      p_canal: canal || 'whatsapp',
    });

    if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 400 });

    const rows = Array.isArray(rpcRes) ? rpcRes : [];
    for (const row of rows as any[]) {
      const match = processed.find((p) => p.id === row.aluno_id);
      if (!match) continue;
      const mensagem = `📚 KLASSE - Acesso liberado para ${match.nome}\nLogin: ${match.login}\n${match.senha ? `Senha: ${match.senha}\n` : ''}Código: ${row.codigo_ativacao || ''}\nPortal: https://portal.klasse.ao`;
      await admin
        .from('outbox_notificacoes')
        .update({
          destino: match.telefone,
          mensagem,
          payload: { login: match.login, senha: match.senha, codigo: row.codigo_ativacao, aluno_nome: match.nome, canal },
        })
        .eq('aluno_id', row.aluno_id)
        .eq('request_id', row.request_id)
        .eq('escola_id', escolaId);
    }

    return NextResponse.json({ ok: true, liberados: idsLiberados.length, detalhes: resultados });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
