"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabaseClient"

type Activity = {
  descricao: string
  status: "Ativo" | "Aplicado" | "Pendente"
  cor: string
}

export default function ActivitiesSection({ activities: initialActivities }: { activities: Activity[] }) {
  const supabase = createClient()
  const [activities, setActivities] = useState<Activity[]>(initialActivities)

  useEffect(() => {
    // helper: traduz log em Activity
    type AuditInsertPayload = { new?: { acao?: string | null; criado_em?: string | null } }
    const mapPayloadToActivity = (payload: AuditInsertPayload, tipo: string): Activity => {
      let status: Activity["status"] = "Pendente"
      let cor = "text-gray-400"

      if (payload.new?.acao === "criada") {
        status = "Ativo"
        cor = "text-green-600"
      } else if (payload.new?.acao === "atualizada") {
        status = "Aplicado"
        cor = "text-blue-600"
      } else if (payload.new?.acao === "deletada") {
        status = "Pendente"
        cor = "text-red-600"
      } else if (payload.new?.acao === "reutilizada") {
        status = "Ativo"
        cor = "text-yellow-600"
      }

      return {
        descricao: `[${tipo}] ${payload.new?.acao} em ${new Date(payload.new?.criado_em || "").toLocaleString("pt-BR")}`,
        status,
        cor,
      }
    }

    // canais realtime para cada auditoria
    const escolaChannel = supabase
      .channel("realtime:escola_auditoria")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "escola_auditoria" }, (payload) => {
        setActivities((prev) => [mapPayloadToActivity(payload, "escola"), ...prev])
      })
      .subscribe()

    const turmaChannel = supabase
      .channel("realtime:turmas_auditoria")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "turmas_auditoria" }, (payload) => {
        setActivities((prev) => [mapPayloadToActivity(payload, "turma"), ...prev])
      })
      .subscribe()

    const discChannel = supabase
      .channel("realtime:disciplinas_auditoria")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "disciplinas_auditoria" }, (payload) => {
        setActivities((prev) => [mapPayloadToActivity(payload, "disciplina"), ...prev])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(escolaChannel)
      supabase.removeChannel(turmaChannel)
      supabase.removeChannel(discChannel)
    }
  }, [supabase])

  return (
    <section className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/50">
      <h2 className="text-lg font-semibold mb-4">Atividades Recentes</h2>
      <ul className="space-y-3 text-sm">
        {activities.length === 0 ? (
          <p className="text-moxinexa-gray text-sm">Nenhuma atividade encontrada</p>
        ) : (
          activities.map((act, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-moxinexa-dark">{act.descricao}</span>
              <span className={`${act.cor} font-medium`}>{act.status}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
