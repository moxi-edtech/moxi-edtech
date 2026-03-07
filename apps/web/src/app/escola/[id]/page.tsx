import { supabaseServer } from '~/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function EscolaIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in, redirect to login page
    return redirect('/login');
  }

  const { data: escolaUsuario, error } = await supabase
    .from('escola_users')
    .select('papel')
    .eq('escola_id', id)
    .eq('user_id', user.id)
    .single();

  const { data: escolaInfo } = await supabase
    .from('escolas')
    .select('slug')
    .eq('id', id)
    .maybeSingle();
  const escolaParam = escolaInfo?.slug ? String(escolaInfo.slug) : id;

  if (error || !escolaUsuario) {
    // This can happen if the user is not associated with the school
    // Or if there's a DB error.
    // For security, redirecting to a generic dashboard seems safer than exposing school-specific URLs.
    // Or, you could redirect to an error page: redirect('/error?message=access_denied');
    console.error('Error fetching user role or user not in school:', error?.message);
    return redirect('/dashboard');
  }

  if (escolaUsuario.papel === 'admin' || escolaUsuario.papel === 'admin_escola') {
    return redirect(`/escola/${escolaParam}/admin/dashboard`);
  }

  if (escolaUsuario.papel === 'secretaria_financeiro') {
    return redirect(`/escola/${escolaParam}/secretaria?modo=balcao`);
  }

  if (escolaUsuario.papel === 'admin_financeiro') {
    return redirect(`/escola/${escolaParam}/admin/dashboard?tab=financeiro`);
  }

  if (escolaUsuario.papel === 'professor') {
    return redirect('/professor');
  }

  if (escolaUsuario.papel === 'aluno') {
    return redirect('/aluno/dashboard');
  }

  return redirect(`/escola/${escolaParam}/dashboard`);
}
