import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { tryCanonicalFetch } from '@/lib/api/proxyCanonical'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { ACTIVE_MATRICULA_STATUSES } from '@/lib/matriculas/status'

// Rule: 6 -> 7, 9 -> 10, 12 -> concluido
function proximaClasseNumero(num: number): number | null {
  if (num === 12) return null
  if (num === 6) return 7
  if (num === 9) return 10
  return num + 1 // fallback genérico
}

function extraiNumeroClasse(nome: string | null | undefined): number | null {
  if (!nome) return null
  const m = nome.match(/(\d{1,2})\s*(?:ª|a)?/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, sugestoes: [] })

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/rematricula/sugestoes`)
    if (forwarded) return forwarded

    // Carrega turmas com classe_id para usar regra acadêmica por classe
    let turmasQuery = supabase
      .from('turmas')
      .select('id, nome, turno, ano_letivo, classe_id')
      .eq('escola_id', escolaId)

    turmasQuery = applyKf2ListInvariants(turmasQuery, { defaultLimit: 50 })

    const { data: turmas } = await turmasQuery

    const turmaByClasse = new Map<string, any[]>()
    for (const t of turmas || []) {
      const cid = (t as any).classe_id as string | null
      if (!cid) continue
      const arr = turmaByClasse.get(cid) || []
      arr.push(t)
      turmaByClasse.set(cid, arr)
    }

    const turmaIds = (turmas || []).map((t: any) => t.id).filter(Boolean)
    const bloqueioPorTurma = new Map<string, { inadimplencia: number; reprovacao: number; detalhes: any[] }>()

    let bloquearInadimplentes = false
    try {
      const { data: cfg } = await supabase
        .from('configuracoes_financeiro')
        .select('bloquear_inadimplentes')
        .eq('escola_id', escolaId)
        .maybeSingle()
      bloquearInadimplentes = Boolean((cfg as any)?.bloquear_inadimplentes)
    } catch {}

    if (turmaIds.length > 0) {
      let matriculasQuery = supabase
        .from('matriculas')
        .select('id, aluno_id, turma_id, status, ano_letivo, alunos(nome)')
        .eq('escola_id', escolaId)
        .in('turma_id', turmaIds)
        .in('status', ['ativo', 'ativa', 'active', 'reprovado', 'reprovada', 'reprovado_por_faltas'])

      matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 2000 })
      const { data: matriculas } = await matriculasQuery

      const matriculaIds = (matriculas || []).map((m: any) => m.id).filter(Boolean)
      const inadimplenciaPorMatricula = new Set<string>()

      if (bloquearInadimplentes && matriculaIds.length > 0) {
        const { data: mensalidades } = await supabase
          .from('mensalidades')
          .select('matricula_id, status, data_vencimento')
          .eq('escola_id', escolaId)
          .in('matricula_id', matriculaIds)
          .in('status', ['pendente', 'pago_parcial'])
          .lt('data_vencimento', new Date().toISOString().slice(0, 10))

        for (const row of mensalidades || []) {
          if ((row as any).matricula_id) inadimplenciaPorMatricula.add((row as any).matricula_id)
        }
      }

      for (const m of matriculas || []) {
        const turmaId = (m as any).turma_id as string
        if (!turmaId) continue
        const entry = bloqueioPorTurma.get(turmaId) || { inadimplencia: 0, reprovacao: 0, detalhes: [] }
        const status = String((m as any).status || '').toLowerCase()
        const motivos: string[] = []

        if (bloquearInadimplentes && inadimplenciaPorMatricula.has((m as any).id)) {
          motivos.push('inadimplencia')
          entry.inadimplencia += 1
        }
        if (['reprovado', 'reprovada', 'reprovado_por_faltas'].includes(status)) {
          motivos.push('reprovacao')
          entry.reprovacao += 1
        }

        if (motivos.length > 0) {
          const aluno = Array.isArray((m as any).alunos) ? (m as any).alunos[0] : (m as any).alunos
          entry.detalhes.push({
            aluno_id: (m as any).aluno_id,
            aluno_nome: aluno?.nome ?? null,
            matricula_id: (m as any).id,
            motivos,
          })
        }

        bloqueioPorTurma.set(turmaId, entry)
      }
    }

    // Carrega classes (numero) da escola
    let classesQuery = supabase
      .from('classes')
      .select('id, nome, numero')
      .eq('escola_id', escolaId)

    classesQuery = applyKf2ListInvariants(classesQuery, { defaultLimit: 50 })

    const { data: classes } = await classesQuery

    const classById = new Map<string, { id: string; nome: string; numero: number | null }>()
    const classesByNumero = new Map<number, string[]>()
    for (const c of classes || []) {
      const numero: number | null = (c as any).numero ?? extraiNumeroClasse((c as any).nome)
      classById.set((c as any).id, { id: (c as any).id, nome: (c as any).nome, numero })
      if (numero != null) {
        const arr = classesByNumero.get(numero) || []
        arr.push((c as any).id)
        classesByNumero.set(numero, arr)
      }
    }

    // Carrega contagem de matriculas ativas por turma (MV-backed)
    let matsResumoQuery = supabase
      .from('vw_secretaria_matriculas_turma_status')
      .select('turma_id, status, total')
      .eq('escola_id', escolaId)
        .in('status', ACTIVE_MATRICULA_STATUSES)

    matsResumoQuery = applyKf2ListInvariants(matsResumoQuery, { defaultLimit: 50 })

    const { data: matsResumo } = await matsResumoQuery

    const countByTurma = new Map<string, number>()
    for (const r of matsResumo || []) {
      const turmaId = (r as any).turma_id as string
      const total = Number((r as any).total || 0)
      countByTurma.set(turmaId, (countByTurma.get(turmaId) || 0) + total)
    }

    const sugestoes: any[] = []
    // Para cada turma de origem, derive classe.numero e sugerir destino por classe_id
    for (const origem of turmas || []) {
      const cid = (origem as any).classe_id as string | null
      if (!cid) continue
      const classeOrigem = classById.get(cid)
      const numero = classeOrigem?.numero ?? extraiNumeroClasse(classeOrigem?.nome)
      if (numero == null) continue
      const prox = proximaClasseNumero(numero)
      const total = countByTurma.get((origem as any).id) || 0

      if (prox === null) {
        // conclusão
        sugestoes.push({
          tipo: 'conclusao',
          origem: { id: (origem as any).id, nome: (origem as any).nome, turno: (origem as any).turno ?? null },
          destino: null,
          regra: `${numero}ª → concluído`,
          total_alunos: total,
          bloqueios: bloqueioPorTurma.get((origem as any).id) ?? { inadimplencia: 0, reprovacao: 0, detalhes: [] },
        })
        continue
      }

      const possiveisClasseIds = classesByNumero.get(prox) || []
      let destinoTurma: any | null = null
      for (const cidDest of possiveisClasseIds) {
        const candidatas = turmaByClasse.get(cidDest) || []
        destinoTurma = candidatas.find((t: any) => (t.turno ?? null) === ((origem as any).turno ?? null)) || candidatas[0] || destinoTurma
        if (destinoTurma) break
      }

      sugestoes.push({
        tipo: 'promocao',
        origem: { id: (origem as any).id, nome: (origem as any).nome, turno: (origem as any).turno ?? null },
        destino: destinoTurma ? { id: destinoTurma.id, nome: destinoTurma.nome, turno: destinoTurma.turno ?? null } : null,
        regra: `${numero}ª → ${prox}ª`,
        total_alunos: total,
        bloqueios: bloqueioPorTurma.get((origem as any).id) ?? { inadimplencia: 0, reprovacao: 0, detalhes: [] },
      })
    }

    return NextResponse.json({ ok: true, sugestoes })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
