"use client"

import { useEffect, useRef } from 'react'
import { recordAuditClient, type AuditEvent } from '@/lib/auditClient'
import { createClient } from '@/lib/supabaseClient'

export default function AuditPageView(props: AuditEvent) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    const supabase = createClient()
    let active = true
    let subscription: { unsubscribe: () => void } | null = null
    const sendAudit = () => {
      if (!active || sent.current) return
      sent.current = true
      recordAuditClient({
        ...props,
        acao: props.acao || 'PAGE_VIEW',
        entity: props.entity || 'page',
      })
    }

    ;(async () => {
      const { data: sessionRes } = await supabase.auth.getSession()
      if (sessionRes.session?.user) {
        sendAudit()
        return
      }

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          sendAudit()
          listener.subscription.unsubscribe()
          subscription = null
        }
      })
      subscription = listener.subscription
    })()

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  // props should be considered static per page load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
