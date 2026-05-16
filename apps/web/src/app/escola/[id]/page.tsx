import { supabaseServer } from '~/lib/supabase/server';
import { redirect } from 'next/navigation';
import { resolveEscolaIdForUser } from '~/lib/tenant/resolveEscolaIdForUser';
import { getDefaultK12PortalPathForRole } from '@/lib/permissions';

export default async function EscolaIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in, redirect to login page
    return redirect('/redirect');
  }

  const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, id);
  if (!userEscolaId) {
    return redirect('/dashboard');
  }

  const { data: escolaUsuario, error } = await supabase
    .from('escola_users')
    .select('papel')
    .eq('escola_id', userEscolaId)
    .eq('user_id', user.id)
    .single();

  const { data: escolaInfo } = await supabase
    .from('escolas')
    .select('slug')
    .eq('id', userEscolaId)
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

  const normalizedPapel = String(escolaUsuario.papel ?? '').trim().toLowerCase();
  if (normalizedPapel === 'aluno') {
    return redirect(`/escola/${escolaParam}/aluno/dashboard`);
  }

  return redirect(getDefaultK12PortalPathForRole(normalizedPapel, escolaParam));
}
