// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '~types/supabase'
import { mapPapelToGlobalRole } from '@/lib/permissions'
// ❌ REMOVIDO: import { generateNumeroLogin } from '@/lib/generateNumeroLogin'

type SeedOptions = {
  alunos?: number
  cursos?: string[]
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T { return arr[rand(0, arr.length - 1)] }

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const hdr = req.headers.get('x-test-seed-key') || ''
    if (!process.env.TEST_SEED_KEY || hdr !== process.env.TEST_SEED_KEY) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'SUPABASE keys missing' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { id: escolaId } = await context.params
    const body: SeedOptions = await req.json().catch(() => ({} as any))
    const nAlunos = Math.min(Math.max(Number(body.alunos || 20), 1), 60)
    const cursoNomes = body.cursos && body.cursos.length ? body.cursos : ['Matemática','Português','Ciências','História','Inglês']

    // 1) Ensure active session for current year
    const year = new Date().getFullYear()
    const sessionName = `${year}`
    const { data: activeSess } = await admin
      .from('school_sessions')
      .select('id, nome, status')
      .eq('escola_id', escolaId)
      .eq('status', 'ativa')
      .maybeSingle()
    let sessionId = (activeSess as any)?.id as string | undefined
    if (!sessionId) {
      const { data: sessIns, error: sessErr } = await admin
        .from('school_sessions')
        .insert({ escola_id: escolaId, nome: sessionName, data_inicio: `${year}-01-01`, data_fim: `${year}-12-31`, status: 'ativa' } as TablesInsert<'school_sessions'>)
        .select('id')
        .single()
      if (sessErr) return NextResponse.json({ ok: false, error: sessErr.message }, { status: 400 })
      sessionId = (sessIns as any).id
    }

    // 2) Create 2 semestres if none
    const { data: sems } = await admin.from('semestres').select('id').eq('session_id', sessionId)
    let semestre1 = (sems || [])[0]?.id as string | undefined
    let semestre2 = (sems || [])[1]?.id as string | undefined
    if (!semestre1 || !semestre2) {
      const { data: sIns, error: sErr } = await admin
        .from('semestres')
        .insert([
          { session_id: sessionId, nome: 'Semestre 1', data_inicio: `${year}-02-01`, data_fim: `${year}-06-30`, attendance_type: 'section', permitir_submissao_final: false },
          { session_id: sessionId, nome: 'Semestre 2', data_inicio: `${year}-08-01`, data_fim: `${year}-12-15`, attendance_type: 'section', permitir_submissao_final: false },
        ] as TablesInsert<'semestres'>[])
        .select('id')
      if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 400 })
      semestre1 = (sIns as any)[0].id
      semestre2 = (sIns as any)[1].id
    }

    // 3) Turma and secoes (AGORA USANDO RPC gerar_turmas_from_curriculo)
    // Precisamos de um cursoId para gerar a turma via RPC.
    // Usamos o primeiro curso criado/encontrado.
    const firstCursoEntry = cursosMap.entries().next().value;
    const firstCursoId = firstCursoEntry ? firstCursoEntry[1] : null;

    if (!firstCursoId) {
        return NextResponse.json({ ok: false, error: 'Nenhum curso disponível para gerar turmas.' }, { status: 400 });
    }

    const turmaNomeParaSeed = '1º Ano A';
    let turmaId: string | undefined;

    // A RPC gera uma turma com um nome, mas precisamos de um nome para a classe aqui.
    // A RPC espera um objeto de geração de turma.
    const generationParams = {
        classes: [{ classeId: 'uuid-dummy-class-id', quantidade: 1, nome: '1º Ano' }], // '1º Ano' é apenas um placeholder para o nome da classe
        turmas: [{ classeId: 'uuid-dummy-class-id', turno: 'M', quantidade: 1, nome: turmaNomeParaSeed }], // Nome da turma com letra 'A'
        capacidadeMaxima: 35,
    };
    
    // Antes de chamar a RPC, precisamos de um ID de classe existente.
    // Vamos criar uma classe "1º Ano" se não existir.
    const { data: existingClasse } = await admin.from('classes').select('id').eq('escola_id', escolaId).eq('nome', '1º Ano').maybeSingle();
    let classePrimeiroAnoId: string;

    if (existingClasse) {
        classePrimeiroAnoId = existingClasse.id;
    } else {
        const { data: newClasse, error: classErr } = await admin.from('classes').insert({
            escola_id: escolaId,
            nome: '1º Ano',
            curso_id: firstCursoId,
        }).select('id').single();
        if (classErr) {
            return NextResponse.json({ ok: false, error: classErr.message || 'Falha ao criar classe para turma seed.' }, { status: 400 });
        }
        classePrimeiroAnoId = newClasse.id;
    }
    // Agora ajustamos os generationParams com o ID da classe real
    generationParams.classes[0].classeId = classePrimeiroAnoId;
    generationParams.turmas[0].classeId = classePrimeiroAnoId;


    const { data: generatedTurmas, error: genTurmasErr } = await admin.rpc('gerar_turmas_from_curriculo', {
        p_escola_id: escolaId,
        p_curso_id: firstCursoId,
        p_ano_letivo: year,
        p_generation_params: generationParams,
    });

    if (genTurmasErr || !generatedTurmas || generatedTurmas.length === 0) {
        return NextResponse.json({ ok: false, error: genTurmasErr?.message || 'Falha ao gerar turma seed via RPC.' }, { status: 400 });
    }
    // A RPC retorna uma tabela, pegamos o ID da primeira turma gerada
    turmaId = generatedTurmas[0].turma_id;

    // Link turma to session
    try { await admin.from('turmas').update({ session_id: sessionId } as any).eq('id', turmaId) } catch {}

    const secNames = ['A','B']
    const { data: exSec } = await admin.from('secoes').select('id, nome').in('nome', secNames).eq('turma_id', turmaId)
    const secByName = new Map<string,string>((exSec||[]).map((s:any)=>[s.nome,s.id]))
    for (const nome of secNames) {
      if (!secByName.get(nome)) {
        const { data: secIns, error: secErr } = await admin.from('secoes').insert({ turma_id: turmaId!, nome, sala: `Sala ${nome}` } as TablesInsert<'secoes'>).select('id').single()
        if (secErr) return NextResponse.json({ ok: false, error: secErr.message }, { status: 400 })
        secByName.set(nome, (secIns as any).id)
      }
    }
    const secaoA = secByName.get('A')!
    const secaoB = secByName.get('B')!

    // 4) Professores (2)
    const seedPw = process.env.TEST_SEED_PASSWORD || 'Passw0rd!'
    const profs: Array<{ user_id: string; email: string } > = []
    for (const i of [1,2]) {
      const email = `seed+prof${i}.${year}@example.com`
      const { data: cu } = await (admin as any).auth.admin.listUsers()
      const found = cu?.users?.find((u: any) => u.email === email)
      let userId = found?.id as string | undefined
      if (!userId) {
        const { data: created, error } = await (admin as any).auth.admin.createUser({
          email, password: seedPw, email_confirm: true,
          app_metadata: { role: mapPapelToGlobalRole('professor'), escola_id: escolaId },
          user_metadata: { nome: `Professor ${i}` },
        })
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
        userId = created?.user?.id
      }
      try {
        await (admin as any).from('profiles').upsert({
          user_id: userId,
          email,
          nome: `Professor ${i}`,
          role: 'professor',
          escola_id: escolaId,
          current_escola_id: escolaId,
        } as any)
      } catch {}
      try { await (admin as any).from('escola_users').upsert({ escola_id: escolaId, user_id: userId, papel: 'professor' } as any, { onConflict: 'escola_id,user_id' }) } catch {}
      try { await (admin as any).from('professores').upsert({ id: userId, escola_id: escolaId, profile_id: userId } as any) } catch {}
      profs.push({ user_id: userId!, email })
    }

    // 5) Cursos (if not exist)
    const { data: existingCursos } = await admin.from('cursos').select('id, nome').eq('escola_id', escolaId)
    const cursosMap = new Map<string,string>((existingCursos||[]).map((c:any)=>[c.nome,c.id]))
    for (const nome of cursoNomes) {
      if (!cursosMap.get(nome)) {
        const { data: cIns, error: cErr } = await admin.from('cursos').insert({ escola_id: escolaId, nome, codigo: nome.slice(0,3).toUpperCase() + rand(100,999) } as any).select('id').single()
        if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 400 })
        cursosMap.set(nome, (cIns as any).id)
      }
    }

    // 6) Ofertas (semestre1) e Atribuições + Rotinas
    const ofertas: string[] = []
    for (const [nome, cursoId] of cursosMap.entries()) {
      const { data: ofEx } = await admin
        .from('cursos_oferta')
        .select('id')
        .eq('curso_id', cursoId)
        .eq('turma_id', turmaId!)
        .eq('semestre_id', semestre1!)
        .maybeSingle()
      let ofertaId = (ofEx as any)?.id as string | undefined
      if (!ofertaId) {
        const { data: ofIns, error: ofErr } = await admin
          .from('cursos_oferta')
          .insert({ curso_id: cursoId, turma_id: turmaId!, semestre_id: semestre1! } as any)
          .select('id')
          .single()
        if (ofErr) return NextResponse.json({ ok: false, error: ofErr.message }, { status: 400 })
        ofertaId = (ofIns as any).id
      }
      ofertas.push(ofertaId)

      const prof = pick(profs).user_id
      try { await admin.from('atribuicoes_prof').upsert({ professor_user_id: prof, curso_oferta_id: ofertaId, secao_id: secaoA } as any, { onConflict: 'professor_user_id,curso_oferta_id,secao_id' }) } catch {}
      try { await admin.from('atribuicoes_prof').upsert({ professor_user_id: prof, curso_oferta_id: ofertaId, secao_id: secaoB } as any, { onConflict: 'professor_user_id,curso_oferta_id,secao_id' }) } catch {}
      const rotA1 = { turma_id: turmaId!, secao_id: secaoA, curso_oferta_id: ofertaId, professor_user_id: prof, weekday: 1, inicio: '08:00', fim: '08:50', sala: '101' }
      const rotA2 = { turma_id: turmaId!, secao_id: secaoA, curso_oferta_id: ofertaId, professor_user_id: prof, weekday: 3, inicio: '08:00', fim: '08:50', sala: '101' }
      const rotB1 = { turma_id: turmaId!, secao_id: secaoB, curso_oferta_id: ofertaId, professor_user_id: prof, weekday: 2, inicio: '09:00', fim: '09:50', sala: '102' }
      const rotB2 = { turma_id: turmaId!, secao_id: secaoB, curso_oferta_id: ofertaId, professor_user_id: prof, weekday: 4, inicio: '09:00', fim: '09:50', sala: '102' }
      try { await admin.from('rotinas').insert([rotA1, rotA2, rotB1, rotB2] as any) } catch {}
    }

    // 7) Avaliações (Prova 1, Trabalho) por oferta
    const avaliacoes: string[] = []
    for (const ofertaId of ofertas) {
      const { data: avEx } = await admin.from('avaliacoes').select('id').eq('curso_oferta_id', ofertaId)
      if (!avEx || avEx.length === 0) {
        const { data: avIns, error: avErr } = await admin.from('avaliacoes').insert([
          { curso_oferta_id: ofertaId, nome: 'Prova 1', peso: 0.5 },
          { curso_oferta_id: ofertaId, nome: 'Trabalho', peso: 0.5 },
        ] as any).select('id')
        if (avErr) return NextResponse.json({ ok: false, error: avErr.message }, { status: 400 })
        avaliacoes.push(...(avIns as any[]).map(r=>r.id))
      } else {
        avaliacoes.push(...(avEx as any[]).map(r=>r.id))
      }
    }

    // 8) Alunos (create users, profiles, alunos, matriculas)
    const alunos: Array<{ user_id: string; aluno_id: string; matricula_id: string; secao_id: string }> = []
    for (let i=1; i<=nAlunos; i++) {
      const email = `seed+aluno${i}.${year}@example.com`
      const { data: cu } = await (admin as any).auth.admin.listUsers()
      const found = cu?.users?.find((u: any) => u.email === email)
      let userId = found?.id as string | undefined
      if (!userId) {
        const { data: created, error } = await (admin as any).auth.admin.createUser({
          email, password: seedPw, email_confirm: true,
          app_metadata: { role: mapPapelToGlobalRole('aluno'), escola_id: escolaId },
          user_metadata: { nome: `Aluno ${i}` },
        })
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
        userId = created?.user?.id
      }
      try {
        await (admin as any).from('profiles').upsert({
          user_id: userId,
          email,
          nome: `Aluno ${i}`,
          role: 'aluno',
          escola_id: escolaId,
          current_escola_id: escolaId,
        } as any)
      } catch {}
      try { await (admin as any).from('escola_users').upsert({ escola_id: escolaId, user_id: userId, papel: 'aluno' } as any, { onConflict: 'escola_id,user_id' }) } catch {}

      const { data: alEx } = await admin.from('alunos').select('id').eq('profile_id', userId!).maybeSingle()
      let alunoId = (alEx as any)?.id as string | undefined
      if (!alunoId) {
        const { data: aIns, error: aErr } = await admin.from('alunos').insert({ escola_id: escolaId, profile_id: userId!, nome_responsavel: `Resp ${i}` } as any).select('id').single()
        if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 400 })
        alunoId = (aIns as any).id
      }

      const sec = i % 2 === 0 ? secaoA : secaoB

      // 🔁 NOVO: usa a função central de matrícula (gera numero_matricula no banco)
      const { data: numeroMatricula, error: rpcErr } = await (admin as any).rpc('create_or_confirm_matricula', {
        p_aluno_id: alunoId!,
        p_turma_id: turmaId!,
        p_ano_letivo: year,
      })
      if (rpcErr) {
        return NextResponse.json({ ok: false, error: rpcErr.message || 'Falha ao criar matrícula' }, { status: 400 })
      }

      // Buscar a matrícula criada/atualizada para pegar o ID
      const { data: mat, error: matErr } = await admin
        .from('matriculas')
        .select('id')
        .eq('aluno_id', alunoId!)
        .eq('turma_id', turmaId!)
        .eq('escola_id', escolaId)
        .eq('ano_letivo', year)
        .maybeSingle()
      if (matErr || !mat) {
        return NextResponse.json({ ok: false, error: matErr?.message || 'Matrícula não encontrada após criação' }, { status: 400 })
      }

      const matriculaId = (mat as any).id as string

      // Atualiza campos logísticos da matrícula (secao, session, data_matricula)
      const { error: upMatErr } = await admin
        .from('matriculas')
        .update({ secao_id: sec, session_id: sessionId!, data_matricula: `${year}-02-05` } as any)
        .eq('id', matriculaId)
      if (upMatErr) {
        return NextResponse.json({ ok: false, error: upMatErr.message || 'Falha ao atualizar matrícula' }, { status: 400 })
      }

      alunos.push({ user_id: userId!, aluno_id: alunoId!, matricula_id: matriculaId, secao_id: sec })
    }

    // 9) Frequências: last 14 days for matching rotinas weekdays
    const { data: rotinas } = await admin.from('rotinas').select('id, weekday, secao_id, curso_oferta_id')
      .eq('turma_id', turmaId!)
    const today = new Date()
    const dateOf = (d: Date) => d.toISOString().slice(0,10)
    const insertsFreq: any[] = []
    for (let back = 0; back < 14; back++) {
      const d = new Date(today.getTime() - back*24*3600*1000)
      const dow = d.getDay() === 0 ? 7 : d.getDay()
      const ds = dateOf(d)
      for (const r of (rotinas || []) as any[]) {
        if (r.weekday !== dow) continue
        for (const a of alunos) {
          if (a.secao_id !== r.secao_id) continue
          const status = Math.random() < 0.9 ? 'presente' : 'ausente'
          insertsFreq.push({ matricula_id: a.matricula_id, routine_id: r.id, curso_oferta_id: r.curso_oferta_id, data: ds, status })
        }
      }
    }
    if (insertsFreq.length) {
      for (let i=0; i<insertsFreq.length; i+=1000) {
        try { await admin.from('frequencias').insert(insertsFreq.slice(i, i+1000) as any) } catch {}
      }
    }

    // 10) Lançamentos de notas para cada avaliação
    const lancRows: any[] = []
    for (const avId of avaliacoes) {
      for (const a of alunos) {
        lancRows.push({ avaliacao_id: avId, matricula_id: a.matricula_id, valor: rand(60, 98), final: false })
      }
    }
    for (let i=0; i<lancRows.length; i+=1000) {
      try { await admin.from('lancamentos').insert(lancRows.slice(i, i+1000) as any) } catch {}
    }

    return NextResponse.json({ ok: true, escolaId, sessionId, turmaId, alunos: alunos.length, cursos: cursosMap.size, ofertas: ofertas.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
