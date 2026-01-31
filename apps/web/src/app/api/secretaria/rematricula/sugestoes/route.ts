import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { tryCanonicalFetch } from '@/lib/api/proxyCanonical'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'

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
      .in('status', ['ativo', 'ativa', 'active'])

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
      })
    }

    return NextResponse.json({ ok: true, sugestoes })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
