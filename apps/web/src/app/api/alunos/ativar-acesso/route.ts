import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
    const body = await req.json().catch(() => null);
    const codigo = (body?.codigo || "").toString().trim();
    const bi = (body?.bi || "").toString().trim();

    if (!codigo || !bi) {
      return NextResponse.json({ ok: false, error: "Informe código e BI" }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "SUPABASE misconfigured" }, { status: 500 });
    }

    const admin = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: aluno, error } = await admin
      .from('alunos')
      .select('id, nome, escola_id, bi_numero, usuario_auth_id, profile_id, codigo_ativacao, acesso_liberado')
      .eq('codigo_ativacao', codigo)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    if (!aluno) return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 404 });

    const biBanco = (aluno as any).bi_numero as string | null;
    if (biBanco && biBanco.trim().toLowerCase() !== bi.trim().toLowerCase()) {
      return NextResponse.json({ ok: false, error: 'BI não confere' }, { status: 400 });
    }

    const escolaId = (aluno as any).escola_id as string;
    const login = emailLogin(escolaId, (aluno as any).id);
    const senha = gerarSenhaTemporaria();

    let userId = (aluno as any).usuario_auth_id as string | null;
    if (!userId) {
      const createRes = await admin.auth.admin.createUser({
        email: login,
        password: senha,
        email_confirm: true,
        user_metadata: { nome: (aluno as any).nome, role: 'aluno', escola_id: escolaId, aluno_id: (aluno as any).id, primeiro_acesso: true },
        app_metadata: { role: 'aluno', escola_id: escolaId },
      });

      if (createRes.error) {
        if (createRes.error.message?.toLowerCase().includes('registered')) {
          try {
            const { data: existingUser, error: existingUserError } = await admin
              .from('users')
              .select('id')
              .eq('email', login)
              .single();

            if (existingUserError) {
              return NextResponse.json({ ok: false, error: existingUserError.message }, { status: 400 });
            }

            userId = existingUser?.id || null;
          } catch {
            return NextResponse.json({ ok: false, error: createRes.error.message }, { status: 400 });
          }
        } else {
          return NextResponse.json({ ok: false, error: createRes.error.message }, { status: 400 });
        }
      } else {
        userId = createRes.data.user?.id || null;
      }
    }

    if (!userId) return NextResponse.json({ ok: false, error: 'Falha ao criar usuário' }, { status: 500 });

    await admin.from('profiles').upsert({
      user_id: userId,
      email: login,
      nome: (aluno as any).nome,
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
      .update({ acesso_liberado: true, data_ativacao: new Date().toISOString(), usuario_auth_id: userId, profile_id: userId })
      .eq('id', (aluno as any).id)
      .eq('escola_id', escolaId);

    return NextResponse.json({ ok: true, login });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
