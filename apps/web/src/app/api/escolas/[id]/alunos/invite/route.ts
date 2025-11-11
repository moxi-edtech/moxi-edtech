import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "~types/supabase";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission, mapPapelToGlobalRole } from "@/lib/permissions";
import { recordAuditServer } from "@/lib/audit";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { buildCredentialsEmail, sendMail } from "@/lib/mailer";
import { sanitizeEmail } from "@/lib/sanitize";

const BodySchema = z.object({
  email: z.string().email(),
  nome: z.string().trim().min(1),
  alunoId: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {

  const { id: escolaId } = await context.params
  try {
    const parse = BodySchema.safeParse(await req.json());
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 });
    const { email: rawEmail, nome, alunoId } = parse.data;
    const email = sanitizeEmail(rawEmail);

    const s = await supabaseServer();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', user.id).eq('escola_id', escolaId).limit(1);
    const papel = (vinc?.[0] as any)?.papel || null;
    if (!hasPermission(papel as any, 'criar_matricula')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY para convidar.' }, { status: 500 });
    }

    const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Generate numero_login for aluno
    let numeroLogin: string | null = null;
    try { numeroLogin = await generateNumeroLogin(escolaId, 'aluno' as any, admin as any) } catch {}

    // Existing user?
    const { data: prof } = await admin.from('profiles').select('user_id').eq('email', email).limit(1);
    let userId = (prof?.[0] as any)?.user_id as string | undefined;
    let invited = false;
    if (!userId) {
      const { data: inv, error: invErr } = await (admin as any).auth.admin.inviteUserByEmail(email, { data: { nome, role: 'aluno', numero_usuario: numeroLogin || undefined, must_change_password: true } });
      if (invErr) return NextResponse.json({ ok: false, error: invErr.message }, { status: 400 });
      userId = inv?.user?.id;
      invited = true;
      if (!userId) return NextResponse.json({ ok: false, error: 'Falha ao convidar' }, { status: 400 });

      try {
        await admin.from('profiles').insert([{
          user_id: userId,
          email,
          nome,
          numero_login: numeroLogin ?? null,
          role: 'aluno' as any,
          escola_id: escolaId,
        } as TablesInsert<'profiles'>]);
      } catch {}
      try { await (admin as any).auth.admin.updateUserById(userId, { app_metadata: { role: 'aluno', escola_id: escolaId, numero_usuario: numeroLogin || undefined } }) } catch {}
    } else {
      try { await admin.from('profiles').update({ role: 'aluno' as any, escola_id: escolaId, numero_login: numeroLogin ?? undefined }).eq('user_id', userId) } catch {}
      try { await (admin as any).auth.admin.updateUserById(userId, { app_metadata: { role: 'aluno', escola_id: escolaId, numero_usuario: numeroLogin || undefined } }) } catch {}
    }

    // Link to escola_usuarios
    try {
      await admin.from('escola_usuarios').upsert({ escola_id: escolaId, user_id: userId!, papel: 'aluno' } as TablesInsert<'escola_usuarios'>, { onConflict: 'escola_id,user_id' });
    } catch {}

    // Try to link aluno.profile_id by matching email or id
    if (alunoId) {
      try { await admin.from('alunos').update({ profile_id: userId! } as any).eq('id', alunoId) } catch {}
    } else {
      try { await admin.from('alunos').update({ profile_id: userId! } as any).eq('escola_id', escolaId).eq('email', email) } catch {}
    }

    recordAuditServer({ escolaId, portal: 'secretaria', acao: 'ALUNO_CONVIDADO', entity: 'aluno', entityId: alunoId ?? userId!, details: { email, invited, numero_login: numeroLogin } }).catch(()=>null);

    // Send credentials email with numero_login
    try {
      if (numeroLogin) {
        const { data: esc } = await admin.from('escolas' as any).select('nome').eq('id', escolaId).maybeSingle();
        const escolaNome = (esc as any)?.nome ?? null;
        const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : null;
        const mail = buildCredentialsEmail({ nome, email, numero_login: numeroLogin, escolaNome, loginUrl });
        await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
      }
    } catch {}

    return NextResponse.json({ ok: true, userId, numero: numeroLogin });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
