import StudentPortalLayout from "@/components/layout/StudentPortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"
import { supabaseServerTyped } from "@/lib/supabaseServer"

export default async function Page() {
  // Use untyped client to access newly added tables before regenerating types
  const supabase = await supabaseServerTyped<any>()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user

  let cursos: Array<{ nome: string }> = []
  let rotinas: Array<{ weekday: number; inicio: string; fim: string; sala: string | null }> = []
  let freqResumo: { total: number; presentes: number } = { total: 0, presentes: 0 }

  try {
    if (user) {
      // Resolve aluno -> matricula mais recente -> turma
      const { data: alunos } = await supabase
        .from('alunos')
        .select('id')
        .eq('profile_id', user.id)
        .limit(1)
      const alunoId = (alunos?.[0] as any)?.id as string | undefined

      if (alunoId) {
        const { data: mats } = await supabase
          .from('matriculas')
          .select('id, turma_id')
          .eq('aluno_id', alunoId)
          .order('created_at', { ascending: false })
          .limit(1)
        const matricula = mats?.[0] as any
        const matriculaId = matricula?.id as string | undefined
        const turmaId = matricula?.turma_id as string | undefined

        // Cursos: via cursos_oferta para a turma (semestre corrente não filtrado ainda)
        if (turmaId) {
          const { data: cursosOferta } = await supabase
            .from('cursos_oferta')
            .select('curso_id, cursos!inner(nome)')
            .eq('turma_id', turmaId)
          cursos = (cursosOferta || []).map((r: any) => ({ nome: r.cursos?.nome }))

          // Rotinas da turma
          const { data: rs } = await supabase
            .from('rotinas')
            .select('weekday, inicio, fim, sala')
            .eq('turma_id', turmaId)
            .order('weekday', { ascending: true })
          rotinas = (rs || []) as any
        }

        // Frequencias da matrícula
        if (matriculaId) {
          const { data: fr } = await supabase
            .from('frequencias')
            .select('status')
            .eq('matricula_id', matriculaId)
          const total = fr?.length || 0
          const presentes = (fr || []).filter((f: any) => f.status === 'presente').length
          freqResumo = { total, presentes }
        }
      }
    }
  } catch (e) {
    // keep silent; show placeholders
  }

  return (
    <StudentPortalLayout>
      <AuditPageView portal="aluno" action="PAGE_VIEW" entity="cursos" />
      <div className="space-y-6">
        <div>
          <div className="font-semibold mb-2">Seus cursos</div>
          {cursos.length === 0 ? (
            <div className="text-sm text-gray-600">Nenhum curso atribuído ainda.</div>
          ) : (
            <ul className="list-disc list-inside text-sm text-gray-700">
              {cursos.map((c, i) => (
                <li key={i}>{c.nome}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="font-semibold mb-2">Horários (rotinas)</div>
          {rotinas.length === 0 ? (
            <div className="text-sm text-gray-600">Sem horários cadastrados.</div>
          ) : (
            <ul className="text-sm text-gray-700 space-y-1">
              {rotinas.map((r, i) => (
                <li key={i}>
                  Dia {r.weekday}: {r.inicio}–{r.fim} {r.sala ? `• Sala ${r.sala}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="font-semibold mb-2">Frequência</div>
          <div className="text-sm text-gray-700">
            Registros: {freqResumo.total} • Presentes: {freqResumo.presentes}
          </div>
        </div>
      </div>
    </StudentPortalLayout>
  )
}
