// apps/web/src/app/lib/charts.ts
import { supabaseServer } from "@/lib/supabaseServer"

export type ChartsData = {
  escolas: Array<{ id: string; nome?: string | null; status?: string | null }>
  matriculas: Array<{ id: string; escola_id: string }>
  pagamentos: Array<{ status?: string | null }>
  notas: Array<{ id: string; nota: number | null }>
  usuarios: Array<{ id: string; role?: string | null }>
}

export async function getChartsData(): Promise<ChartsData> {
  const supabase = await supabaseServer()

  const results = (await Promise.all([
    supabase.from("escolas").select("id, nome, status").neq('status', 'excluida'),
    supabase.from("matriculas").select("id, escola_id"),
    supabase.from("pagamentos").select("status"),
    supabase.from("notas").select("id, nota"),
    supabase.from("profiles").select("id, role, last_login"),
  ])) as [
    { data: ChartsData["escolas"] | null },
    { data: ChartsData["matriculas"] | null },
    { data: ChartsData["pagamentos"] | null },
    { data: ChartsData["notas"] | null },
    { data: ChartsData["usuarios"] | null }
  ]

  const [
    { data: escolas },
    { data: matriculas },
    { data: pagamentos },
    { data: notas },
    { data: usuarios },
  ] = results

  return {
    escolas: escolas ?? [],
    matriculas: matriculas ?? [],
    pagamentos: pagamentos ?? [],
    notas: notas ?? [],
    usuarios: usuarios ?? [],
  }
}
